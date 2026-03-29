import { ReviewConfig, ModelConfig } from './schema.js';

export function getDefaultModels(): ModelConfig[] {
  return [
    {
      provider: 'anthropic' as const,
      model: 'claude-opus-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      temperature: 0.3,
      maxTokens: 16000,
    },
    {
      provider: 'openai' as const,
      model: 'gpt-5.4',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.3,
      maxTokens: 16000,
    },
    {
      provider: 'google' as const,
      model: 'gemini-3-pro-preview',
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      temperature: 0.3,
      maxTokens: 16000,
    },
  ];
}

// Note: models are lazily evaluated via getDefaultModels() in loader.ts
// to ensure API keys are read from env at runtime, not import time
export const DEFAULT_CONFIG: Partial<ReviewConfig> = {
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
