import { Octokit } from '@octokit/rest';
import { ConsensusResult } from '../consensus/index.js';
import { formatMarkdownOutput } from './markdown.js';
import { parseDiffPositions } from './diff-position.js';

export interface GitHubPostOptions {
  owner: string;
  repo: string;
  prNumber: number;
  token?: string;
}

export async function postToGitHub(
  result: ConsensusResult,
  options: GitHubPostOptions
): Promise<void> {
  const octokit = new Octokit({
    auth: options.token || process.env.GITHUB_TOKEN,
  });

  const body = formatMarkdownOutput(result);

  try {
    await octokit.issues.createComment({
      owner: options.owner,
      repo: options.repo,
      issue_number: options.prNumber,
      body,
    });
  } catch (error) {
    throw new Error(
      `Failed to post to GitHub: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function createReviewComments(
  result: ConsensusResult,
  options: GitHubPostOptions
): Promise<void> {
  const octokit = new Octokit({
    auth: options.token || process.env.GITHUB_TOKEN,
  });

  try {
    // Get PR to find the head commit SHA
    const { data: pr } = await octokit.pulls.get({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.prNumber,
    });

    // Fetch file patches to build diff position maps
    const { data: files } = await octokit.pulls.listFiles({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.prNumber,
    });

    // Build a map of file path to diff positions
    const filePatchMaps = new Map<string, Map<number, number>>();
    for (const file of files) {
      if (file.patch) {
        filePatchMaps.set(file.filename, parseDiffPositions(file.patch));
      }
    }

    const comments: Array<{ path: string; position: number; body: string }> = [];
    const unmappableFindings: string[] = [];

    for (const finding of result.findings) {
      const consensus = Math.round(finding.consensusScore * 100);
      let body = `**${finding.severity.toUpperCase()}** - ${finding.category}\n\n`;
      body += `${finding.message}\n\n`;
      body += `**Consensus**: ${consensus}% (${finding.modelCount}/${finding.totalModels} models)`;

      if (finding.unanimous) {
        body += ' ✅ UNANIMOUS';
      }
      if (finding.elevated) {
        body += ` ⬆️ Elevated from \`${finding.originalSeverity}\``;
      }

      body += `\n\n**Suggestion**: ${finding.suggestion}`;
      body += `\n\n*Models: ${finding.models.join(', ')}*`;

      // Look up the diff position for this finding
      const positionMap = filePatchMaps.get(finding.file);
      const position = positionMap?.get(finding.line);

      if (position !== undefined) {
        comments.push({
          path: finding.file,
          position,
          body,
        });
      } else {
        // Line not in diff - include in review body instead
        unmappableFindings.push(
          `- **${finding.file}:${finding.line}** - ${finding.severity.toUpperCase()}: ${finding.message}`
        );
      }
    }

    // Build review body with unmappable findings
    let reviewBody = '';
    if (unmappableFindings.length > 0) {
      reviewBody =
        '## Findings on unchanged lines\n\n' +
        'The following findings are on lines not modified in this PR:\n\n' +
        unmappableFindings.join('\n');
    }

    await octokit.pulls.createReview({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.prNumber,
      commit_id: pr.head.sha,
      event: 'COMMENT',
      body: reviewBody || undefined,
      comments: comments.length > 0 ? comments : undefined,
    });
  } catch (error) {
    throw new Error(
      `Failed to create review comments: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
