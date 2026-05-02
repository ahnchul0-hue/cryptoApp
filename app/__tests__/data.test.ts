import { describe, expect, it } from 'vitest';
import { fetchUpbitBucket } from '../src/data/upbit';
import { fetchYahooUsBucket, fetchYahooMacroBucket } from '../src/data/yahoo';
import { fetchKrBucket } from '../src/data/kr';
import { parseRss, filterRelevant, fetchNews } from '../src/data/news';
import { collectReportData } from '../src/data/normalize';

function fakeJson<T>(map: Record<string, unknown>): (url: string) => Promise<T> {
  return async (url: string) => {
    for (const k of Object.keys(map)) {
      if (url.includes(k)) return map[k] as T;
    }
    throw new Error(`unmocked URL: ${url}`);
  };
}

describe('upbit fetcher', () => {
  it('parses tickers + candles into major/alts', async () => {
    const ticker = [
      {
        market: 'KRW-BTC',
        trade_price: 100000000,
        opening_price: 99000000,
        high_price: 101000000,
        low_price: 98000000,
        signed_change_rate: 0.0101,
        acc_trade_price_24h: 1234567890,
        timestamp: 1700000000000,
      },
      {
        market: 'KRW-ETH',
        trade_price: 5000000,
        opening_price: 4900000,
        high_price: 5100000,
        low_price: 4850000,
        signed_change_rate: 0.0204,
        acc_trade_price_24h: 12345678,
        timestamp: 1700000000000,
      },
      {
        market: 'KRW-XRP',
        trade_price: 800,
        opening_price: 790,
        high_price: 810,
        low_price: 780,
        signed_change_rate: 0.0126,
        acc_trade_price_24h: 1234567,
        timestamp: 1700000000000,
      },
    ];
    const candles = [{ trade_price: 1 }, { trade_price: 2 }, { trade_price: 3 }];
    const fetchJsonStub = fakeJson({
      '/ticker?': ticker,
      '/candles/days': candles,
    });
    const bucket = await fetchUpbitBucket({ fetchJson: fetchJsonStub as never });
    expect(bucket.major.map((q) => q.symbol)).toEqual(['BTC', 'ETH']);
    expect(bucket.alts.map((q) => q.symbol)).toEqual(['XRP']);
    expect(bucket.major[0].name).toBe('비트코인');
    expect(bucket.major[0].pctChangeDay).toBeCloseTo(1.01, 2);
    expect(bucket.major[0].spark?.length).toBe(3);
  });

  it('handles candle failure gracefully', async () => {
    const ticker = [
      {
        market: 'KRW-BTC',
        trade_price: 1,
        opening_price: 1,
        high_price: 1,
        low_price: 1,
        signed_change_rate: 0,
        acc_trade_price_24h: 0,
        timestamp: 1,
      },
    ];
    const fetchJsonStub = (async (url: string) => {
      if (url.includes('/ticker?')) return ticker;
      throw new Error('candles down');
    }) as never;
    const bucket = await fetchUpbitBucket({ fetchJson: fetchJsonStub });
    expect(bucket.major[0].spark).toEqual([]);
  });
});

describe('yahoo fetchers', () => {
  function chartFor(symbol: string, last: number, prev: number, closes: number[]) {
    return {
      chart: {
        result: [
          {
            meta: { symbol, regularMarketPrice: last, previousClose: prev, chartPreviousClose: prev, regularMarketTime: 1700000000 },
            indicators: { quote: [{ close: closes }] },
          },
        ],
      },
    };
  }

  it('builds US bucket with bigtech + indices, skipping failures', async () => {
    const fetchJsonStub = (async (url: string) => {
      if (url.includes('AAPL')) return chartFor('AAPL', 200, 198, [180, 190, 195, 198, 200]);
      if (url.includes('MSFT')) return chartFor('MSFT', 400, 395, [380, 390, 395, 398, 400]);
      if (url.includes('GOOGL')) throw new Error('boom');
      if (url.includes('AMZN')) return chartFor('AMZN', 150, 148, [140, 145, 148, 149, 150]);
      if (url.includes('TSLA')) return chartFor('TSLA', 250, 240, [200, 220, 240, 245, 250]);
      if (url.includes('NVDA')) return chartFor('NVDA', 900, 880, [800, 850, 880, 890, 900]);
      if (url.includes('META')) return chartFor('META', 500, 495, [470, 480, 490, 495, 500]);
      if (url.includes('%5EGSPC')) return chartFor('^GSPC', 5000, 4990, [4900, 4950, 4970, 4990, 5000]);
      if (url.includes('%5EIXIC')) return chartFor('^IXIC', 16000, 15900, [15800, 15850, 15900, 15950, 16000]);
      if (url.includes('%5EDJI')) return chartFor('^DJI', 38000, 37900, [37500, 37700, 37900, 37950, 38000]);
      throw new Error('unhandled ' + url);
    }) as never;
    const us = await fetchYahooUsBucket({ fetchJson: fetchJsonStub });
    expect(us.bigtech.map((q) => q.symbol).sort()).toEqual(['AAPL', 'AMZN', 'META', 'MSFT', 'NVDA', 'TSLA']);
    expect(us.indices.map((q) => q.symbol).sort()).toEqual(['^DJI', '^GSPC', '^IXIC']);
    expect(us.bigtech.find((q) => q.symbol === 'AAPL')?.name).toBe('Apple');
  });

  it('builds macro FX bucket', async () => {
    const fetchJsonStub = (async (url: string) => chartFor('KRW=X', 1350, 1340, [1300, 1320, 1340, 1345, 1350])) as never;
    const macro = await fetchYahooMacroBucket({ fetchJson: fetchJsonStub });
    expect(macro.fx.length).toBeGreaterThan(0);
    expect(macro.fx[0].pctChangeDay).toBeCloseTo(0.746, 2);
  });
});

