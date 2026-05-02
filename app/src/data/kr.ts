import type { KrBucket, QuotePoint } from './types';
import { fetchJson } from '../util/http';

const KOSPI_INDICES = ['^KS11'];
const KOSDAQ_INDICES = ['^KQ11'];
const KOSPI_BLUE = ['005930.KS', '000660.KS', '035420.KS'];
const ETFS = ['069500.KS', '360750.KS', '102110.KS'];

const NAME: Record<string, string> = {
  '^KS11': 'KOSPI',
  '^KQ11': 'KOSDAQ',
  '005930.KS': '삼성전자',
  '000660.KS': 'SK하이닉스',
  '035420.KS': '네이버',
  '069500.KS': 'KODEX 200',
  '360750.KS': 'TIGER 미국S&P500',
  '102110.KS': 'TIGER 200',
};

interface YahooChart {
  chart: {
    result?: {
      meta: { symbol: string; regularMarketPrice: number; chartPreviousClose?: number; previousClose: number; regularMarketTime?: number };
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
  };
}

export interface KrDeps {
  fetchJson?: typeof fetchJson;
}

async function fetchOne(symbol: string, fj: typeof fetchJson): Promise<QuotePoint> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const data = await fj<YahooChart>(url, { headers: { 'User-Agent': 'Mozilla/5.0 cryptoApp/1.0' } });
  const r = data.chart.result?.[0];
  if (!r) throw new Error(`yahoo-kr: no result ${symbol}`);
  const closes = (r.indicators.quote[0]?.close ?? []).filter((x): x is number => typeof x === 'number');
  const last = r.meta.regularMarketPrice;
  const prev = r.meta.chartPreviousClose ?? r.meta.previousClose;
  return {
    symbol: r.meta.symbol,
    name: NAME[r.meta.symbol] ?? r.meta.symbol,
    priceClose: last,
    priceOpen: prev,
    pctChangeDay: prev ? ((last - prev) / prev) * 100 : 0,
    spark: closes.slice(-14),
    asOf: r.meta.regularMarketTime
      ? new Date(r.meta.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
  };
}

async function fetchMany(symbols: string[], fj: typeof fetchJson): Promise<QuotePoint[]> {
  const settled = await Promise.allSettled(symbols.map((s) => fetchOne(s, fj)));
  return settled
    .filter((r): r is PromiseFulfilledResult<QuotePoint> => r.status === 'fulfilled')
    .map((r) => r.value);
}

export async function fetchKrBucket(deps: KrDeps = {}): Promise<KrBucket> {
  const fj = deps.fetchJson ?? fetchJson;
  const [kospi, kosdaq, etfs] = await Promise.all([
    fetchMany([...KOSPI_INDICES, ...KOSPI_BLUE], fj),
    fetchMany(KOSDAQ_INDICES, fj),
    fetchMany(ETFS, fj),
  ]);
  return { kospi, kosdaq, etfs };
}
