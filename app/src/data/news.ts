import { XMLParser } from 'fast-xml-parser';
import type { NewsItem } from './types';
import { fetchText } from '../util/http';

export interface NewsSource {
  source: string;
  url: string;
}

const DEFAULT_SOURCES: NewsSource[] = [
  { source: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' },
  { source: '한국경제', url: 'https://www.hankyung.com/feed/all-news' },
];

const KEYWORDS_INCLUDE = [
  'stock', 'market', 'fed', 'rate', 'inflation', 'earnings', 'crypto', 'bitcoin', 'ethereum',
  '증시', '주가', '코스피', '코스닥', '환율', '금리', '물가', '비트코인', '이더리움', '달러',
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: true,
});

interface RssItem {
  title?: string | { '#text'?: string };
  link?: string | { '@_href'?: string; '#text'?: string };
  pubDate?: string;
  description?: string;
  'dc:date'?: string;
}

function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && '#text' in v) return String((v as { '#text'?: string })['#text'] ?? '');
  return '';
}

function asLink(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const o = v as { '@_href'?: string; '#text'?: string };
    return o['@_href'] ?? o['#text'] ?? '';
  }
  return '';
}

export function parseRss(xml: string, source: string): NewsItem[] {
  const parsed = parser.parse(xml) as { rss?: { channel?: { item?: RssItem | RssItem[] } }; feed?: { entry?: RssItem | RssItem[] } };
  const rawItems = parsed.rss?.channel?.item ?? parsed.feed?.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];
  return items
    .filter((it) => it && (it.title || it.link))
    .map((it) => ({
      title: asText(it.title).trim(),
      url: asLink(it.link).trim(),
      source,
      publishedAt: it.pubDate ?? it['dc:date'] ?? new Date().toISOString(),
      summary: it.description ? asText(it.description).slice(0, 280) : undefined,
    }))
    .filter((n) => n.title && n.url);
}

export function filterRelevant(items: NewsItem[], keywords: string[] = KEYWORDS_INCLUDE): NewsItem[] {
  const lc = keywords.map((k) => k.toLowerCase());
  return items.filter((n) => {
    const blob = (n.title + ' ' + (n.summary ?? '')).toLowerCase();
    return lc.some((k) => blob.includes(k));
  });
}

export interface NewsDeps {
  fetchText?: typeof fetchText;
  sources?: NewsSource[];
  limit?: number;
  keywords?: string[];
}

export async function fetchNews(deps: NewsDeps = {}): Promise<NewsItem[]> {
  const ft = deps.fetchText ?? fetchText;
  const sources = deps.sources ?? DEFAULT_SOURCES;
  const limit = deps.limit ?? 12;
  const settled = await Promise.allSettled(
    sources.map(async (s) => {
      const xml = await ft(s.url, { headers: { 'User-Agent': 'Mozilla/5.0 cryptoApp/1.0' } });
      return parseRss(xml, s.source);
    }),
  );
  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  return filterRelevant(all, deps.keywords).slice(0, limit);
}
