/**
 * Model capability profiles for provider-agnostic dispatch
 *
 * Different LLM models support different features:
 * - Reasoning models (o1, o3) don't support temperature or response_format
 * - GPT-5+ uses max_completion_tokens instead of max_tokens
 * - Claude supports tool calling (structured output)
 * - Gemini supports JSON mode via responseMimeType
 */

export interface ModelCapabilities {
  /** Whether the model supports JSON response format / structured output */
  supportsJSON: boolean;
  /** Whether the model supports tool calling (e.g., Claude's tool_use) */
  supportsToolCalling: boolean;
  /** Whether the model supports temperature parameter */
  supportsTemperature: boolean;
  /** Whether the model supports response_format parameter */
  supportsResponseFormat: boolean;
  /** Maximum context window size in tokens */
  maxContext: number;
  /** Maximum output tokens */
  maxOutput: number;
  /** Whether to use max_completion_tokens instead of max_tokens */
  usesCompletionTokens: boolean;
}

/**
 * Capability profile with regex pattern for model matching
 */
export interface CapabilityProfile {
  pattern: RegExp;
  capabilities: ModelCapabilities;
}

/**
 * Default capabilities for models we don't have explicit profiles for
 */
const DEFAULT_CAPABILITIES: ModelCapabilities = {
  supportsJSON: true,
  supportsToolCalling: false,
  supportsTemperature: true,
  supportsResponseFormat: true,
  maxContext: 128000,
  maxOutput: 4096,
  usesCompletionTokens: false,
};

/**
 * Known capability profiles, ordered by specificity (most specific first)
 */
const CAPABILITY_PROFILES: CapabilityProfile[] = [
  // OpenAI reasoning models (o1, o3, o3-mini)
  {
    pattern: /^o[1-9](-mini|-preview)?$/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: false,
      supportsTemperature: false,
      supportsResponseFormat: false,
      maxContext: 200000,
      maxOutput: 100000,
      usesCompletionTokens: true,
    },
  },
  // GPT-5+ and future versions (gpt-5, gpt-6, gpt-10, etc.)
  {
    pattern: /^gpt-([5-9]|[1-9]\d+)/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: true,
      supportsTemperature: true,
      supportsResponseFormat: true,
      maxContext: 128000,
      maxOutput: 16384,
      usesCompletionTokens: true,
    },
  },
  // GPT-4 family
  {
    pattern: /^gpt-4/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: true,
      supportsTemperature: true,
      supportsResponseFormat: true,
      maxContext: 128000,
      maxOutput: 4096,
      usesCompletionTokens: false,
    },
  },
  // GPT-3.5
  {
    pattern: /^gpt-3\.5/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: true,
      supportsTemperature: true,
      supportsResponseFormat: true,
      maxContext: 16385,
      maxOutput: 4096,
      usesCompletionTokens: false,
    },
  },
  // Claude models (all support tool calling)
  {
    pattern: /^claude-/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: true,
      supportsTemperature: true,
      supportsResponseFormat: false, // Uses tools instead
      maxContext: 200000,
      maxOutput: 8192,
      usesCompletionTokens: false,
    },
  },
  // Gemini models
  {
    pattern: /^gemini-/,
    capabilities: {
      supportsJSON: true,
      supportsToolCalling: true,
      supportsTemperature: true,
      supportsResponseFormat: true, // Via responseMimeType
      maxContext: 2000000,
      maxOutput: 8192,
      usesCompletionTokens: false,
    },
  },
];

/**
 * Get capabilities for a given model name
 * @param modelName The model identifier (e.g., "gpt-4", "claude-3-opus", "o1-preview")
 * @returns The model's capabilities
 */
export function getModelCapabilities(modelName: string): ModelCapabilities {
  for (const profile of CAPABILITY_PROFILES) {
    if (profile.pattern.test(modelName)) {
      return profile.capabilities;
    }
  }

  // Return default capabilities for unknown models
  return DEFAULT_CAPABILITIES;
}

/**
 * Check if a model supports a specific capability
 */
export function supportsCapability(
  modelName: string,
  capability: keyof ModelCapabilities
): boolean {
  const caps = getModelCapabilities(modelName);
  const value = caps[capability];
  return typeof value === 'boolean' ? value : false;
}

/**
 * Get the appropriate token parameter name for a model
 */
export function getTokenParameterName(modelName: string): 'max_tokens' | 'max_completion_tokens' {
  const caps = getModelCapabilities(modelName);
  return caps.usesCompletionTokens ? 'max_completion_tokens' : 'max_tokens';
}
