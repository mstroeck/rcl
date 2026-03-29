import Anthropic from '@anthropic-ai/sdk';
import { ReviewAdapter, ReviewRequest, ReviewResponse } from './adapter.js';

export class AnthropicAdapter implements ReviewAdapter {
  private client: Anthropic | null = null;
  private cachedApiKey: string | null = null;

  getName(): string {
    return 'anthropic';
  }

  async review(request: ReviewRequest): Promise<ReviewResponse> {
    const startTime = Date.now();
    const apiKey = request.model.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        provider: 'anthropic',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: 'ANTHROPIC_API_KEY not found',
        durationMs: 0,
      };
    }

    // Cache client instance, recreate only if API key changes
    if (!this.client || this.cachedApiKey !== apiKey) {
      this.client = new Anthropic({ apiKey });
      this.cachedApiKey = apiKey;
    }

    const client = this.client;

    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), request.timeout * 1000);

      try {
        const response = await client.messages.create({
          model: request.model.model,
          max_tokens: request.model.maxTokens,
          temperature: request.model.temperature,
          messages: [
            {
              role: 'user',
              content: request.prompt,
            },
          ],
          tools: [
            {
              name: 'report_findings',
              description: 'Report code review findings',
              input_schema: {
                type: 'object',
                properties: {
                  findings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        file: { type: 'string' },
                        line: { type: 'number' },
                        severity: {
                          type: 'string',
                          enum: ['info', 'low', 'medium', 'high', 'critical'],
                        },
                        category: { type: 'string' },
                        message: { type: 'string' },
                        suggestion: { type: 'string' },
                      },
                      required: ['file', 'line', 'severity', 'category', 'message', 'suggestion'],
                    },
                  },
                },
                required: ['findings'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'report_findings' },
        }, {
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);

        const toolUse = response.content.find(block => block.type === 'tool_use');
        if (!toolUse || toolUse.type !== 'tool_use') {
          throw new Error('No tool use in response');
        }

        // Type-safe validation of toolUse.input
        let findings = [];
        if (
          toolUse.input &&
          typeof toolUse.input === 'object' &&
          'findings' in toolUse.input &&
          Array.isArray((toolUse.input as Record<string, unknown>).findings)
        ) {
          findings = (toolUse.input as Record<string, unknown>).findings as any[];
        }

        // Extract token usage from response
        const tokenUsage = response.usage
          ? {
              inputTokens: response.usage.input_tokens || 0,
              outputTokens: response.usage.output_tokens || 0,
              totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
            }
          : undefined;

        return {
          provider: 'anthropic',
          model: request.model.model,
          rawResponse: JSON.stringify(findings),
          success: true,
          durationMs: Date.now() - startTime,
          tokenUsage,
        };
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      return {
        provider: 'anthropic',
        model: request.model.model,
        rawResponse: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startTime,
      };
    }
  }
}
