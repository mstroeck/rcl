import { Finding, ConsensusFinding, Severity, elevateSeverity, SEVERITY_LEVELS } from './types.js';
import { FindingGroup, selectRepresentativeFinding } from './deduper.js';

export function voteOnFindings(
  groups: FindingGroup[],
  totalModels: number
): ConsensusFinding[] {
  return groups.map(group => {
    const representative = selectRepresentativeFinding(group);
    // Deduplicate models — same model can contribute multiple findings to a group
    const uniqueModels = [...new Set(group.findings.map(f => f.modelId))];
    const modelCount = uniqueModels.length;
    const consensusScore = modelCount / totalModels;
    const unanimous = modelCount === totalModels;

    // Severity elevation rules:
    // - 1/N models: use original severity
    // - 2/N models: elevate one level
    // - 3+ or N/N: elevate one level (capped at critical)
    let finalSeverity = representative.severity;
    let elevated = false;

    if (modelCount >= 2 && !unanimous) {
      finalSeverity = elevateSeverity(representative.severity);
      elevated = true;
    } else if (unanimous && totalModels >= 2) {
      finalSeverity = elevateSeverity(representative.severity);
      elevated = true;
    }

    const models = uniqueModels;

    return {
      ...representative,
      severity: finalSeverity,
      originalSeverity: representative.severity,
      elevated,
      consensusScore,
      modelCount,
      totalModels,
      unanimous,
      models,
    };
  });
}

export function filterByThresholds(
  findings: ConsensusFinding[],
  minConsensusScore: number,
  minSeverity: Severity,
  requireUnanimous: boolean
): ConsensusFinding[] {
  const minSeverityLevel = SEVERITY_LEVELS[minSeverity];

  return findings.filter(finding => {
    // Check consensus threshold
    if (finding.consensusScore < minConsensusScore) {
      return false;
    }

    // Check severity threshold
    if (SEVERITY_LEVELS[finding.severity] < minSeverityLevel) {
      return false;
    }

    // Check unanimous requirement
    if (requireUnanimous && !finding.unanimous) {
      return false;
    }

    return true;
  });
}
