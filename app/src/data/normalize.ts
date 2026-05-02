import type { AssetClass, RawReportData } from './types';
import { fetchUpbitBucket } from './upbit';
import { fetchYahooMacroBucket, fetchYahooUsBucket } from './yahoo';
import { fetchKrBucket } from './kr';
import { fetchNews } from './news';

export interface CollectOpts {
  classes?: AssetClass[];
  signal?: AbortSignal;
  onProgress?: (step: string) => void;
}

export async function collectReportData(opts: CollectOpts = {}): Promise<RawReportData> {
  const classes = opts.classes ?? ['crypto', 'us', 'kr'];
  const errors: { source: string; message: string }[] = [];
  const log = (s: string) => opts.onProgress?.(s);

  const wantCrypto = classes.includes('crypto');
  const wantUs = classes.includes('us');
  const wantKr = classes.includes('kr');

  log('수집 시작');
  const [crypto, us, kr, macro, news] = await Promise.all([
    wantCrypto
      ? fetchUpbitBucket().catch((e: Error) => {
          errors.push({ source: 'upbit', message: e.message });
          return undefined;
        })
      : Promise.resolve(undefined),
    wantUs
      ? fetchYahooUsBucket().catch((e: Error) => {
          errors.push({ source: 'yahoo-us', message: e.message });
          return undefined;
        })
      : Promise.resolve(undefined),
    wantKr
      ? fetchKrBucket().catch((e: Error) => {
          errors.push({ source: 'yahoo-kr', message: e.message });
          return undefined;
        })
      : Promise.resolve(undefined),
    fetchYahooMacroBucket().catch((e: Error) => {
      errors.push({ source: 'yahoo-macro', message: e.message });
      return undefined;
    }),
    fetchNews().catch((e: Error) => {
      errors.push({ source: 'news', message: e.message });
      return [];
    }),
  ]);
  log('수집 완료');

  return {
    generatedAt: new Date().toISOString(),
    crypto,
    us,
    kr,
    macro,
    news,
    errors,
  };
}
