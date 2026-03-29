import { Octokit } from '@octokit/rest';
import { ConsensusResult } from '../consensus/index.js';
import { formatMarkdownOutput } from './markdown.js';

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

    const comments = result.findings.map(finding => {
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

      return {
        path: finding.file,
        line: finding.line,
        body,
      };
    });

    await octokit.pulls.createReview({
      owner: options.owner,
      repo: options.repo,
      pull_number: options.prNumber,
      commit_id: pr.head.sha,
      event: 'COMMENT',
      comments,
    });
  } catch (error) {
    throw new Error(
      `Failed to create review comments: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