describe('kr fetcher', () => {
  it('groups symbols into kospi/kosdaq/etfs', async () => {
    const chart = (sym: string) => ({
      chart: {
        result: [
          {
            meta: { symbol: sym, regularMarketPrice: 100, previousClose: 99, chartPreviousClose: 99, regularMarketTime: 1 },
            indicators: { quote: [{ close: [90, 95, 100] }] },
          },
        ],
      },
    });
    const stub = (async (url: string) => {
      if (url.includes('%5EKS11')) return chart('^KS11');
      if (url.includes('%5EKQ11')) return chart('^KQ11');
      if (url.includes('005930')) return chart('005930.KS');
      if (url.includes('000660')) return chart('000660.KS');
      if (url.includes('035420')) return chart('035420.KS');
      if (url.includes('069500')) return chart('069500.KS');
      if (url.includes('360750')) return chart('360750.KS');
      if (url.includes('102110')) return chart('102110.KS');
      throw new Error('unhandled');
    }) as never;
    const kr = await fetchKrBucket({ fetchJson: stub });
    expect(kr.kospi.length).toBe(4);
    expect(kr.kosdaq.length).toBe(1);
    expect(kr.etfs.length).toBe(3);
  });
});

describe('rss parser + filter', () => {
  it('parses standard rss 2.0', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Fed cuts interest rates</title><link>https://example.com/a</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate><description>desc</description></item>
      <item><title>코스피 강세</title><link>https://example.com/b</link><pubDate>Mon, 01 Jan 2026 00:00:00 GMT</pubDate></item>
      <item><title>cooking recipe</title><link>https://example.com/c</link></item>
    </channel></rss>`;
    const items = parseRss(xml, 'TestRSS');
    expect(items.length).toBe(3);
    expect(items[0].source).toBe('TestRSS');
    expect(items[0].title).toBe('Fed cuts interest rates');
  });

  it('filters by relevance keywords', () => {
    const xml = `<?xml version="1.0"?><rss><channel>
      <item><title>Fed rate decision</title><link>https://x/1</link></item>
      <item><title>cooking recipe</title><link>https://x/2</link></item>
      <item><title>코스피 종가</title><link>https://x/3</link></item>
    </channel></rss>`;
    const all = parseRss(xml, 'X');
    const filtered = filterRelevant(all);
    expect(filtered.map((n) => n.title).sort()).toEqual(['Fed rate decision', '코스피 종가']);
  });

  it('parses atom feed entries', () => {
    const xml = `<?xml version="1.0"?><feed>
      <entry><title>Bitcoin hits new high</title><link href="https://x/btc"/><pubDate>2026-01-01</pubDate></entry>
    </feed>`;
    const items = parseRss(xml, 'Atom');
    expect(items.length).toBe(1);
    expect(items[0].url).toBe('https://x/btc');
  });

  it('fetchNews aggregates from sources and limits', async () => {
    const xmlA = `<?xml version="1.0"?><rss><channel>
      <item><title>Stock market rallies</title><link>https://a/1</link></item>
      <item><title>Crypto winter</title><link>https://a/2</link></item>
    </channel></rss>`;
    const xmlB = `<?xml version="1.0"?><rss><channel>
      <item><title>코스피 마감</title><link>https://b/1</link></item>
    </channel></rss>`;
    const ft = (async (url: string) => (url.includes('A') ? xmlA : xmlB)) as never;
    const news = await fetchNews({
      fetchText: ft,
      sources: [
        { source: 'A', url: 'https://A' },
        { source: 'B', url: 'https://B' },
      ],
      limit: 2,
    });
    expect(news.length).toBe(2);
  });
});

describe('normalize collectReportData', () => {
  it('records errors per source without throwing', async () => {
    const data = await collectReportData({ classes: [] });
    expect(Array.isArray(data.errors)).toBe(true);
    expect(typeof data.generatedAt).toBe('string');
    expect(data.crypto).toBeUndefined();
  });
});
