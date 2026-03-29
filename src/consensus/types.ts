import { z } from 'zod';

export const SeveritySchema = z.enum(['info', 'low', 'medium', 'high', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  severity: SeveritySchema,
  category: z.string(),
  message: z.string(),
  suggestion: z.string(),
});

export type Finding = z.infer<typeof FindingSchema>;

export const ModelReviewSchema = z.object({
  provider: z.string(),
  model: z.string(),
  findings: z.array(FindingSchema),
  success: z.boolean(),
  error: z.string().optional(),
  durationMs: z.number(),
});

export type ModelReview = z.infer<typeof ModelReviewSchema>;

export interface ConsensusFinding extends Finding {
  consensusScore: number; // 0-1, percentage of models that agree
  modelCount: number; // Number of models that found this
  totalModels: number; // Total models in review
  unanimous: boolean; // All models agree
  originalSeverity: Severity; // Severity before elevation
  elevated: boolean; // Whether severity was elevated
  models: string[]; // Which models found this
}

export const SEVERITY_LEVELS: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function elevateSeverity(severity: Severity): Severity {
  const level = SEVERITY_LEVELS[severity];
  if (level >= 4) return 'critical';

  const levels: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
  return levels[level + 1];
}
