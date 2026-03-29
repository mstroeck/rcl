import { Finding } from './types.js';

export interface FindingGroup {
  findings: Array<{ finding: Finding; modelId: string }>;
  file: string;
  lineRange: { start: number; end: number };
}

export function deduplicateFindings(
  reviews: Array<{ modelId: string; findings: Finding[] }>,
  nearMatchThreshold: number
): FindingGroup[] {
  const allFindings = reviews.flatMap(review =>
    review.findings.map(finding => ({
      finding,
      modelId: review.modelId,
    }))
  );

  const groups: FindingGroup[] = [];

  for (const current of allFindings) {
    let matched = false;

    // Try to find existing group
    for (const group of groups) {
      if (isMatchingFinding(current.finding, group, nearMatchThreshold)) {
        // Add to existing group
        group.findings.push(current);
        // Expand line range if needed
        group.lineRange.start = Math.min(group.lineRange.start, current.finding.line);
        group.lineRange.end = Math.max(group.lineRange.end, current.finding.line);
        matched = true;
        break;
      }
    }

    // Create new group if no match
    if (!matched) {
      groups.push({
        findings: [current],
        file: current.finding.file,
        lineRange: {
          start: current.finding.line,
          end: current.finding.line,
        },
      });
    }
  }

  return groups;
}

function isMatchingFinding(
  finding: Finding,
  group: FindingGroup,
  threshold: number
): boolean {
  // Must be same file
  if (finding.file !== group.file) {
    return false;
  }

  // Check if lines overlap or are within threshold
  const lineDistance = Math.min(
    Math.abs(finding.line - group.lineRange.start),
    Math.abs(finding.line - group.lineRange.end)
  );

  if (lineDistance > threshold) {
    return false;
  }

  // Check for semantic similarity in messages
  // Simple heuristic: same category or similar keywords
  const currentCategories = group.findings.map(f => f.finding.category.toLowerCase());
  if (currentCategories.includes(finding.category.toLowerCase())) {
    return true;
  }

  // Check message similarity (very basic)
  const findingWords = new Set(
    finding.message.toLowerCase().split(/\W+/).filter(w => w.length > 3)
  );

  // Skip word overlap check if either set is empty (e.g., "XSS" or "IDOR")
  if (findingWords.size === 0) {
    return false;
  }

  for (const grouped of group.findings) {
    const groupedWords = new Set(
      grouped.finding.message.toLowerCase().split(/\W+/).filter(w => w.length > 3)
    );

    // Skip if the grouped finding has no significant words
    if (groupedWords.size === 0) {
      continue;
    }

    const intersection = new Set(
      [...findingWords].filter(w => groupedWords.has(w))
    );

    // Require at least 2 overlapping words and >30% overlap ratio
    const overlapRatio = intersection.size / Math.min(findingWords.size, groupedWords.size);
    if (intersection.size >= 2 && overlapRatio > 0.3) {
      return true;
    }
  }

  return false;
}

export function selectRepresentativeFinding(group: FindingGroup): Finding {
  // Prefer the finding with highest severity
  const sorted = [...group.findings].sort((a, b) => {
    const severityOrder = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    const aSev = severityOrder[a.finding.severity] || 0;
    const bSev = severityOrder[b.finding.severity] || 0;

    if (aSev !== bSev) return bSev - aSev;

    // Then prefer longer, more detailed messages
    return b.finding.message.length - a.finding.message.length;
  });

  return sorted[0].finding;
}
