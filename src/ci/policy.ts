import { ConsensusFinding, SEVERITY_LEVELS, Severity } from '../consensus/types.js';
import { PolicyConfig } from '../config/schema.js';

export interface PolicyResult {
  passed: boolean;
  blockingFindings: ConsensusFinding[];
  summary: string;
  exitCode: number;
}

/**
 * Default policy configuration for CI mode
 */
export const DEFAULT_POLICY: PolicyConfig = {
  failOn: 'high',
  requireConsensus: 1,
  ignoreCategories: [],
};

/**
 * Evaluate findings against CI policy
 */
export function evaluatePolicy(
  findings: ConsensusFinding[],
  policy: PolicyConfig = DEFAULT_POLICY
): PolicyResult {
  const failOnLevel = SEVERITY_LEVELS[policy.failOn];

  // Filter findings based on policy
  const blockingFindings = findings.filter(finding => {
    // Check severity threshold
    if (SEVERITY_LEVELS[finding.severity] < failOnLevel) {
      return false;
    }

    // Check consensus requirement
    if (finding.modelCount < policy.requireConsensus) {
      return false;
    }

    // Check category filters
    if (policy.categories && policy.categories.length > 0) {
      if (!policy.categories.includes(finding.category)) {
        return false;
      }
    }

    // Check ignore categories
    if (policy.ignoreCategories.includes(finding.category)) {
      return false;
    }

    return true;
  });

  const passed = blockingFindings.length === 0;

  // Build summary
  const summary = buildPolicySummary(blockingFindings, policy, findings.length);

  return {
    passed,
    blockingFindings,
    summary,
    exitCode: passed ? 0 : 1,
  };
}

/**
 * Build a human-readable policy summary
 */
function buildPolicySummary(
  blockingFindings: ConsensusFinding[],
  policy: PolicyConfig,
  totalFindings: number
): string {
  if (blockingFindings.length === 0) {
    return `✓ No blocking findings (policy: severity >= ${policy.failOn}, consensus >= ${policy.requireConsensus})`;
  }

  const parts: string[] = [];

  // Group by severity
  const bySeverity: Record<string, number> = {};
  for (const finding of blockingFindings) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
  }

  const severityBreakdown = Object.entries(bySeverity)
    .sort((a, b) => SEVERITY_LEVELS[b[0] as Severity] - SEVERITY_LEVELS[a[0] as Severity])
    .map(([sev, count]) => `${count} ${sev}`)
    .join(', ');

  parts.push(`✗ ${blockingFindings.length} blocking finding${blockingFindings.length !== 1 ? 's' : ''}`);
  parts.push(`(${severityBreakdown})`);

  // Add policy criteria
  parts.push(`— policy: severity >= ${policy.failOn}, consensus >= ${policy.requireConsensus}`);

  if (totalFindings > blockingFindings.length) {
    const nonBlocking = totalFindings - blockingFindings.length;
    parts.push(`— ${nonBlocking} additional finding${nonBlocking !== 1 ? 's' : ''} below threshold`);
  }

  return parts.join(' ');
}

/**
 * Format findings for CI output
 */
export function formatCIFindings(findings: ConsensusFinding[]): string {
  if (findings.length === 0) {
    return '';
  }

  const lines: string[] = [];
  lines.push('');
  lines.push('Blocking findings:');
  lines.push('');

  for (const finding of findings) {
    const consensus = `${finding.modelCount}/${finding.totalModels} models`;
    lines.push(`  [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line}`);
    lines.push(`    Category: ${finding.category} (${consensus})`);
    lines.push(`    ${finding.message}`);
    if (finding.suggestion) {
      lines.push(`    → ${finding.suggestion}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
