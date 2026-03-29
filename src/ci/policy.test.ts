import { describe, it, expect } from 'vitest';
import { evaluatePolicy, DEFAULT_POLICY, formatCIFindings } from './policy.js';
import { ConsensusFinding } from '../consensus/types.js';

describe('CI Policy Engine', () => {
  const createFinding = (overrides: Partial<ConsensusFinding> = {}): ConsensusFinding => ({
    file: 'test.ts',
    line: 1,
    severity: 'medium',
    category: 'bug',
    message: 'Test issue',
    suggestion: 'Fix it',
    consensusScore: 1.0,
    modelCount: 3,
    totalModels: 3,
    unanimous: true,
    originalSeverity: 'medium',
    elevated: false,
    models: ['model1', 'model2', 'model3'],
    ...overrides,
  });

  describe('evaluatePolicy', () => {
    it('should pass when no findings meet severity threshold', () => {
      const findings = [
        createFinding({ severity: 'low' }),
        createFinding({ severity: 'medium' }),
      ];

      const result = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'high' });

      expect(result.passed).toBe(true);
      expect(result.blockingFindings).toHaveLength(0);
      expect(result.exitCode).toBe(0);
    });

    it('should fail when findings meet severity threshold', () => {
      const findings = [
        createFinding({ severity: 'high' }),
        createFinding({ severity: 'critical' }),
      ];

      const result = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'high' });

      expect(result.passed).toBe(false);
      expect(result.blockingFindings).toHaveLength(2);
      expect(result.exitCode).toBe(1);
    });

    it('should filter by consensus requirement', () => {
      const findings = [
        createFinding({ severity: 'high', modelCount: 1, totalModels: 3 }),
        createFinding({ severity: 'high', modelCount: 2, totalModels: 3 }),
        createFinding({ severity: 'high', modelCount: 3, totalModels: 3 }),
      ];

      const result = evaluatePolicy(findings, {
        failOn: 'high',
        requireConsensus: 2,
        ignoreCategories: [],
      });

      expect(result.blockingFindings).toHaveLength(2);
      expect(result.blockingFindings.every(f => f.modelCount >= 2)).toBe(true);
    });

    it('should filter by category whitelist', () => {
      const findings = [
        createFinding({ severity: 'high', category: 'security' }),
        createFinding({ severity: 'high', category: 'bug' }),
        createFinding({ severity: 'high', category: 'performance' }),
      ];

      const result = evaluatePolicy(findings, {
        failOn: 'high',
        requireConsensus: 1,
        categories: ['security', 'bug'],
        ignoreCategories: [],
      });

      expect(result.blockingFindings).toHaveLength(2);
      expect(result.blockingFindings.map(f => f.category)).toEqual(['security', 'bug']);
    });

    it('should filter by ignore categories', () => {
      const findings = [
        createFinding({ severity: 'high', category: 'security' }),
        createFinding({ severity: 'high', category: 'style' }),
        createFinding({ severity: 'high', category: 'bug' }),
      ];

      const result = evaluatePolicy(findings, {
        failOn: 'high',
        requireConsensus: 1,
        ignoreCategories: ['style'],
      });

      expect(result.blockingFindings).toHaveLength(2);
      expect(result.blockingFindings.every(f => f.category !== 'style')).toBe(true);
    });

    it('should generate appropriate summary for passing policy', () => {
      const findings = [createFinding({ severity: 'low' })];

      const result = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'high' });

      expect(result.summary).toContain('No blocking findings');
      expect(result.summary).toContain('severity >= high');
      expect(result.summary).toContain('consensus >= 1');
    });

    it('should generate appropriate summary for failing policy', () => {
      const findings = [
        createFinding({ severity: 'high' }),
        createFinding({ severity: 'critical' }),
        createFinding({ severity: 'low' }),
      ];

      const result = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'high' });

      expect(result.summary).toContain('2 blocking findings');
      expect(result.summary).toContain('high');
      expect(result.summary).toContain('critical');
      expect(result.summary).toContain('1 additional finding');
    });

    it('should handle empty findings array', () => {
      const result = evaluatePolicy([], DEFAULT_POLICY);

      expect(result.passed).toBe(true);
      expect(result.blockingFindings).toHaveLength(0);
      expect(result.exitCode).toBe(0);
    });

    it('should handle all severity levels', () => {
      const findings = [
        createFinding({ severity: 'info' }),
        createFinding({ severity: 'low' }),
        createFinding({ severity: 'medium' }),
        createFinding({ severity: 'high' }),
        createFinding({ severity: 'critical' }),
      ];

      const resultInfo = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'info' });
      expect(resultInfo.blockingFindings).toHaveLength(5);

      const resultLow = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'low' });
      expect(resultLow.blockingFindings).toHaveLength(4);

      const resultMedium = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'medium' });
      expect(resultMedium.blockingFindings).toHaveLength(3);

      const resultHigh = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'high' });
      expect(resultHigh.blockingFindings).toHaveLength(2);

      const resultCritical = evaluatePolicy(findings, { ...DEFAULT_POLICY, failOn: 'critical' });
      expect(resultCritical.blockingFindings).toHaveLength(1);
    });
  });

  describe('formatCIFindings', () => {
    it('should format findings for CI output', () => {
      const findings = [
        createFinding({
          severity: 'high',
          file: 'src/app.ts',
          line: 42,
          category: 'security',
          message: 'SQL injection vulnerability',
          suggestion: 'Use parameterized queries',
          modelCount: 2,
          totalModels: 3,
        }),
      ];

      const output = formatCIFindings(findings);

      expect(output).toContain('[HIGH]');
      expect(output).toContain('src/app.ts:42');
      expect(output).toContain('security');
      expect(output).toContain('2/3 models');
      expect(output).toContain('SQL injection vulnerability');
      expect(output).toContain('Use parameterized queries');
    });

    it('should return empty string for empty findings', () => {
      const output = formatCIFindings([]);
      expect(output).toBe('');
    });

    it('should format multiple findings', () => {
      const findings = [
        createFinding({ severity: 'critical', file: 'a.ts', line: 1 }),
        createFinding({ severity: 'high', file: 'b.ts', line: 2 }),
      ];

      const output = formatCIFindings(findings);

      expect(output).toContain('[CRITICAL]');
      expect(output).toContain('a.ts:1');
      expect(output).toContain('[HIGH]');
      expect(output).toContain('b.ts:2');
    });
  });
});
