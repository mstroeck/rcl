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

export const PolicyConfigSchema = z.object({
  failOn: z.enum(['info', 'low', 'medium', 'high', 'critical']).default('high'),
  requireConsensus: z.number().int().min(1).default(1),
  categories: z.array(z.string()).optional(),
  ignoreCategories: z.array(z.string()).default([]),
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
  retries: z.number().int().min(0).max(10).default(2),
  retryDelayMs: z.number().int().min(100).max(30000).default(1000),
  ignore: z.array(z.string()).default([]),
  include: z.array(z.string()).default([]),
  context: z.string().optional(),
  policy: PolicyConfigSchema.optional(),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>;
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;

export const ConfigSchema = ReviewConfigSchema;
