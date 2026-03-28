import { ReviewConfig } from './schema.js';

export const DEFAULT_MODELS = [
  {
    provider: 'anthropic' as const,
    model: 'claude-sonnet-4-5-20250929',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.3,
    maxTokens: 4000,
  },
  {
    provider: 'openai' as const,
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
    maxTokens: 4000,
  },
  {
    provider: 'google' as const,
    model: 'gemini-2.5-flash',
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    temperature: 0.3,
    maxTokens: 4000,
  },
];

export const DEFAULT_CONFIG: Partial<ReviewConfig> = {
  models: DEFAULT_MODELS,
  thresholds: {
    minConsensusScore: 0,
    minSeverity: 'low',
    requireUnanimous: false,
  },
  timeout: 180,
  maxConcurrent: 5,
  includeFixSuggestions: true,
  promptHardening: true,
  chunkSize: 30000,
  nearMatchThreshold: 5,
};
