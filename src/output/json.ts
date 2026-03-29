import { ConsensusResult } from '../consensus/index.js';

export function formatJsonOutput(result: ConsensusResult): string {
  const output = {
    summary: {
      totalFindings: result.findings.length,
      successfulModels: result.successCount,
      failedModels: result.failureCount,
    },
    findings: result.findings.map(f => ({
      file: f.file,
      line: f.line,
      severity: f.severity,
      originalSeverity: f.originalSeverity,
      elevated: f.elevated,
      category: f.category,
      message: f.message,
      suggestion: f.suggestion,
      consensus: {
        score: f.consensusScore,
        modelCount: f.modelCount,
        totalModels: f.totalModels,
        unanimous: f.unanimous,
        models: f.models,
      },
    })),
    reviews: result.reviews.map(r => ({
      provider: r.provider,
      model: r.model,
      success: r.success,
      error: r.error,
      findingsCount: r.findings.length,
      durationMs: r.durationMs,
    })),
  };

  return JSON.stringify(output, null, 2);
}
