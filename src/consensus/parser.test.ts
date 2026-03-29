import { describe, it, expect } from 'vitest';
import { parseReviewResponse } from './parser.js';
import { ReviewResponse } from '../dispatch/adapter.js';

describe('parseReviewResponse', () => {
  it('should parse valid review response', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: JSON.stringify([
        {
          file: 'test.ts',
          line: 10,
          severity: 'high',
          category: 'security',
          message: 'Issue found',
          suggestion: 'Fix it',
        },
      ]),
      success: true,
      durationMs: 1000,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].file).toBe('test.ts');
    expect(result.findings[0].severity).toBe('high');
  });

  it('should handle failed responses', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: '',
      success: false,
      error: 'API error',
      durationMs: 100,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(false);
    expect(result.error).toBe('API error');
    expect(result.findings).toHaveLength(0);
  });

  it('should filter out invalid findings', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: JSON.stringify([
        {
          file: 'test.ts',
          line: 10,
          severity: 'high',
          category: 'security',
          message: 'Valid finding',
          suggestion: 'Fix it',
        },
        {
          file: 'test.ts',
          // Missing line
          severity: 'high',
          category: 'security',
          message: 'Invalid finding',
          suggestion: 'Fix it',
        },
        {
          file: 'test.ts',
          line: 20,
          severity: 'invalid', // Invalid severity
          category: 'security',
          message: 'Another invalid',
          suggestion: 'Fix it',
        },
      ]),
      success: true,
      durationMs: 1000,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].message).toBe('Valid finding');
  });

  it('should handle malformed JSON', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: 'not valid json',
      success: true,
      durationMs: 1000,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to parse response');
  });

  it('should handle empty array', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: '[]',
      success: true,
      durationMs: 1000,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(0);
  });

  it('should handle non-array JSON', () => {
    const response: ReviewResponse = {
      provider: 'test',
      model: 'test-model',
      rawResponse: '{"key": "value"}',
      success: true,
      durationMs: 1000,
    };

    const result = parseReviewResponse(response);

    expect(result.success).toBe(true);
    expect(result.findings).toHaveLength(0);
  });
});
