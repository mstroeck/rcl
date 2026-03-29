#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getConfig } from './config/loader.js';
import { resolveDiff } from './resolver/index.js';
import { chunkDiff } from './prepare/chunker.js';
import { buildReviewPrompt } from './prepare/prompt-builder.js';
import { filterFiles } from './prepare/file-filter.js';
import { runReviews } from './dispatch/runner.js';
import { buildConsensus } from './consensus/index.js';
import { formatTerminalOutput } from './output/terminal.js';
import { formatJsonOutput } from './output/json.js';
import { formatMarkdownOutput } from './output/markdown.js';
import { postToGitHub, createReviewComments } from './output/github.js';
import { parseGitHubURL } from './resolver/github.js';
import { estimateTokens, estimateCost, formatEstimate, ModelEstimate } from './cost/estimator.js';
import { evaluatePolicy, formatCIFindings } from './ci/policy.js';
import { ArtifactWriter, createArtifact, ResolvedDiffArtifact, PromptArtifact, ModelRunArtifact, ConsensusArtifact, PolicyArtifact } from './artifacts/index.js';
import { initCommand } from './cli/init.js';
import fs from 'fs/promises';

const program = new Command();

program
  .name('rcl')
  .description('Cross-provider AI code review tool with consensus voting')
  .version('0.1.0');

