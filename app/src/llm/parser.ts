export class LlmParseError extends Error {}

export function extractJson<T = unknown>(text: string): T {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new LlmParseError(`no JSON object found: ${stripped.slice(0, 80)}`);
  }
  const slice = stripped.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch (e) {
    throw new LlmParseError(`invalid JSON: ${(e as Error).message}`);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!(e instanceof LlmParseError)) throw e;
    }
  }
  throw lastErr;
}
