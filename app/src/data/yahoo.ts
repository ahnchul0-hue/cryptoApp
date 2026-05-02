import type { QuotePoint, UsBucket, MacroBucket } from './types';
import { fetchJson } from '../util/http';

const BIGTECH = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META'];
const INDICES = ['^GSPC', '^IXIC', '^DJI'];
const FX = ['KRW=X', 'JPY=X', 'EURUSD=X'];

const NAME: Record<string, string> = {
  AAPL: 'Apple',
  MSFT: 'Microsoft',
  GOOGL: 'Alphabet',
  AMZN: 'Amazon',
  TSLA: 'Tesla',
  NVDA: 'Nvidia',
  META: 'Meta',
  '^GSPC': 'S&P 500',
  '^IXIC': 'NASDAQ',
  '^DJI': 'Dow Jones',
  'KRW=X': 'USD/KRW',
  'JPY=X': 'USD/JPY',
  'EURUSD=X': 'EUR/USD',
};

interface YahooChart {
  chart: {
    result?: {
      meta: {
        symbol: string;
        regularMarketPrice: number;
        previousClose: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
      };
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
}

export interface YahooDeps {
  fetchJson?: typeof fetchJson;
}

async function fetchSymbol(symbol: string, fj: typeof fetchJson): Promise<QuotePoint> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const data = await fj<YahooChart>(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 cryptoApp/1.0' },
  });
  const r = data.chart.result?.[0];
  if (!r) throw new Error(`yahoo: empty result for ${symbol}`);
  const closes = (r.indicators.quote[0]?.close ?? []).filter((x): x is number => typeof x === 'number');
  const last = r.meta.regularMarketPrice;
  const prev = r.meta.chartPreviousClose ?? r.meta.previousClose;
  const week = closes.length >= 6 ? closes[closes.length - 1] / closes[closes.length - 6] - 1 : undefined;
  const month = closes.length >= 21 ? closes[closes.length - 1] / closes[0] - 1 : undefined;
  return {
    symbol: r.meta.symbol,
    name: NAME[r.meta.symbol] ?? r.meta.symbol,
    priceClose: last,
    priceOpen: prev,
    pctChangeDay: prev ? ((last - prev) / prev) * 100 : 0,
    pctChange7d: week !== undefined ? week * 100 : undefined,
    pctChange30d: month !== undefined ? month * 100 : undefined,
    spark: closes.slice(-14),
    asOf: r.meta.regularMarketTime
      ? new Date(r.meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchAll(symbols: string[], fj: typeof fetchJson): Promise<QuotePoint[]> {
  const settled = await Promise.allSettled(symbols.map((s) => fetchSymbol(s, fj)));
  return settled
    .filter((r): r is PromiseFulfilledResult<QuotePoint> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function fetchYahooUsBucket(deps: YahooDeps = {}): Promise<UsBucket> {
  const fj = deps.fetchJson ?? fetchJson;
  const [bigtech, indices] = await Promise.all([fetchAll(BIGTECH, fj), fetchAll(INDICES, fj)]);
  return { bigtech, indices };
}

export async function fetchYahooMacroBucket(deps: YahooDeps = {}): Promise<MacroBucket> {
  const fj = deps.fetchJson ?? fetchJson;
  const fx = await fetchAll(FX, fj);
  return { fx };
}
