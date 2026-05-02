import type { AssetClass } from '../data/types';
import { addUsage, emptyUsage } from './pricing';
import { extractJson, withRetry } from './parser';
import { CATEGORY_OUTPUT_SCHEMA, CONCLUDE_OUTPUT_SCHEMA, buildSystem } from './prompts';
import type {
  AnalyzeDeps,
  CategoryAnalysis,
  FinalReport,
  RawData,
  ReportConclusion,
  TokenUsage,
} from './types';

const CATEGORY_LABEL: Record<AssetClass | 'macro', string> = {
  crypto: '암호화폐',
  us: '미국 주식',
  kr: '한국 주식/ETF',
  macro: '거시·뉴스',
};

function pickCategoryPayload(data: RawData, cat: AssetClass | 'macro'): unknown {
  if (cat === 'crypto') return data.crypto ?? null;
  if (cat === 'us') return data.us ?? null;
  if (cat === 'kr') return data.kr ?? null;
  return { macro: data.macro ?? null, news: data.news.slice(0, 8) };
}

async function analyzeCategory(
  cat: AssetClass | 'macro',
  data: RawData,
  deps: AnalyzeDeps,
  system: ReturnType<typeof buildSystem>,
): Promise<{ analysis: CategoryAnalysis; usageDelta: ReturnType<typeof addUsage> }> {
  const payload = pickCategoryPayload(data, cat);
  if (!payload) {
    return {
      analysis: {
        category: cat,
        headline: `${CATEGORY_LABEL[cat]} 데이터가 없어요`,
        metaphor: '오늘은 이 카테고리의 도시락이 비어 있어요.',
        evidence: [],
        kidExplain: '데이터를 못 가져왔어요. 인터넷이나 API 키를 확인해보세요.',
        actions: ['다시 시도하기'],
      },
      usageDelta: emptyUsage(deps.modelId),
    };
  }
  const userPrompt = `카테고리: ${CATEGORY_LABEL[cat]}
오늘 데이터(JSON):
${JSON.stringify(payload).slice(0, 8000)}

${CATEGORY_OUTPUT_SCHEMA}`;

  const { res, parsed } = await withRetry(async () => {
    const r = await deps.client.messages.create({
      model: deps.modelId,
      max_tokens: 1200,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = r.content.map((c) => c.text).join('\n');
    const p = extractJson<Omit<CategoryAnalysis, 'category'>>(text);
    return { res: r, parsed: p };
  });

  const delta = addUsage(emptyUsage(deps.modelId), res);
  return {
    analysis: {
      category: cat,
      headline: parsed.headline,
      metaphor: parsed.metaphor,
      evidence: parsed.evidence ?? [],
      kidExplain: parsed.kidExplain,
      actions: parsed.actions ?? [],
    },
    usageDelta: delta,
  };
}

async function concludeReport(
  data: RawData,
  categories: CategoryAnalysis[],
  deps: AnalyzeDeps,
  system: ReturnType<typeof buildSystem>,
): Promise<{ conclusion: ReportConclusion; usageDelta: TokenUsage }> {
  const userPrompt = `카테고리별 분석 요약:
${JSON.stringify(categories).slice(0, 6000)}

뉴스 헤드라인:
${data.news.slice(0, 6).map((n) => `- ${n.title} (${n.source})`).join('\n')}

${CONCLUDE_OUTPUT_SCHEMA}`;

  const { res, parsed } = await withRetry(async () => {
    const r = await deps.client.messages.create({
      model: deps.modelId,
      max_tokens: 900,
      temperature: 0.4,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = r.content.map((c) => c.text).join('\n');
    const p = extractJson<ReportConclusion>(text);
    return { res: r, parsed: p };
  });
  return { conclusion: parsed, usageDelta: addUsage(emptyUsage(deps.modelId), res) };
}

export async function analyzeReport(
  data: RawData,
  deps: AnalyzeDeps,
  classes: (AssetClass | 'macro')[] = ['crypto', 'us', 'kr', 'macro'],
): Promise<FinalReport> {
  const system = buildSystem(deps.userProfile, deps.toneStrength);
  let usage = emptyUsage(deps.modelId);

  const catResults = await Promise.all(classes.map((c) => analyzeCategory(c, data, deps, system)));
  for (const r of catResults) {
    usage = mergeUsage(usage, r.usageDelta);
  }

  const { conclusion, usageDelta } = await concludeReport(
    data,
    catResults.map((r) => r.analysis),
    deps,
    system,
  );
  usage = mergeUsage(usage, usageDelta);

  return {
    generatedAt: data.generatedAt,
    oneLiner: conclusion.oneLiner,
    categories: catResults.map((r) => r.analysis),
    news: data.news,
    conclusion,
    usage,
  };
}

function mergeUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    modelId: a.modelId,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationInputTokens: a.cacheCreationInputTokens + b.cacheCreationInputTokens,
    cacheReadInputTokens: a.cacheReadInputTokens + b.cacheReadInputTokens,
    estimatedUsd: a.estimatedUsd + b.estimatedUsd,
  };
}
