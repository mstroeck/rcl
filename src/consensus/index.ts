import { ReviewResponse } from '../dispatch/adapter.js';
import { ReviewConfig } from '../config/schema.js';
import { parseAllReviews, validateFindings } from './parser.js';
import { deduplicateFindings } from './deduper.js';
import { voteOnFindings, filterByThresholds } from './voter.js';
import { rankFindings } from './ranker.js';
import { ConsensusFinding, ModelReview, Finding } from './types.js';

export interface DisagreementFinding {
  finding: Finding;
  modelId: string;
  reason: 'single-model' | 'severity-disagreement';
  severityRange?: { min: string; max: string }; // For severity disagreements
}

export interface ConsensusResult {
  findings: ConsensusFinding[];
  reviews: ModelReview[];
  successCount: number;
  failureCount: number;
  disagreements: DisagreementFinding[];
}

export async function buildConsensus(
  responses: ReviewResponse[],
  config: ReviewConfig,
  diffFiles: string[]
): Promise<ConsensusResult> {
  // Parse all reviews
  const reviews = parseAllReviews(responses);

  // Count successes and failures
  const successCount = reviews.filter(r => r.success).length;
  const failureCount = reviews.filter(r => !r.success).length;

  // Only process successful reviews
  const successfulReviews = reviews.filter(r => r.success);

  if (successfulReviews.length === 0) {
    return {
      findings: [],
      reviews,
      successCount,
      failureCount,
      disagreements: [],
    };
  }

  // Validate findings against actual diff files
  const validatedReviews = successfulReviews.map(review => ({
    ...review,
    findings: validateFindings(review.findings, diffFiles),
  }));

  // Prepare findings with model IDs
  const reviewsWithIds = validatedReviews.map(review => ({
    modelId: `${review.provider}/${review.model}`,
    findings: review.findings,
  }));

  // Deduplicate findings across models
  const groups = deduplicateFindings(reviewsWithIds, config.nearMatchThreshold);

  // Vote on findings and elevate severity
  const consensusFindings = voteOnFindings(groups, successfulReviews.length);

  // Filter by thresholds
  const filtered = filterByThresholds(
    consensusFindings,
    config.thresholds.minConsensusScore,
    config.thresholds.minSeverity,
    config.thresholds.requireUnanimous
  );

  // Rank findings
  const ranked = rankFindings(filtered);

  // Analyze disagreements
  const disagreements = analyzeDisagreements(
    groups,
    consensusFindings,
    validatedReviews.map(r => ({
      modelId: `${r.provider}/${r.model}`,
      findings: r.findings,
    }))
  );

  return {
    findings: ranked,
    reviews,
    successCount,
    failureCount,
    disagreements,
  };
}

function analyzeDisagreements(
  groups: ReturnType<typeof deduplicateFindings>,
  consensusFindings: ConsensusFinding[],
  reviews: Array<{ modelId: string; findings: Finding[] }>
): DisagreementFinding[] {
  const disagreements: DisagreementFinding[] = [];

  // 1. Identify single-model findings (modelCount === 1)
  for (const consensus of consensusFindings) {
    if (consensus.modelCount === 1 && consensus.totalModels > 1) {
      // Find the corresponding group
      const group = groups.find(g => {
        const rep = g.findings[0].finding;
        return (
          rep.file === consensus.file &&
          rep.line === consensus.line &&
          rep.category === consensus.category
        );
      });

      if (group && group.findings.length > 0) {
        const { finding, modelId } = group.findings[0];
        disagreements.push({
          finding,
          modelId,
          reason: 'single-model',
        });
      }
    }
  }

  // 2. Identify severity disagreements within groups
  // Only look at groups with findings from multiple UNIQUE models
  for (const group of groups) {
    // Get unique models in this group
    const uniqueModels = [...new Set(group.findings.map(f => f.modelId))];

    if (uniqueModels.length >= 2) {
      // Check if different models reported different severities
      const severities = group.findings.map(f => f.finding.severity);
      const uniqueSeverities = new Set(severities);

      if (uniqueSeverities.size > 1) {
        // There's a severity disagreement
        const severityLevels = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
        const levels = severities.map(s => severityLevels[s]);
        const minLevel = Math.min(...levels);
        const maxLevel = Math.max(...levels);
        const minSev = Object.keys(severityLevels).find(
          k => severityLevels[k as keyof typeof severityLevels] === minLevel
        )!;
        const maxSev = Object.keys(severityLevels).find(
          k => severityLevels[k as keyof typeof severityLevels] === maxLevel
        )!;

        // Add each finding with severity disagreement
        for (const { finding, modelId } of group.findings) {
          disagreements.push({
            finding,
            modelId,
            reason: 'severity-disagreement',
            severityRange: { min: minSev, max: maxSev },
          });
        }
      }
    }
  }

  return disagreements;
}

export * from './types.js';
export * from './parser.js';
export * from './deduper.js';
export * from './voter.js';
export * from './ranker.js';
