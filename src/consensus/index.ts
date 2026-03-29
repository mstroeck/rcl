import { ReviewResponse } from '../dispatch/adapter.js';
import { ReviewConfig } from '../config/schema.js';
import { parseAllReviews, validateFindings } from './parser.js';
import { deduplicateFindings } from './deduper.js';
import { voteOnFindings, filterByThresholds } from './voter.js';
import { rankFindings } from './ranker.js';
import { ConsensusFinding, ModelReview } from './types.js';

export interface ConsensusResult {
  findings: ConsensusFinding[];
  reviews: ModelReview[];
  successCount: number;
  failureCount: number;
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

  return {
    findings: ranked,
    reviews,
    successCount,
    failureCount,
  };
}

export * from './types.js';
export * from './parser.js';
export * from './deduper.js';
export * from './voter.js';
export * from './ranker.js';
