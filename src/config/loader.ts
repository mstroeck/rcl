import { cosmiconfig } from 'cosmiconfig';
import { ReviewConfig, ReviewConfigSchema } from './schema.js';
import { DEFAULT_CONFIG, getDefaultModels } from './defaults.js';

const explorer = cosmiconfig('review-council');

export async function loadConfig(override?: Partial<ReviewConfig>): Promise<ReviewConfig> {
  try {
    const result = await explorer.search();
    const fileConfig = result?.config || {};

    // Use getDefaultModels() to get fresh API keys from environment
    const defaultModels = getDefaultModels();

    const merged = {
      ...DEFAULT_CONFIG,
      models: defaultModels,
      ...fileConfig,
      ...override,
      thresholds: {
        ...DEFAULT_CONFIG.thresholds,
        ...fileConfig?.thresholds,
        ...override?.thresholds,
      },
    };

    // Validate with Zod
    const validated = ReviewConfigSchema.parse(merged);
    return validated;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Invalid configuration: ${error.message}`);
    }
    throw error;
  }
}

export async function getConfig(cliOptions?: {
  models?: string[];
  timeout?: number;
  verbose?: boolean;
}): Promise<ReviewConfig> {
  const override: Partial<ReviewConfig> = {};

  if (cliOptions?.models) {
    // Parse model names and map to configs
    override.models = cliOptions.models.map(name => {
      // Check if it's a provider/model format
      if (name.includes('/')) {
        const [provider, model] = name.split('/', 2);
        const providerLower = provider.toLowerCase();

        // Determine API key based on provider
        let apiKey: string | undefined;
        if (providerLower === 'anthropic') {
          apiKey = process.env.ANTHROPIC_API_KEY;
        } else if (providerLower === 'openai') {
          apiKey = process.env.OPENAI_API_KEY;
        } else if (providerLower === 'google') {
          apiKey = process.env.GOOGLE_API_KEY;
        }

        return {
          provider: providerLower as 'anthropic' | 'openai' | 'google',
          model,
          apiKey,
          temperature: 0.3,
          maxTokens: 4000,
        };
      }

      // Fall back to alias lookup — default to top-tier models, no token limits
      const lower = name.toLowerCase();
      if (lower.includes('claude') || lower.includes('anthropic')) {
        return {
          provider: 'anthropic' as const,
          model: 'claude-opus-4-6',
          apiKey: process.env.ANTHROPIC_API_KEY,
          temperature: 0.3,
        };
      } else if (lower.includes('gpt') || lower.includes('openai')) {
        return {
          provider: 'openai' as const,
          model: 'gpt-5.4',
          apiKey: process.env.OPENAI_API_KEY,
          temperature: 0.3,
        };
      } else if (lower.includes('gemini') || lower.includes('google')) {
        return {
          provider: 'google' as const,
          model: 'gemini-2.5-pro',
          apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
          temperature: 0.3,
        };
      }
      throw new Error(`Unknown model: ${name}`);
    });
  }

  if (cliOptions?.timeout) {
    override.timeout = cliOptions.timeout;
  }

  if (cliOptions?.verbose !== undefined) {
    override.includeFixSuggestions = cliOptions.verbose;
  }

  return loadConfig(override);
}
