export type Settings = {
  minCoins: number;
  combineWindowMs: number;
  maxQueue: number;
  acceptingGifts: boolean;
  allowFreeRequests: boolean;
  freeKeyword: string;
  freeIdleMs: number;
  freeChance: number;
  freeQueueLimit: number;
  colorMinCoins: number;
  drawSeconds: number;
  stageDelayMs: number;
};

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  minCoins: 1,
  combineWindowMs: 60_000,
  maxQueue: 50,
  acceptingGifts: true,
  allowFreeRequests: true,
  freeKeyword: '!ve',
  freeIdleMs: 120_000,
  freeChance: 0.1,
  freeQueueLimit: 3,
  colorMinCoins: 99,
  drawSeconds: 45,
  stageDelayMs: 3000,
}) as Settings;

type NumRule = { min: number; max: number; int: boolean };

const NUM_RULES: Record<string, NumRule> = {
  minCoins: { min: 1, max: Number.MAX_SAFE_INTEGER, int: true },
  combineWindowMs: { min: 0, max: 600_000, int: false },
  maxQueue: { min: 1, max: 500, int: true },
  freeIdleMs: { min: 0, max: 3_600_000, int: false },
  freeChance: { min: 0, max: 1, int: false },
  freeQueueLimit: { min: 0, max: 50, int: true },
  colorMinCoins: { min: 1, max: Number.MAX_SAFE_INTEGER, int: true },
  drawSeconds: { min: 5, max: 600, int: false },
  stageDelayMs: { min: 0, max: 60_000, int: false },
};

const BOOL_KEYS = ['acceptingGifts', 'allowFreeRequests'] as const;

function cleanKeyword(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length < 1 || t.length > 20 || /\s/.test(t)) return null;
  return t;
}

export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const out: Settings = { ...base };
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return out;
  const src = input as Record<string, unknown>;

  for (const [key, rule] of Object.entries(NUM_RULES)) {
    const v = src[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    let n = rule.int ? Math.floor(v) : v;
    n = Math.min(rule.max, Math.max(rule.min, n));
    (out as Record<string, unknown>)[key] = n;
  }
  for (const key of BOOL_KEYS) {
    if (typeof src[key] === 'boolean') out[key] = src[key] as boolean;
  }
  const kw = cleanKeyword(src.freeKeyword);
  if (kw !== null) out.freeKeyword = kw;
  return out;
}
