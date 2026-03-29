import OpenAI from 'openai';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';
import { getModelCapabilities } from './capabilities.js';

export class OpenAIAdapter implements ReviewAdapter {
  private client: OpenAI | null = null;
  private cachedApiKey: string | null = null;

  getName(): string {
    return 'openai';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const startTime = Date.now();
    const apiKey = request.model.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        provider: 'openai',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: 'OPENAI_API_KEY not found',
        durationMs: 0,
      };
    }

    // Cache client instance, recreate only if API key changes
    if (!this.client || this.cachedApiKey !== apiKey) {
      this.client = new OpenAI({ apiKey });
      this.cachedApiKey = apiKey;
    }

    const client = this.client;

    try {
      // Use capability system to determine model features
      const capabilities = getModelCapabilities(request.model.model);

      // Only set token limits if explicitly configured
      const tokenParam = request.model.maxTokens
        ? (capabilities.usesCompletionTokens
            ? { max_completion_tokens: request.model.maxTokens }
            : { max_tokens: request.model.maxTokens })
        : {};

      // Only include temperature and response_format if supported
      const tempParam = capabilities.supportsTemperature ? { temperature: request.model.temperature } : {};
      const formatParam = capabilities.supportsResponseFormat ? { response_format: { type: 'json_object' as const } } : {};

      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), request.timeout * 1000);

      let response;
      try {
        response = await client.chat.completions.create({
          model: request.model.model,
          ...tempParam,
          ...tokenParam,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          ...formatParam,
        }, {
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

      const content = response.choices[0]?.message?.content || '[]';

      // OpenAI might wrap in { "findings": [...] }, return array directly, or return a single object
      let parsed;
      try {
        parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          // Already an array — good
        } else if (parsed.findings && Array.isArray(parsed.findings)) {
          parsed = parsed.findings;
        } else if (parsed.issues && Array.isArray(parsed.issues)) {
          parsed = parsed.issues;
        } else if (parsed.results && Array.isArray(parsed.results)) {
          parsed = parsed.results;
        } else if (parsed.file && parsed.message) {
          // Single finding returned as object — wrap in array
          parsed = [parsed];
        } else {
          // Look for any array property
          const arrayProp = Object.values(parsed).find(v => Array.isArray(v));
          parsed = arrayProp || [];
        }
      } catch {
        // Try to extract JSON array from text
        const match = content.match(/\[[\s\S]*\]/);
        parsed = match ? JSON.parse(match[0]) : [];
      }

      // Extract token usage from response
      const tokenUsage = response.usage
        ? {
            inputTokens: response.usage.prompt_tokens || 0,
            outputTokens: response.usage.completion_tokens || 0,
            totalTokens: response.usage.total_tokens || 0,
          }
        : undefined;

      return {
        provider: 'openai',
        model: request.model.model,
        rawResponse: JSON.stringify(parsed),
        success: true,
        durationMs: Date.now() - startTime,
        tokenUsage,
      };
    } catch (error) {
      return {
        provider: 'openai',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
