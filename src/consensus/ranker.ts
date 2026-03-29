import { ConsensusFinding, SEVERITY_LEVELS } from './types.js';

export function rankFindings(findings: ConsensusFinding[]): ConsensusFinding[] {
  return [...findings].sort((a, b) => {
    // 1. Sort by severity (highest first)
    const severityDiff = SEVERITY_LEVELS[b.severity] - SEVERITY_LEVELS[a.severity];
    if (severityDiff !== 0) return severityDiff;

    // 2. Sort by consensus score (highest first)
    const consensusDiff = b.consensusScore - a.consensusScore;
    if (consensusDiff !== 0) return consensusDiff;

    // 3. Sort by file path (alphabetical)
    const fileDiff = a.file.localeCompare(b.file);
    if (fileDiff !== 0) return fileDiff;

    // 4. Sort by line number (lowest first)
    return a.line - b.line;
  });
}

export interface FindingSummary {
  total: number;
  byModels: Array<{ modelCount: number; count: number }>;
  bySeverity: Record<string, number>;
  unanimous: number;
  elevated: number;
}

export function summarizeFindings(findings: ConsensusFinding[]): FindingSummary {
  const byModels = new Map<number, number>();
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  let unanimous = 0;
  let elevated = 0;

  for (const finding of findings) {
    byModels.set(finding.modelCount, (byModels.get(finding.modelCount) || 0) + 1);
    bySeverity[finding.severity]++;
    if (finding.unanimous) unanimous++;
    if (finding.elevated) elevated++;
  }

  return {
    total: findings.length,
    byModels: Array.from(byModels.entries())
      .map(([modelCount, count]) => ({ modelCount, count }))
      .sort((a, b) => b.modelCount - a.modelCount),
    bySeverity,
    unanimous,
    elevated,
  };
}
