import { ReviewResponse } from '../dispatch/adapter.js';
import { ModelReview, Finding, FindingSchema } from './types.js';
import { z } from 'zod';

export function parseReviewResponse(response: ReviewResponse): ModelReview {
  if (!response.success) {
    return {
      provider: response.provider,
      model: response.model,
      findings: [],
      success: false,
      error: response.error,
      durationMs: response.durationMs,
    };
  }

  try {
    const parsed = JSON.parse(response.rawResponse);
    let findings: unknown[] = [];

    if (Array.isArray(parsed)) {
      // Direct array of findings
      findings = parsed;
    } else if (typeof parsed === 'object' && parsed !== null) {
      // Check for common wrapper keys
      const wrapperKeys = ['findings', 'issues', 'results'];
      for (const key of wrapperKeys) {
        if (key in parsed && Array.isArray(parsed[key])) {
          findings = parsed[key];
          break;
        }
      }

      // If still empty and object has 'file' and 'message' keys, it's a single finding wrapped
      if (findings.length === 0 && 'file' in parsed && 'message' in parsed) {
        findings = [parsed];
      }
    }

    // Validate each finding
    let invalidCount = 0;
    const validFindings = findings
      .map((f, idx) => {
        try {
          return FindingSchema.parse(f);
        } catch (error) {
          invalidCount++;
          return null;
        }
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    if (invalidCount > 0) {
      console.warn(
        `${invalidCount} finding${invalidCount !== 1 ? 's' : ''} from ${response.provider}/${response.model} ${invalidCount !== 1 ? 'were' : 'was'} invalid and dropped`
      );
    }

    return {
      provider: response.provider,
      model: response.model,
      findings: validFindings,
      success: true,
      durationMs: response.durationMs,
    };
  } catch (error) {
    return {
      provider: response.provider,
      model: response.model,
      findings: [],
      success: false,
      error: `Failed to parse response: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: response.durationMs,
    };
  }
}

export function parseAllReviews(responses: ReviewResponse[]): ModelReview[] {
  return responses.map(parseReviewResponse);
}

export function validateFindings(findings: Finding[], diffFiles: string[]): Finding[] {
  const validFindings: Finding[] = [];
  const droppedFiles = new Set<string>();

  for (const finding of findings) {
    if (diffFiles.includes(finding.file)) {
      validFindings.push(finding);
    } else {
      droppedFiles.add(finding.file);
    }
  }

  if (droppedFiles.size > 0) {
    const fileList = Array.from(droppedFiles).join(', ');
    console.warn(
      `${droppedFiles.size} finding${droppedFiles.size !== 1 ? 's' : ''} dropped for non-existent file${droppedFiles.size !== 1 ? 's' : ''}: ${fileList}`
    );
  }

  return validFindings;
}
