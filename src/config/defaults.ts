import { ReviewConfig, ModelConfig } from './schema.js';

export function getDefaultModels(): ModelConfig[] {
  const models: ModelConfig[] = [];

  // Only include models where API keys are available — no maxTokens by default (unconstrained)
  if (process.env.ANTHROPIC_API_KEY) {
    models.push({
      provider: 'anthropic' as const,
      model: 'claude-opus-4-6',
      apiKey: process.env.ANTHROPIC_API_KEY,
      temperature: 0.3,
    });
  }

  if (process.env.OPENAI_API_KEY) {
    models.push({
      provider: 'openai' as const,
      model: 'gpt-5.4',
      apiKey: process.env.OPENAI_API_KEY,
      temperature: 0.3,
    });
  }

  if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
    models.push({
      provider: 'google' as const,
      model: 'gemini-2.5-pro',
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
      temperature: 0.3,
    });
  }

  // Fallback: if no keys found, include all so errors are explicit
  if (models.length === 0) {
    return [
      { provider: 'anthropic' as const, model: 'claude-opus-4-6', temperature: 0.3 },
      { provider: 'openai' as const, model: 'gpt-5.4', temperature: 0.3 },
      { provider: 'google' as const, model: 'gemini-2.5-pro', temperature: 0.3 },
    ];
  }

  return models;
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
