import OpenAI from 'openai';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';

export class OpenAICompatAdapter implements ReviewAdapter {
  private client: OpenAI | null = null;
  private cachedApiKey: string | null = null;
  private cachedBaseURL: string | null = null;

  getName(): string {
    return 'openai-compat';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const startTime = Date.now();
    const apiKey = request.model.apiKey;
    const baseURL = request.model.baseUrl;

    if (!apiKey) {
      return {
        provider: 'openai-compat',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: 'API key not provided',
        durationMs: 0,
      };
    }

    if (!baseURL) {
      return {
        provider: 'openai-compat',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: 'Base URL not provided',
        durationMs: 0,
      };
    }

    // Cache client instance, recreate only if API key or baseURL changes
    if (!this.client || this.cachedApiKey !== apiKey || this.cachedBaseURL !== baseURL) {
      this.client = new OpenAI({ apiKey, baseURL });
      this.cachedApiKey = apiKey;
      this.cachedBaseURL = baseURL;
    }

    const client = this.client;

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), request.timeout * 1000);

      let response;
      let supportsJsonObject = true;

      try {
        // Try with response_format: json_object first
        response = await client.chat.completions.create({
          model: request.model.model,
          temperature: request.model.temperature,
          ...(request.model.maxTokens ? { max_tokens: request.model.maxTokens } : {}),
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          response_format: { type: 'json_object' },
        }, {
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);

        // Check if error is about unsupported response_format
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg.includes('response_format') || errorMsg.includes('json_object')) {
          // Retry without response_format
          supportsJsonObject = false;
          const retryAbortController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryAbortController.abort(), request.timeout * 1000);

          try {
            response = await client.chat.completions.create({
              model: request.model.model,
              temperature: request.model.temperature,
              ...(request.model.maxTokens ? { max_tokens: request.model.maxTokens } : {}),
              messages: [
                {
                  role: 'user',
                  content: request.prompt,
                },
              ],
            }, {
              signal: retryAbortController.signal,
            });
            clearTimeout(retryTimeoutId);
          } catch (retryError) {
            clearTimeout(retryTimeoutId);
            throw retryError;
          }
        } else {
          throw error;
        }
      }

      const content = response.choices[0]?.message?.content || '[]';

      let parsed;
      try {
        parsed = JSON.parse(content);
        if (parsed.findings && Array.isArray(parsed.findings)) {
          parsed = parsed.findings;
        }
      } catch {
        // If JSON parsing fails and we didn't use json_object, try to extract JSON from text
        if (!supportsJsonObject) {
          const match = content.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
          if (match) {
            try {
              const extracted = JSON.parse(match[0]);
              if (extracted.findings && Array.isArray(extracted.findings)) {
                parsed = extracted.findings;
              } else if (Array.isArray(extracted)) {
                parsed = extracted;
              } else {
                parsed = [];
              }
            } catch {
              parsed = [];
            }
          } else {
            parsed = [];
          }
        } else {
          parsed = [];
        }
      }

      return {
        provider: 'openai-compat',
        model: request.model.model,
        rawResponse: JSON.stringify(parsed),
        success: true,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        provider: 'openai-compat',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
