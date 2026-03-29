import { z } from 'zod';

export const ModelConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'openai-compat']),
  model: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).default(0.3),
  maxTokens: z.number().positive().default(4000),
});

export const ThresholdConfigSchema = z.object({
  minConsensusScore: z.number().min(0).max(1).default(0.5),
  minSeverity: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('low'),
  requireUnanimous: z.boolean().default(false),
});

export const ReviewConfigSchema = z.object({
  models: z.array(ModelConfigSchema).min(1),
  thresholds: ThresholdConfigSchema.default({}),
  timeout: z.number().positive().default(180),
  maxConcurrent: z.number().positive().default(5),
  includeFixSuggestions: z.boolean().default(true),
  promptHardening: z.boolean().default(true),
  chunkSize: z.number().positive().default(2000),
  nearMatchThreshold: z.number().positive().default(5),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;

export const ConfigSchema = ReviewConfigSchema;
