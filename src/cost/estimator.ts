export interface CostEstimate {
  input: number;
  output: number;
  total: number;
}

export interface ModelEstimate {
  model: string;
  tokens: number;
  cost: CostEstimate;
}

// Rough token estimation: chars / 4
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Pricing per 1M tokens (input / output)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus': { input: 15, output: 75 },
  'claude-sonnet': { input: 3, output: 15 },
  'gpt-5.4': { input: 5, output: 15 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gemini-pro': { input: 1.25, output: 5 },
  'gemini-flash': { input: 0.075, output: 0.3 },
};

const DEFAULT_PRICING = { input: 5, output: 15 };

function getPricing(model: string): { input: number; output: number } {
  // Try to match model name against known pricing keys
  const lowerModel = model.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (lowerModel.includes(key)) {
      return pricing;
    }
  }
  return DEFAULT_PRICING;
}

export function estimateCost(tokens: number, model: string): CostEstimate {
  const pricing = getPricing(model);

  // Input cost: based on prompt tokens
  const inputCost = (tokens / 1_000_000) * pricing.input;

  // Output cost: scale based on input size (assume ~10% of input, minimum 2500)
  const estimatedOutputTokens = Math.max(2500, tokens * 0.1);
  const outputCost = (estimatedOutputTokens / 1_000_000) * pricing.output;

  return {
    input: inputCost,
    output: outputCost,
    total: inputCost + outputCost,
  };
}

export function formatEstimate(estimates: ModelEstimate[]): string {
  let output = '\n📊 Cost Estimation\n\n';

  let totalCost = 0;

  for (const est of estimates) {
    output += `  ${est.model}\n`;
    output += `    Tokens:  ~${est.tokens.toLocaleString()}\n`;
    output += `    Input:   $${est.cost.input.toFixed(4)}\n`;
    output += `    Output:  $${est.cost.output.toFixed(4)}\n`;
    output += `    Total:   $${est.cost.total.toFixed(4)}\n\n`;
    totalCost += est.cost.total;
  }

  output += `  Combined Total: $${totalCost.toFixed(4)}\n`;

  return output;
}
