import { describe, it, expect } from 'vitest';
import {
  getModelCapabilities,
  supportsCapability,
  getTokenParameterName,
} from './capabilities.js';

describe('capabilities', () => {
  describe('getModelCapabilities', () => {
    it('should return o1 capabilities for reasoning models', () => {
      const caps = getModelCapabilities('o1');
      expect(caps.supportsTemperature).toBe(false);
      expect(caps.supportsResponseFormat).toBe(false);
      expect(caps.usesCompletionTokens).toBe(true);
      expect(caps.supportsJSON).toBe(true);
    });

    it('should handle o3 variants', () => {
      expect(getModelCapabilities('o3').supportsTemperature).toBe(false);
      expect(getModelCapabilities('o3-mini').supportsTemperature).toBe(false);
      expect(getModelCapabilities('o1-preview').usesCompletionTokens).toBe(true);
    });

    it('should return GPT-5+ capabilities', () => {
      const caps = getModelCapabilities('gpt-5-turbo');
      expect(caps.usesCompletionTokens).toBe(true);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.supportsToolCalling).toBe(true);
    });

    it('should handle future GPT versions', () => {
      expect(getModelCapabilities('gpt-6').usesCompletionTokens).toBe(true);
      expect(getModelCapabilities('gpt-10-ultra').usesCompletionTokens).toBe(true);
    });

    it('should return GPT-4 capabilities', () => {
      const caps = getModelCapabilities('gpt-4-turbo');
      expect(caps.usesCompletionTokens).toBe(false);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.supportsToolCalling).toBe(true);
      expect(caps.supportsResponseFormat).toBe(true);
    });

    it('should return Claude capabilities', () => {
      const caps = getModelCapabilities('claude-3-opus');
      expect(caps.supportsToolCalling).toBe(true);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.supportsResponseFormat).toBe(false);
      expect(caps.maxContext).toBe(200000);
    });

    it('should return Gemini capabilities', () => {
      const caps = getModelCapabilities('gemini-1.5-pro');
      expect(caps.supportsJSON).toBe(true);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.maxContext).toBe(2000000);
    });

    it('should return default capabilities for unknown models', () => {
      const caps = getModelCapabilities('some-future-model');
      expect(caps.supportsJSON).toBe(true);
      expect(caps.supportsTemperature).toBe(true);
      expect(caps.usesCompletionTokens).toBe(false);
    });
  });

  describe('supportsCapability', () => {
    it('should check specific capabilities', () => {
      expect(supportsCapability('o1', 'supportsTemperature')).toBe(false);
      expect(supportsCapability('gpt-4', 'supportsTemperature')).toBe(true);
      expect(supportsCapability('claude-3-opus', 'supportsToolCalling')).toBe(true);
    });
  });

  describe('getTokenParameterName', () => {
    it('should return max_completion_tokens for reasoning models', () => {
      expect(getTokenParameterName('o1')).toBe('max_completion_tokens');
      expect(getTokenParameterName('o3-mini')).toBe('max_completion_tokens');
    });

    it('should return max_completion_tokens for GPT-5+', () => {
      expect(getTokenParameterName('gpt-5')).toBe('max_completion_tokens');
      expect(getTokenParameterName('gpt-10-turbo')).toBe('max_completion_tokens');
    });

    it('should return max_tokens for GPT-4', () => {
      expect(getTokenParameterName('gpt-4')).toBe('max_tokens');
      expect(getTokenParameterName('gpt-4-turbo')).toBe('max_tokens');
    });

    it('should return max_tokens for Claude', () => {
      expect(getTokenParameterName('claude-3-opus')).toBe('max_tokens');
    });
  });
});
