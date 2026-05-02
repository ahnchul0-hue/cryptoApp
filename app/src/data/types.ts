export interface QuotePoint {
  symbol: string;
  name: string;
  priceClose: number;
  priceOpen: number;
  pctChangeDay: number;
  pctChange7d?: number;
  pctChange30d?: number;
  high24h?: number;
  low24h?: number;
  volume24h?: number;
  marketCap?: number;
  spark?: number[];
  asOf: string;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  summary?: string;
}

export interface CryptoBucket {
  major: QuotePoint[];
  alts: QuotePoint[];
  feargreed?: { value: number; classification: string };
  dominance?: { btc: number; eth: number };
  kimchi?: { btc: number; eth: number };
}

export interface UsBucket {
  bigtech: QuotePoint[];
  indices: QuotePoint[];
}

export interface KrBucket {
  kospi: QuotePoint[];
  kosdaq: QuotePoint[];
  etfs: QuotePoint[];
}

export interface MacroBucket {
  fx: QuotePoint[];
  rates?: QuotePoint[];
  commodities?: QuotePoint[];
}

export interface RawReportData {
  generatedAt: string;
  crypto?: CryptoBucket;
  us?: UsBucket;
  kr?: KrBucket;
  macro?: MacroBucket;
  news: NewsItem[];
  errors: { source: string; message: string }[];
}

export type AssetClass = 'crypto' | 'us' | 'kr';