program
  .command('review')
  .description('Review a PR or diff file')
  .argument('<target>', 'GitHub PR (owner/repo#123) or local patch file')
  .option('--diff <content>', 'Provide diff content directly')
  .option('--models <models>', 'Comma-separated list of models (claude,gpt,gemini)', (val) =>
    val.split(',').map(s => s.trim())
  )
  .option('--post', 'Post results to GitHub PR (defaults to inline review comments)')
  .option('--inline', 'Post inline review comments (alias for --post-mode inline)')
  .option('--post-mode <mode>', 'How to post to GitHub: comment, inline, or both (default: inline)')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as Markdown')
  .option('--output <file>', 'Write output to file')
  .option('--ci', 'CI mode (exit with error if issues found)')
  .option('--timeout <seconds>', 'Timeout per model in seconds', parseFloat)
  .option('--fix-suggestions', 'Include fix suggestions in output')
  .option('--verbose', 'Alias for --fix-suggestions (backwards compatibility)')
  .option('--github-token <token>', 'GitHub token for API access')
  .option('--estimate', 'Estimate token count and cost without running review')
  .option('--ignore <patterns>', 'Comma-separated glob patterns to ignore', (val) =>
    val.split(',').map(s => s.trim())
  )
  .option('--include <patterns>', 'Comma-separated glob patterns to include', (val) =>
    val.split(',').map(s => s.trim())
  )
  .option('--context <text>', 'Additional context about the codebase for reviewers')
  .option('--fail-on <severity>', 'Severity threshold for CI failure (info|low|medium|high|critical)')
  .option('--require-consensus <count>', 'Minimum models that must agree for blocking finding', parseInt)
  .option('--soft-fail', 'Report findings but always exit 0 (for CI)')
  .option('--show-disagreements', 'Show disagreement analysis (default: on in verbose mode)')
  .option('--max-cost <usd>', 'Maximum cost in USD for this review run', parseFloat)
  .option('--stop-after-findings <count>', 'Stop early when enough blocking findings found', parseInt)
  .option('--artifacts-dir <path>', 'Directory to write review artifacts (for debugging/resumability)')
  .action(async (target, options) => {
    try {
      const spinner = ora('Loading configuration').start();

      // Load config
      const config = await getConfig({
        models: options.models,
        timeout: options.timeout,
        verbose: options.verbose || options.fixSuggestions,
      });

      spinner.succeed('Configuration loaded');

      // Initialize artifact writer if artifacts-dir is set
      let artifactWriter: ArtifactWriter | undefined;
      if (options.artifactsDir) {
        artifactWriter = new ArtifactWriter(options.artifactsDir);
        await artifactWriter.init();
        spinner.info(`Artifacts will be written to ${artifactWriter.getSessionDir()}`);
      }

      // Resolve diff
      spinner.start('Resolving diff');
      const isGitHubRef = /^[^\/]+\/[^#]+#\d+$/.test(target) || /github\.com\//.test(target);

      // Only set patchFile if target looks like a file path
      let patchFile: string | undefined;
      if (!options.diff && !isGitHubRef) {
        // Check if it's a file path (exists or has common patch/diff extension)
        const looksLikeFile = target.endsWith('.patch') || target.endsWith('.diff') || target.includes('/');
        if (looksLikeFile) {
          patchFile = target;
        }
      }

      const diffResult = await resolveDiff(target, {
        diff: options.diff,
        patchFile,
        githubToken: options.githubToken,
      });

      // Apply file filtering
      const filterConfig = {
        ignore: options.ignore || config.ignore || [],
        include: options.include || config.include || [],
      };
      const filePaths = diffResult.files.map(f => f.path);
      const filterResult = filterFiles(filePaths, filterConfig);

      // Filter the files in diffResult
      const filteredFiles = diffResult.files.filter(f => filterResult.included.includes(f.path));

      spinner.succeed(
        `Resolved ${diffResult.files.length} file${diffResult.files.length !== 1 ? 's' : ''}` +
        (filterResult.excluded.length > 0
          ? ` (${filterResult.excluded.length} filtered out)`
          : '')
      );

      if (filterResult.excluded.length > 0) {
        console.log(
          chalk.dim(`  Excluded: ${filterResult.excluded.slice(0, 5).join(', ')}${filterResult.excluded.length > 5 ? ` +${filterResult.excluded.length - 5} more` : ''}`)
        );
      }

      // Replace files array with filtered version (intentional mutation for downstream use)
      diffResult.files = filteredFiles;

      if (diffResult.files.length === 0) {
        console.log(chalk.yellow('⚠️  No files to review after filtering'));
        return;
      }

      // Write resolved diff artifact
      if (artifactWriter) {
        const artifact = createArtifact<ResolvedDiffArtifact>('resolved-diff', {
          files: diffResult.files,
          fileCount: diffResult.files.length,
          totalAdditions: diffResult.files.reduce((sum, f) => sum + f.additions, 0),
          totalDeletions: diffResult.files.reduce((sum, f) => sum + f.deletions, 0),
        });
        await artifactWriter.write(artifact);
      }

      // Chunk diff
      const chunks = chunkDiff(diffResult.files, config.chunkSize);
      if (chunks.length > 1) {
        spinner.info(`Split into ${chunks.length} chunks for processing`);
      }

      // If --estimate flag is set, calculate and display cost estimate for ALL chunks
      if (options.estimate) {
        spinner.start('Building prompts for estimation');
        const allPrompts = chunks.map(chunk =>
          buildReviewPrompt(chunk, {
            includeFixSuggestions: config.includeFixSuggestions,
            promptHardening: config.promptHardening,
            context: options.context || config.context,
          })
        );
        spinner.succeed(`Built ${chunks.length} prompt${chunks.length !== 1 ? 's' : ''} for estimation`);

        const totalTokens = allPrompts.reduce((sum, prompt) => sum + estimateTokens(prompt), 0);
        const estimates: ModelEstimate[] = config.models.map(m => ({
          model: `${m.provider}/${m.model}`,
          tokens: totalTokens,
          cost: estimateCost(totalTokens, m.model),
        }));

        console.log(formatEstimate(estimates));
        console.log(chalk.dim('Note: This is an estimate. Actual costs may vary.\n'));
        process.exit(0);
      }

      // Process all chunks and collect responses
      const diffFiles = diffResult.files.map(f => f.path);
      const allResponses: Awaited<ReturnType<typeof runReviews>> = [];
      const maxCost = options.maxCost || config.maxCostPerRun;
      let accumulatedCost = 0;
      let budgetExceeded = false;

      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        if (chunks.length > 1) {
          spinner.start(`Building prompt for chunk ${ci + 1}/${chunks.length}`);
        } else {
          spinner.start('Building review prompt');
        }
        const prompt = buildReviewPrompt(chunk, {
          includeFixSuggestions: config.includeFixSuggestions,
          promptHardening: config.promptHardening,
          context: options.context || config.context,
        });
        spinner.succeed(chunks.length > 1
          ? `Chunk ${ci + 1}/${chunks.length} prompt built (${chunk.files.length} files)`
          : 'Prompt built');

        // Write prompt artifact
        if (artifactWriter) {
          const promptTokens = estimateTokens(prompt);
          const artifact = createArtifact<PromptArtifact>('prompt', {
            chunkIndex: ci,
            totalChunks: chunks.length,
            prompt,
            fileCount: chunk.files.length,
            estimatedTokens: promptTokens,
          });
          await artifactWriter.write(artifact);
        }

        // Check budget before running this chunk
        if (maxCost !== undefined) {
          const promptTokens = estimateTokens(prompt);
          const chunkEstimate = config.models.reduce((sum, m) => {
            return sum + estimateCost(promptTokens, m.model).total;
          }, 0);

          if (accumulatedCost + chunkEstimate > maxCost) {
            console.log(chalk.yellow(`\n⚠️  Budget limit reached ($${accumulatedCost.toFixed(4)} + $${chunkEstimate.toFixed(4)} would exceed $${maxCost.toFixed(2)})`));
            console.log(chalk.yellow(`   Stopping after chunk ${ci}/${chunks.length}. Returning partial results.\n`));
            budgetExceeded = true;
            break;
          }
        }

        // Run reviews
        const modelSpinners = config.models.map(m => {
          const label = chunks.length > 1
            ? `[${ci + 1}/${chunks.length}] Reviewing with ${m.provider}/${m.model}`
            : `Reviewing with ${m.provider}/${m.model}`;
          const s = ora(label).start();
          return { provider: `${m.provider}/${m.model}`, spinner: s };
        });

        const responses = await runReviews(
          prompt,
          config.models,
          config.timeout,
          config.maxConcurrent,
          undefined, // use default adapters
          config.retries,
          config.retryDelayMs,
          (attempt, maxAttempts, provider, model) => {
            // Log retry attempts
            console.log(chalk.yellow(`  ↻ Retrying ${provider}/${model} (attempt ${attempt}/${maxAttempts})...`));
          }
        );

        // Update spinners and track cost
        for (let i = 0; i < responses.length; i++) {
          const resp = responses[i];
          const ms = modelSpinners[i];
          if (resp.success) {
            const tokenInfo = resp.tokenUsage
              ? ` | ${resp.tokenUsage.inputTokens}→${resp.tokenUsage.outputTokens} tokens`
              : '';
            ms.spinner.succeed(`${ms.provider} completed (${resp.durationMs}ms${tokenInfo})`);
            // Track actual cost if available
            if (resp.tokenUsage && i < config.models.length) {
              const actualCost = estimateCost(resp.tokenUsage.totalTokens, config.models[i].model).total;
              accumulatedCost += actualCost;
            }
          } else {
            ms.spinner.fail(`${ms.provider} failed: ${resp.error}`);
          }
        }

        allResponses.push(...responses);

        // Write model run artifact
        if (artifactWriter) {
          const artifact = createArtifact<ModelRunArtifact>('model-run', {
            chunkIndex: ci,
            responses,
          });
          await artifactWriter.write(artifact);
        }

        // Check if we should stop early based on findings count
        const stopAfterFindings = options.stopAfterFindings || config.stopAfterFindings;
        if (stopAfterFindings !== undefined && allResponses.length > 0) {
          // Do a quick consensus check with current responses
          const tempMerged = new Map<string, typeof allResponses[0]>();
          for (const resp of allResponses) {
            const key = `${resp.provider}/${resp.model}`;
            const existing = tempMerged.get(key);
            if (!existing) {
              tempMerged.set(key, { ...resp });
            } else {
              try {
                const existingFindings = JSON.parse(existing.rawResponse || '[]');
                const newFindings = JSON.parse(resp.rawResponse || '[]');
                existing.rawResponse = JSON.stringify([
                  ...(Array.isArray(existingFindings) ? existingFindings : []),
                  ...(Array.isArray(newFindings) ? newFindings : []),
                ]);
              } catch (error) {
                // Ignore merge errors during check
              }
            }
          }
          const tempConsensus = await buildConsensus([...tempMerged.values()], config, diffFiles);

          // Count blocking findings based on policy
          let blockingFindings = 0;
          if (options.failOn || config.policy?.failOn) {
            const policy = {
              failOn: options.failOn || config.policy?.failOn || 'high',
              requireConsensus: options.requireConsensus || config.policy?.requireConsensus || 1,
              categories: config.policy?.categories,
              ignoreCategories: config.policy?.ignoreCategories || [],
            };
            const tempPolicy = evaluatePolicy(tempConsensus.findings, policy);
            blockingFindings = tempPolicy.blockingFindings.length;
          } else {
            // No policy, count all findings
            blockingFindings = tempConsensus.findings.length;
          }

          if (blockingFindings >= stopAfterFindings) {
            console.log(chalk.yellow(`\n✋ Stopping early: found ${blockingFindings} blocking findings (threshold: ${stopAfterFindings})`));
            console.log(chalk.yellow(`   Processed ${ci + 1}/${chunks.length} chunks\n`));
            break;
          }
        }
      }

      if (budgetExceeded && allResponses.length === 0) {
        console.log(chalk.yellow('No chunks were processed due to budget constraints.'));
        process.exit(0);
      }

      // Merge responses from same model across chunks before consensus
      const mergedByModel = new Map<string, typeof allResponses[0]>();
      for (const resp of allResponses) {
        const key = `${resp.provider}/${resp.model}`;
        const existing = mergedByModel.get(key);
        if (!existing) {
          mergedByModel.set(key, { ...resp });
        } else {
          // Merge: combine rawResponse arrays, sum duration, keep success if any succeeded
          try {
            const existingFindings = JSON.parse(existing.rawResponse || '[]');
            const newFindings = JSON.parse(resp.rawResponse || '[]');
            existing.rawResponse = JSON.stringify([
              ...(Array.isArray(existingFindings) ? existingFindings : []),
              ...(Array.isArray(newFindings) ? newFindings : []),
            ]);
          } catch (error) {
            console.warn(`Warning: Failed to merge findings for ${key}: ${error}`);
          }
          existing.durationMs += resp.durationMs;
          existing.success = existing.success || resp.success;
          if (resp.error && !existing.error) existing.error = resp.error;
          // Merge token usage
          if (resp.tokenUsage) {
            if (existing.tokenUsage) {
              existing.tokenUsage.inputTokens += resp.tokenUsage.inputTokens;
              existing.tokenUsage.outputTokens += resp.tokenUsage.outputTokens;
              existing.tokenUsage.totalTokens += resp.tokenUsage.totalTokens;
            } else {
              existing.tokenUsage = { ...resp.tokenUsage };
            }
          }
        }
      }
      const mergedResponses = [...mergedByModel.values()];

      // Build consensus across merged model responses
      spinner.start('Building consensus');
      const result = await buildConsensus(mergedResponses, config, diffFiles);
      spinner.succeed(
        `Consensus built: ${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''}`
      );

      // Write consensus artifact
      if (artifactWriter) {
        const artifact = createArtifact<ConsensusArtifact>('consensus', {
          ...result,
        });
        await artifactWriter.write(artifact);
      }

      // Evaluate CI policy if in CI mode or policy flags provided
      let policyResult;
      if (options.ci || options.failOn || options.requireConsensus) {
        const policy = {
          failOn: options.failOn || config.policy?.failOn || 'high',
          requireConsensus: options.requireConsensus || config.policy?.requireConsensus || 1,
          categories: config.policy?.categories,
          ignoreCategories: config.policy?.ignoreCategories || [],
        };
        policyResult = evaluatePolicy(result.findings, policy);
        console.log(chalk[policyResult.passed ? 'green' : 'red'](policyResult.summary));

        // Write policy artifact
        if (artifactWriter) {
          const artifact = createArtifact<PolicyArtifact>('policy', policyResult);
          await artifactWriter.write(artifact);
        }
      }

      // Output results
      let output: string;

      if (options.json) {
        output = formatJsonOutput(result);
      } else if (options.markdown) {
        output = formatMarkdownOutput(result, options.showDisagreements || options.verbose);
      } else {
        const showDisagreements = options.showDisagreements !== undefined
          ? options.showDisagreements
          : (options.verbose || options.fixSuggestions);
        output = formatTerminalOutput(result, options.verbose || options.fixSuggestions, showDisagreements);
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`✓ Results written to ${options.output}`));
      } else {
        console.log(output);
      }

      // Post to GitHub if requested
      if (options.post || options.inline) {
        const ghParsed = parseGitHubURL(target);
        if (!ghParsed) {
          console.log(chalk.yellow('⚠️  Cannot post to GitHub: target is not a GitHub PR'));
        } else {
          // Determine post mode (default to inline)
          const validPostModes = ['comment', 'inline', 'both'] as const;
          let postMode: string = options.postMode || (options.inline ? 'inline' : 'inline');
          if (!validPostModes.includes(postMode as typeof validPostModes[number])) {
            console.log(chalk.yellow(`⚠️  Invalid --post-mode: ${postMode}. Using 'inline'.`));
            postMode = 'inline';
          }
          // If both --post and --inline are explicitly set, use 'both'
          if (options.post && options.inline && !options.postMode) {
            postMode = 'both';
          }

          const ghOptions = {
            ...ghParsed,
            token: options.githubToken,
          };

          try {
            if (postMode === 'comment' || postMode === 'both') {
              spinner.start('Posting PR comment');
              await postToGitHub(result, ghOptions);
              spinner.succeed('Posted PR comment');
            }

            if (postMode === 'inline' || postMode === 'both') {
              spinner.start('Posting inline review comments');
              await createReviewComments(result, ghOptions);
              spinner.succeed('Posted inline review comments');
            }
          } catch (error) {
            spinner.fail(
              `Failed to post to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      // CI mode: exit with error based on policy
      if (options.ci || options.failOn || options.requireConsensus) {
        if (!policyResult) {
          // Should never happen due to logic above, but TypeScript doesn't know that
          throw new Error('Policy result not computed');
        }

        if (!policyResult.passed) {
          // Print detailed findings for CI
          console.log(formatCIFindings(policyResult.blockingFindings));

          // Soft-fail mode: report but don't exit with error
          if (options.softFail) {
            console.log(chalk.yellow('\n⚠️  Soft-fail mode: findings reported but exiting 0'));
            process.exit(0);
          }

          // Hard fail
          process.exit(policyResult.exitCode);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize Review Council configuration')
  .option('--yes', 'Skip interactive prompts and use defaults')
  .option('--github-action', 'Generate GitHub Actions workflow')
  .action(async (options) => {
    try {
      await initCommand(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
