import { GoogleGenerativeAI } from '@google/generative-ai';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';

export class GoogleAdapter implements ReviewAdapter {
  private client: GoogleGenerativeAI | null = null;
  private cachedApiKey: string | null = null;

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

    // Cache client instance, recreate only if API key changes
    if (!this.client || this.cachedApiKey !== apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      this.cachedApiKey = apiKey;
    }

    const genAI = this.client;

    try {
      // Let models run unconstrained by default — no maxOutputTokens unless explicitly configured
      const generationConfig: Record<string, unknown> = {
        temperature: request.model.temperature,
        responseMimeType: 'application/json',
      };

      // Only set maxOutputTokens if user explicitly configured it
      if (request.model.maxTokens) {
        generationConfig.maxOutputTokens = request.model.maxTokens;
      }

      const model = genAI.getGenerativeModel({
        model: request.model.model,
        generationConfig: generationConfig as any,
      });

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), request.timeout * 1000);

      let response;
      try {
        response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
        }, {
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

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

      // Extract token usage from response
      const tokenUsage = response.response.usageMetadata
        ? {
            inputTokens: response.response.usageMetadata.promptTokenCount || 0,
            outputTokens: response.response.usageMetadata.candidatesTokenCount || 0,
            totalTokens: response.response.usageMetadata.totalTokenCount || 0,
          }
        : undefined;

      return {
        provider: 'google',
        model: request.model.model,
        rawResponse: JSON.stringify(parsed),
        success: true,
        durationMs: Date.now() - startTime,
        tokenUsage,
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
