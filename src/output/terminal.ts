import chalk from 'chalk';
import { ConsensusFinding, Severity } from '../consensus/types.js';
import { ConsensusResult } from '../consensus/index.js';
import { summarizeFindings } from '../consensus/ranker.js';

function getSeverityColor(severity: Severity): (text: string) => string {
  switch (severity) {
    case 'critical':
      return chalk.red.bold;
    case 'high':
      return chalk.red;
    case 'medium':
      return chalk.yellow;
    case 'low':
      return chalk.blue;
    case 'info':
      return chalk.gray;
  }
}

function getSeverityIcon(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🔵';
    case 'info':
      return 'ℹ️';
  }
}

export function formatTerminalOutput(result: ConsensusResult, verbose: boolean = false): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  lines.push(chalk.bold.cyan('           🏛️  Review Council Results'));
  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  lines.push('');

  // Model status
  lines.push(chalk.bold('Models:'));
  for (const review of result.reviews) {
    const status = review.success ? chalk.green('✓') : chalk.red('✗');
    const duration = chalk.gray(`(${review.durationMs}ms)`);
    lines.push(`  ${status} ${review.provider}/${review.model} ${duration}`);
    if (!review.success && review.error) {
      lines.push(chalk.red(`    Error: ${review.error}`));
    } else if (review.success) {
      lines.push(chalk.gray(`    Found ${review.findings.length} issue${review.findings.length !== 1 ? 's' : ''}`));
    }
  }
  lines.push('');

  // Summary
  const summary = summarizeFindings(result.findings);
  lines.push(chalk.bold('Summary:'));
  lines.push(`  Total findings: ${chalk.bold(summary.total.toString())}`);
  lines.push(`  Unanimous: ${chalk.bold(summary.unanimous.toString())}`);
  lines.push(`  Elevated: ${chalk.bold(summary.elevated.toString())}`);
  lines.push('');

  lines.push(chalk.bold('By Severity:'));
  for (const [severity, count] of Object.entries(summary.bySeverity)) {
    if (count > 0) {
      const color = getSeverityColor(severity as Severity);
      lines.push(`  ${color(severity.padEnd(8))}: ${count}`);
    }
  }
  lines.push('');

  lines.push(chalk.bold('By Consensus:'));
  for (const { modelCount, count } of summary.byModels) {
    const percentage = result.successCount > 0 ? Math.round((modelCount / result.successCount) * 100) : 0;
    lines.push(`  ${modelCount}/${result.successCount} models (${percentage}%): ${count} finding${count !== 1 ? 's' : ''}`);
  }
  lines.push('');

  // Findings
  if (result.findings.length === 0) {
    lines.push(chalk.green.bold('✨ No issues found!'));
    lines.push('');
    return lines.join('\n');
  }

  lines.push(chalk.bold('Findings:'));
  lines.push('');

  for (let i = 0; i < result.findings.length; i++) {
    const finding = result.findings[i];
    const num = chalk.gray(`[${i + 1}/${result.findings.length}]`);
    const icon = getSeverityIcon(finding.severity);
    const severity = getSeverityColor(finding.severity)(finding.severity.toUpperCase());

    lines.push(`${num} ${icon} ${severity} ${chalk.bold(finding.category)}`);
    lines.push(`    ${chalk.cyan(`${finding.file}:${finding.line}`)}`);
    lines.push(`    ${finding.message}`);

    // Consensus info
    const consensus = Math.round(finding.consensusScore * 100);
    const models = chalk.gray(`[${finding.models.join(', ')}]`);
    let consensusLine = `    ${chalk.bold('Consensus:')} ${consensus}% (${finding.modelCount}/${finding.totalModels} models)`;

    if (finding.unanimous) {
      consensusLine += chalk.green.bold(' ✓ UNANIMOUS');
    }
    if (finding.elevated) {
      consensusLine += chalk.yellow(` ⬆ Elevated from ${finding.originalSeverity}`);
    }

    lines.push(consensusLine);
    lines.push(`    ${chalk.gray('Models:')} ${models}`);

    if (verbose && finding.suggestion) {
      lines.push(`    ${chalk.bold('Suggestion:')} ${finding.suggestion}`);
    }

    lines.push('');
  }

  lines.push(chalk.bold.cyan('═══════════════════════════════════════════════════'));
  lines.push('');

  return lines.join('\n');
}

export function formatSpinner(message: string, provider?: string): string {
  if (provider) {
    return `${message} ${chalk.gray(`[${provider}]`)}`;
  }
  return message;
}
