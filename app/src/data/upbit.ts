import type { CryptoBucket, QuotePoint } from './types';
import { fetchJson } from '../util/http';

const MARKETS_MAJOR = ['KRW-BTC', 'KRW-ETH'];
const MARKETS_ALTS = ['KRW-XRP', 'KRW-SAND', 'KRW-SOL', 'KRW-DOGE'];

interface UpbitTicker {
  market: string;
  trade_price: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  signed_change_rate: number;
  acc_trade_price_24h: number;
  timestamp: number;
}

interface UpbitCandle {
  trade_price: number;
}

const KOREAN_NAME: Record<string, string> = {
  'KRW-BTC': '비트코인',
  'KRW-ETH': '이더리움',
  'KRW-XRP': '리플',
  'KRW-SAND': '샌드박스',
  'KRW-SOL': '솔라나',
  'KRW-DOGE': '도지코인',
};

export interface UpbitDeps {
  fetchJson?: typeof fetchJson;
}

export async function fetchUpbitBucket(deps: UpbitDeps = {}): Promise<CryptoBucket> {
  const fj = deps.fetchJson ?? fetchJson;
  const all = [...MARKETS_MAJOR, ...MARKETS_ALTS];
  const tickerUrl = `https://api.upbit.com/v1/ticker?markets=${all.join(',')}`;
  const tickers = await fj<UpbitTicker[]>(tickerUrl);

  const sparks = await Promise.all(
    all.map(async (m) => {
      try {
        const c = await fj<UpbitCandle[]>(
          `https://api.upbit.com/v1/candles/days?market=${m}&count=14`,
        );
        return [m, c.map((x) => x.trade_price).reverse()] as const;
      } catch {
        return [m, [] as number[]] as const;
      }
    }),
  );
  const sparkMap = new Map(sparks);

  const toQuote = (t: UpbitTicker): QuotePoint => ({
    symbol: t.market.replace('KRW-', ''),
    name: KOREAN_NAME[t.market] ?? t.market,
    priceClose: t.trade_price,
    priceOpen: t.opening_price,
    pctChangeDay: t.signed_change_rate * 100,
    high24h: t.high_price,
    low24h: t.low_price,
    volume24h: t.acc_trade_price_24h,
    spark: sparkMap.get(t.market) ?? [],
    asOf: new Date(t.timestamp).toISOString(),
  });

  return {
    major: tickers.filter((t) => MARKETS_MAJOR.includes(t.market)).map(toQuote),
    alts: tickers.filter((t) => MARKETS_ALTS.includes(t.market)).map(toQuote),
  };
}
