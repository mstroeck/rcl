import OpenAI from 'openai';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';

export class OpenAIAdapter implements ReviewAdapter {
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

    const client = new OpenAI({ apiKey });

    try {
      // Newer OpenAI models (o3, gpt-5.x, etc.) use max_completion_tokens instead of max_tokens
      const usesCompletionTokens = /^(o[1-9]|gpt-[5-9]|gpt-\d{2,})/.test(request.model.model);
      const tokenParam = usesCompletionTokens
        ? { max_completion_tokens: request.model.maxTokens }
        : { max_tokens: request.model.maxTokens };

      const response = await Promise.race([
        client.chat.completions.create({
          model: request.model.model,
          temperature: request.model.temperature,
          ...tokenParam,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          response_format: { type: 'json_object' },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), request.timeout * 1000)
        ),
      ]);

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

      return {
        provider: 'openai',
        model: request.model.model,
        rawResponse: JSON.stringify(parsed),
        success: true,
        durationMs: Date.now() - startTime,
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
