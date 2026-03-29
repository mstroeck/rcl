import { ConsensusResult, DisagreementFinding } from '../consensus/index.js';
import { summarizeFindings } from '../consensus/ranker.js';
import { Severity } from '../consensus/types.js';

function getSeverityEmoji(severity: Severity): string {
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

export function formatMarkdownOutput(result: ConsensusResult, showDisagreements: boolean = false): string {
  const lines: string[] = [];

  // Header
  lines.push('# 🏛️ Review Council Report\n');

  // Summary
  const summary = summarizeFindings(result.findings);
  lines.push('## Summary\n');
  lines.push(`- **Total Findings**: ${summary.total}`);
  lines.push(`- **Unanimous**: ${summary.unanimous}`);
  lines.push(`- **Elevated**: ${summary.elevated}`);
  lines.push(`- **Models**: ${result.successCount} successful, ${result.failureCount} failed\n`);

  // Severity breakdown
  lines.push('### By Severity\n');
  for (const [severity, count] of Object.entries(summary.bySeverity)) {
    if (count > 0) {
      const emoji = getSeverityEmoji(severity as Severity);
      lines.push(`- ${emoji} **${severity}**: ${count}`);
    }
  }
  lines.push('');

  // Consensus breakdown
  lines.push('### By Consensus\n');
  for (const { modelCount, count } of summary.byModels) {
    const percentage = result.successCount > 0 ? Math.round((modelCount / result.successCount) * 100) : 0;
    lines.push(`- **${modelCount}/${result.successCount}** models (${percentage}%): ${count} finding${count !== 1 ? 's' : ''}`);
  }
  lines.push('');

  // Model results
  lines.push('## Model Results\n');
  for (const review of result.reviews) {
    const status = review.success ? '✅' : '❌';
    lines.push(`### ${status} ${review.provider}/${review.model}\n`);
    lines.push(`- **Status**: ${review.success ? 'Success' : 'Failed'}`);
    lines.push(`- **Duration**: ${review.durationMs}ms`);
    if (review.success) {
      lines.push(`- **Findings**: ${review.findings.length}`);
    }
    if (!review.success && review.error) {
      lines.push(`- **Error**: ${review.error}`);
    }
    lines.push('');
  }

  // Findings
  if (result.findings.length === 0) {
    lines.push('## ✨ No Issues Found!\n');
    return lines.join('\n');
  }

  lines.push('## Findings\n');

  for (let i = 0; i < result.findings.length; i++) {
    const finding = result.findings[i];
    const emoji = getSeverityEmoji(finding.severity);

    lines.push(`### ${i + 1}. ${emoji} ${finding.severity.toUpperCase()} - ${finding.category}\n`);
    lines.push(`**Location**: \`${finding.file}:${finding.line}\`\n`);
    lines.push(`**Message**: ${finding.message}\n`);

    // Consensus info
    const consensus = Math.round(finding.consensusScore * 100);
    let consensusText = `**Consensus**: ${consensus}% (${finding.modelCount}/${finding.totalModels} models)`;

    if (finding.unanimous) {
      consensusText += ' ✅ **UNANIMOUS**';
    }
    if (finding.elevated) {
      consensusText += ` ⬆️ Elevated from \`${finding.originalSeverity}\``;
    }

    lines.push(consensusText + '\n');
    lines.push(`**Models**: ${finding.models.join(', ')}\n`);

    if (finding.suggestion) {
      lines.push(`**Suggestion**: ${finding.suggestion}\n`);
    }

    lines.push('---\n');
  }

  // Disagreements section
  if (showDisagreements && result.disagreements.length > 0) {
    lines.push('## ⚠️ Disagreements\n');

    const singleModel = result.disagreements.filter(d => d.reason === 'single-model');
    const severityDisagreements = result.disagreements.filter(d => d.reason === 'severity-disagreement');

    if (singleModel.length > 0) {
      lines.push('### Single-Model Findings\n');
      lines.push('These findings were flagged by only 1 model:\n');
      for (const dis of singleModel) {
        const emoji = getSeverityEmoji(dis.finding.severity);
        lines.push(`- ${emoji} **${dis.finding.severity}** - ${dis.finding.category} at \`${dis.finding.file}:${dis.finding.line}\``);
        lines.push(`  - Model: ${dis.modelId}`);
        lines.push(`  - ${dis.finding.message}\n`);
      }
    }

    if (severityDisagreements.length > 0) {
      lines.push('### Severity Disagreements\n');
      lines.push('Models disagree on severity for these findings:\n');

      // Group by file:line
      const grouped = new Map<string, DisagreementFinding[]>();
      for (const dis of severityDisagreements) {
        const key = `${dis.finding.file}:${dis.finding.line}`;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(dis);
      }

      for (const [location, findings] of grouped.entries()) {
        lines.push(`#### \`${location}\` - ${findings[0].finding.category}\n`);
        if (findings[0].severityRange) {
          lines.push(`Severity range: **${findings[0].severityRange.min}** to **${findings[0].severityRange.max}**\n`);
        }
        for (const f of findings) {
          const emoji = getSeverityEmoji(f.finding.severity);
          lines.push(`- ${f.modelId}: ${emoji} ${f.finding.severity}`);
        }
        lines.push('');
      }
    }
  }

  lines.push('*Generated by Review Council*');

  return lines.join('\n');
}
