import { describe, it, expect } from 'vitest';
import { buildReviewPrompt } from './prompt-builder.js';
import { DiffChunk } from './chunker.js';
import { FileChange } from '../resolver/types.js';

describe('buildReviewPrompt', () => {
  it('should include language-specific prompts for TypeScript files', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/test.ts',
          type: 'modified',
          diff: '+const x: any = 5;',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 100,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // Should include TypeScript-specific checks
    expect(prompt).toContain('TypeScript-specific checks');
    expect(prompt).toContain("Avoid 'any' type");
  });

  it('should include language-specific prompts for JavaScript files', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/app.js',
          type: 'modified',
          diff: '+if (x == 5) {}',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 100,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    expect(prompt).toContain('JavaScript-specific checks');
    expect(prompt).toContain('Prefer === over ==');
  });

  it('should deduplicate language prompts for multiple files of same language', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/file1.ts',
          type: 'modified',
          diff: '+const a = 1;',
          additions: 1,
          deletions: 0,
        },
        {
          path: 'src/file2.ts',
          type: 'modified',
          diff: '+const b = 2;',
          additions: 1,
          deletions: 0,
        },
        {
          path: 'src/file3.ts',
          type: 'modified',
          diff: '+const c = 3;',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 300,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // Should only include TypeScript-specific checks once
    const matches = prompt.match(/TypeScript-specific checks/g);
    expect(matches).toHaveLength(1);
  });

  it('should include multiple language prompts for mixed language files', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/component.tsx',
          type: 'modified',
          diff: '+const x: any = 5;',
          additions: 1,
          deletions: 0,
        },
        {
          path: 'scripts/deploy.py',
          type: 'modified',
          diff: '+def foo(x=[]):',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 200,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // Should include both TypeScript and Python checks
    expect(prompt).toContain('TypeScript-specific checks');
    expect(prompt).toContain('Python-specific checks');
  });

  it('should not include language prompts for unsupported languages', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'README.md',
          type: 'modified',
          diff: '+# Title',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 50,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // Should not include any language-specific sections
    expect(prompt).not.toContain('-specific checks');
  });

  it('should include base review instructions', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/test.ts',
          type: 'modified',
          diff: '+const x = 1;',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 100,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // Should include standard review focus areas
    expect(prompt).toContain('Bugs and logic errors');
    expect(prompt).toContain('Security vulnerabilities');
    expect(prompt).toContain('Performance problems');
  });

  it('should include fix suggestions instruction when enabled', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/test.ts',
          type: 'modified',
          diff: '+const x = 1;',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 100,
    };

    const prompt = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    expect(prompt).toContain('provide a specific fix suggestion');
  });

  it('should wrap diff with boundaries when hardening is enabled', () => {
    const chunk: DiffChunk = {
      files: [
        {
          path: 'src/test.ts',
          type: 'modified',
          diff: '+const x = 1;',
          additions: 1,
          deletions: 0,
        },
      ],
      estimatedTokens: 100,
    };

    const promptWithHardening = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: true,
    });

    const promptWithoutHardening = buildReviewPrompt(chunk, {
      includeFixSuggestions: true,
      promptHardening: false,
    });

    // With hardening should have boundaries, without should have simple separators
    expect(promptWithHardening).toContain('BOUNDARY');
    expect(promptWithoutHardening).toContain('--- Diff ---');
    expect(promptWithoutHardening).toContain('--- End Diff ---');
  });
});
