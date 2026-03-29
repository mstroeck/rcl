import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';

export class GoogleAdapter implements ReviewAdapter {
  getName(): string {
    return 'google';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const startTime = Date.now();
    const apiKey = request.model.apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        provider: 'google',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: 'GOOGLE_API_KEY or GEMINI_API_KEY not found',
        durationMs: 0,
      };
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
      const model = genAI.getGenerativeModel({
        model: request.model.model,
        generationConfig: {
          temperature: request.model.temperature,
          maxOutputTokens: request.model.maxTokens,
          responseMimeType: 'application/json',
        },
      });

      const response = await Promise.race([
        model.generateContent(request.prompt),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), request.timeout * 1000)
        ),
      ]);

      const text = response.response.text();

      // Parse JSON response — Gemini may wrap findings in various shapes
      let parsed;
      try {
        parsed = JSON.parse(text);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          parsed = parsed.findings;
        } else if (parsed.issues && Array.isArray(parsed.issues)) {
          parsed = parsed.issues;
        } else if (parsed.results && Array.isArray(parsed.results)) {
          parsed = parsed.results;
        } else if (!Array.isArray(parsed)) {
          // Last resort: look for any array property
          const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
          parsed = arrayProp || [];
        }
      } catch {
        // Try to extract JSON array from text if it's wrapped in markdown
        const match = text.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : [];
      }

      return {
        provider: 'google',
        model: request.model.model,
        rawResponse: JSON.stringify(parsed),
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        provider: 'google',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
