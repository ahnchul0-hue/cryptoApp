import type { AssetClass, NewsItem, RawReportData } from '../data/types';

export interface CategoryAnalysis {
  category: AssetClass | 'macro';
  headline: string;
  metaphor: string;
  evidence: { label: string; value: string }[];
  kidExplain: string;
  actions: string[];
}

export interface ReportConclusion {
  oneLiner: string;
  fitForUser: { invest: string[]; avoid: string[] };
  rationale: string;
}

export interface FinalReport {
  generatedAt: string;
  oneLiner: string;
  categories: CategoryAnalysis[];
  news: NewsItem[];
  conclusion: ReportConclusion;
  usage: TokenUsage;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  estimatedUsd: number;
  modelId: string;
}

export interface AnalyzeDeps {
  client: LlmClient;
  modelId: string;
  toneStrength?: number;
  userProfile?: string;
}

export interface LlmClient {
  messages: {
    create: (req: MessageRequest) => Promise<MessageResponse>;
  };
}

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface MessageRequest {
  model: string;
  max_tokens: number;
  system?: SystemBlock[];
  messages: { role: 'user' | 'assistant'; content: string }[];
  temperature?: number;
}

export interface MessageResponse {
  content: { type: 'text'; text: string }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

export type RawData = RawReportData;
