import type { MessageResponse, TokenUsage } from './types';

interface PriceTier {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

const PRICES: Record<string, PriceTier> = {
  'claude-sonnet-4-6': { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  'claude-opus-4-7': { input: 15, output: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
};

const FALLBACK: PriceTier = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

export function priceFor(modelId: string): PriceTier {
  for (const key of Object.keys(PRICES)) {
    if (modelId.startsWith(key)) return PRICES[key];
  }
  return FALLBACK;
}

export function emptyUsage(modelId: string): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    estimatedUsd: 0,
    modelId,
  };
}

export function addUsage(acc: TokenUsage, res: MessageResponse): TokenUsage {
  const price = priceFor(acc.modelId);
  const inT = res.usage.input_tokens;
  const outT = res.usage.output_tokens;
  const cwT = res.usage.cache_creation_input_tokens ?? 0;
  const crT = res.usage.cache_read_input_tokens ?? 0;
  const cost =
    (inT * price.input + outT * price.output + cwT * price.cacheWrite + crT * price.cacheRead) /
    1_000_000;
  return {
    modelId: acc.modelId,
    inputTokens: acc.inputTokens + inT,
    outputTokens: acc.outputTokens + outT,
    cacheCreationInputTokens: acc.cacheCreationInputTokens + cwT,
    cacheReadInputTokens: acc.cacheReadInputTokens + crT,
    estimatedUsd: acc.estimatedUsd + cost,
  };
}
