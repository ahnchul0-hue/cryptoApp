import { describe, expect, it, vi } from 'vitest';
import { addUsage, emptyUsage, priceFor } from '../src/llm/pricing';
import { extractJson, LlmParseError, withRetry } from '../src/llm/parser';
import { buildSystem } from '../src/llm/prompts';
import { analyzeReport } from '../src/llm/analyze';
import type { LlmClient, MessageResponse } from '../src/llm/types';
import type { RawReportData } from '../src/data/types';

describe('pricing.addUsage', () => {
  it('charges sonnet rates and accumulates', () => {
    let acc = emptyUsage('claude-sonnet-4-6');
    const res: MessageResponse = {
      content: [{ type: 'text', text: '{}' }],
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    };
    acc = addUsage(acc, res);
    const p = priceFor('claude-sonnet-4-6');
    const expected = (1000 * p.input + 500 * p.output) / 1_000_000;
    expect(acc.estimatedUsd).toBeCloseTo(expected, 6);
    expect(acc.inputTokens).toBe(1000);
    acc = addUsage(acc, res);
    expect(acc.estimatedUsd).toBeCloseTo(expected * 2, 6);
  });

  it('credits cache reads at lower rate', () => {
    let acc = emptyUsage('claude-sonnet-4-6');
    const res: MessageResponse = {
      content: [],
      usage: {
        input_tokens: 100,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 1000,
      },
    };
    acc = addUsage(acc, res);
    const p = priceFor('claude-sonnet-4-6');
    expect(acc.estimatedUsd).toBeCloseTo((100 * p.input + 1000 * p.cacheRead) / 1_000_000, 6);
  });

  it('falls back to sonnet pricing on unknown model', () => {
    expect(priceFor('claude-mystery-9-9').input).toBe(3);
  });
});

describe('parser.extractJson', () => {
  it('parses pure JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips fenced blocks', () => {
    const txt = '```json\n{"a":2}\n```';
    expect(extractJson(txt)).toEqual({ a: 2 });
  });
  it('extracts JSON with leading prose', () => {
    const txt = 'Here you go:\n{"hello":"world"}\nthanks';
    expect(extractJson(txt)).toEqual({ hello: 'world' });
  });
  it('throws LlmParseError on garbage', () => {
    expect(() => extractJson('no json here')).toThrowError(LlmParseError);
  });
});

describe('parser.withRetry', () => {
  it('retries on LlmParseError and succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      calls += 1;
      if (calls < 2) throw new LlmParseError('first try bad');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });
  it('rethrows non-parse errors immediately', async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls += 1;
        throw new Error('network');
      }),
    ).rejects.toThrow('network');
    expect(calls).toBe(1);
  });
});

describe('prompts.buildSystem', () => {
  it('marks both blocks as ephemeral cache', () => {
    const blocks = buildSystem();
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b.cache_control).toEqual({ type: 'ephemeral' });
      expect(b.type).toBe('text');
    }
  });
  it('softens tone at strength 0', () => {
    const blocks = buildSystem(undefined, 0);
    expect(blocks[0].text).toContain('쉬운 한국어');
  });
  it('uses custom user profile when provided', () => {
    const blocks = buildSystem('주식만 봐주세요', 1);
    expect(blocks[1].text).toBe('주식만 봐주세요');
  });
});

describe('analyzeReport pipeline', () => {
  function makeData(): RawReportData {
    return {
      generatedAt: '2026-01-01T00:00:00Z',
      crypto: {
        major: [
          {
            symbol: 'BTC',
            name: '비트코인',
            priceClose: 100000000,
            priceOpen: 99000000,
            pctChangeDay: 1.01,
            asOf: '2026-01-01T00:00:00Z',
          },
        ],
        alts: [],
      },
      us: { bigtech: [], indices: [] },
      kr: { kospi: [], kosdaq: [], etfs: [] },
      macro: { fx: [] },
      news: [{ title: 'Fed news', url: 'https://x/1', source: 'Test', publishedAt: '2026-01-01' }],
      errors: [],
    };
  }

  function makeClient(): { client: LlmClient; calls: { model: string; system?: unknown }[] } {
    const calls: { model: string; system?: unknown }[] = [];
    const client: LlmClient = {
      messages: {
        create: vi.fn(async (req) => {
          calls.push({ model: req.model, system: req.system });
          const isConclude = req.messages[0].content.includes('카테고리별 분석 요약');
          const text = isConclude
            ? JSON.stringify({
                oneLiner: '오늘은 도시락이 알차요',
                fitForUser: { invest: ['BTC 분할매수'], avoid: ['뇌동매매'] },
                rationale: '사용자 프로필상 BTC 분할매수가 유효합니다.',
              })
            : JSON.stringify({
                headline: '비트코인이 살짝 올랐어요',
                metaphor: '롤러코스터 1칸 위로',
                evidence: [{ label: 'BTC', value: '+1.01%' }],
                kidExplain: '오늘 BTC 가격이 어제보다 살짝 더 올랐어요.',
                actions: ['관망'],
              });
          return {
            content: [{ type: 'text' as const, text }],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 10,
              cache_read_input_tokens: 5,
            },
          };
        }),
      },
    };
    return { client, calls };
  }

  it('runs categories in parallel then conclude, accumulating usage', async () => {
    const { client, calls } = makeClient();
    const report = await analyzeReport(makeData(), { client, modelId: 'claude-sonnet-4-6' });
    expect(report.categories.map((c) => c.category)).toEqual(['crypto', 'us', 'kr', 'macro']);
    expect(report.oneLiner).toBe('오늘은 도시락이 알차요');
    expect(report.conclusion.fitForUser.invest).toContain('BTC 분할매수');
    expect(calls.length).toBe(5);
    expect(report.usage.inputTokens).toBe(500);
    expect(report.usage.outputTokens).toBe(250);
    expect(report.usage.cacheReadInputTokens).toBe(25);
  });

  it('passes ephemeral cache_control on every system block', async () => {
    const { client, calls } = makeClient();
    await analyzeReport(makeData(), { client, modelId: 'claude-sonnet-4-6' });
    for (const c of calls) {
      const sys = c.system as { cache_control?: { type: string } }[];
      expect(sys.length).toBe(2);
      for (const block of sys) expect(block.cache_control).toEqual({ type: 'ephemeral' });
    }
  });

  it('returns placeholder analysis when category data is missing', async () => {
    const { client } = makeClient();
    const data = makeData();
    data.crypto = undefined;
    const report = await analyzeReport(data, { client, modelId: 'claude-sonnet-4-6' });
    const crypto = report.categories.find((c) => c.category === 'crypto')!;
    expect(crypto.headline).toContain('데이터가 없어요');
  });
});
