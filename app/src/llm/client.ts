import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient, MessageRequest, MessageResponse } from './types';

export interface CreateClientOpts {
  apiKey: string;
  baseURL?: string;
}

export function createAnthropicClient(opts: CreateClientOpts): LlmClient {
  const sdk = new Anthropic({ apiKey: opts.apiKey, baseURL: opts.baseURL, dangerouslyAllowBrowser: true });
  return {
    messages: {
      create: async (req: MessageRequest): Promise<MessageResponse> => {
        const r = await sdk.messages.create({
          model: req.model,
          max_tokens: req.max_tokens,
          temperature: req.temperature,
          system: req.system as unknown as Anthropic.Messages.MessageCreateParams['system'],
          messages: req.messages,
        });
        return {
          content: r.content
            .filter((c): c is Anthropic.Messages.TextBlock => c.type === 'text')
            .map((c) => ({ type: 'text', text: c.text })),
          usage: {
            input_tokens: r.usage.input_tokens,
            output_tokens: r.usage.output_tokens,
            cache_creation_input_tokens: r.usage.cache_creation_input_tokens ?? 0,
            cache_read_input_tokens: r.usage.cache_read_input_tokens ?? 0,
          },
        };
      },
    },
  };
}
