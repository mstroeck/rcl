#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import { getConfig } from './config/loader.js';
import { resolveDiff } from './resolver/index.js';
import { chunkDiff } from './prepare/chunker.js';
import { buildReviewPrompt } from './prepare/prompt-builder.js';
import { runReviews } from './dispatch/runner.js';
import { buildConsensus } from './consensus/index.js';
import { formatTerminalOutput } from './output/terminal.js';
import { formatJsonOutput } from './output/json.js';
import { formatMarkdownOutput } from './output/markdown.js';
import { postToGitHub, createReviewComments } from './output/github.js';
import { parseGitHubURL } from './resolver/github.js';
import { estimateTokens, estimateCost, formatEstimate, ModelEstimate } from './cost/estimator.js';
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
  .option('--post', 'Post results as GitHub PR comment')
  .option('--json', 'Output as JSON')
  .option('--markdown', 'Output as Markdown')
  .option('--output <file>', 'Write output to file')
  .option('--ci', 'CI mode (exit with error if issues found)')
  .option('--timeout <seconds>', 'Timeout per model in seconds', parseFloat)
  .option('--verbose', 'Include fix suggestions in output')
  .option('--github-token <token>', 'GitHub token for API access')
  .option('--estimate', 'Estimate token count and cost without running review')
  .action(async (target, options) => {
    try {
      const spinner = ora('Loading configuration').start();

      // Load config
      const config = await getConfig({
        models: options.models,
        timeout: options.timeout,
        verbose: options.verbose,
      });

      spinner.succeed('Configuration loaded');

      // Resolve diff
      spinner.start('Resolving diff');
      const isGitHubRef = /^[^\/]+\/[^#]+#\d+$/.test(target) || /github\.com\//.test(target);
      const diffResult = await resolveDiff(target, {
        diff: options.diff,
        patchFile: (options.diff || isGitHubRef) ? undefined : target,
        githubToken: options.githubToken,
      });

      spinner.succeed(
        `Resolved ${diffResult.files.length} file${diffResult.files.length !== 1 ? 's' : ''}`
      );

      if (diffResult.files.length === 0) {
        console.log(chalk.yellow('⚠️  No files to review'));
        return;
      }

      // Chunk diff
      const chunks = chunkDiff(diffResult.files, config.chunkSize);
      if (chunks.length > 1) {
        spinner.info(`Split into ${chunks.length} chunks for processing`);
      }

      // Process all chunks and collect responses
      const allResponses: Awaited<ReturnType<typeof runReviews>> = [];

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
        });
        spinner.succeed(chunks.length > 1
          ? `Chunk ${ci + 1}/${chunks.length} prompt built (${chunk.files.length} files)`
          : 'Prompt built');

        // If --estimate flag is set, calculate and display cost estimate
        if (options.estimate && ci === 0) {
          spinner.stop();
          const tokens = estimateTokens(prompt);
          const estimates: ModelEstimate[] = config.models.map(m => ({
            model: `${m.provider}/${m.model}`,
            tokens,
            cost: estimateCost(tokens, m.model),
          }));

          console.log(formatEstimate(estimates));
          console.log(chalk.dim('Note: This is an estimate. Actual costs may vary.\n'));
          process.exit(0);
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
          config.maxConcurrent
        );

        // Update spinners
        for (let i = 0; i < responses.length; i++) {
          const resp = responses[i];
          const ms = modelSpinners[i];
          if (resp.success) {
            ms.spinner.succeed(`${ms.provider} completed (${resp.durationMs}ms)`);
          } else {
            ms.spinner.fail(`${ms.provider} failed: ${resp.error}`);
          }
        }

        allResponses.push(...responses);
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
          } catch {
            // If parsing fails, keep existing
          }
          existing.durationMs += resp.durationMs;
          existing.success = existing.success || resp.success;
          if (resp.error && !existing.error) existing.error = resp.error;
        }
      }
      const mergedResponses = [...mergedByModel.values()];

      // Build consensus across merged model responses
      spinner.start('Building consensus');
      const diffFiles = diffResult.files.map(f => f.path);
      const result = await buildConsensus(mergedResponses, config, diffFiles);
      spinner.succeed(
        `Consensus built: ${result.findings.length} finding${result.findings.length !== 1 ? 's' : ''}`
      );

      // Output results
      let output: string;

      if (options.json) {
        output = formatJsonOutput(result);
      } else if (options.markdown) {
        output = formatMarkdownOutput(result);
      } else {
        output = formatTerminalOutput(result, options.verbose);
      }

      if (options.output) {
        await fs.writeFile(options.output, output, 'utf-8');
        console.log(chalk.green(`✓ Results written to ${options.output}`));
      } else {
        console.log(output);
      }

      // Post to GitHub if requested
      if (options.post) {
        const ghParsed = parseGitHubURL(target);
        if (!ghParsed) {
          console.log(chalk.yellow('⚠️  Cannot post to GitHub: target is not a GitHub PR'));
        } else {
          spinner.start('Posting to GitHub');
          try {
            await postToGitHub(result, {
              ...ghParsed,
              token: options.githubToken,
            });
            spinner.succeed('Posted to GitHub');
          } catch (error) {
            spinner.fail(
              `Failed to post to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }
      }

      // CI mode: exit with error if critical/high findings
      if (options.ci) {
        const criticalOrHigh = result.findings.filter(
          f => f.severity === 'critical' || f.severity === 'high'
        );
        if (criticalOrHigh.length > 0) {
          console.log(
            chalk.red(
              `\n❌ CI check failed: ${criticalOrHigh.length} critical/high severity issue${criticalOrHigh.length !== 1 ? 's' : ''} found`
            )
          );
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
