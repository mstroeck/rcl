import { ReviewConfig } from './schema.js';

export const DEFAULT_MODELS = [
  {
    provider: 'anthropic' as const,
    model: 'claude-opus-4-6',
    apiKey: process.env.ANTHROPIC_API_KEY,
    temperature: 0.3,
    maxTokens: 16000,
  },
  {
    provider: 'openai' as const,
    model: 'o3',
    apiKey: process.env.OPENAI_API_KEY,
    temperature: 0.3,
    maxTokens: 16000,
  },
  {
    provider: 'google' as const,
    model: 'gemini-2.5-pro',
    apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    temperature: 0.3,
    maxTokens: 16000,
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
