import type { LiveEvent } from './events';
import type { Settings } from './settings';

export type RulesContext = {
  queueSize: number;
  /** Thời điểm quà hợp lệ gần nhất của bất kỳ ai trong buổi. */
  lastGiftAt: number | null;
  sessionStartAt: number;
  /** Số ngẫu nhiên 0 ≤ roll < 1 đã rút sẵn cho sự kiện này. */
  roll: number;
};

export type Decision =
  | { action: 'enqueue'; reason: 'gift' | 'free'; coins: number; label: string; via?: 'idle' | 'chance' }
  | { action: 'owe' }
  | { action: 'decline' }
  | { action: 'ignore' };

/** Trả phần chữ sau từ khoá, hoặc null nếu bình luận không phải lời xin vẽ. */
export function matchFreeRequest(text: string, keyword: string): string | null {
  const t = text.trim();
  const kw = keyword.toLowerCase();
  const low = t.toLowerCase();
  if (low === kw) return '';
  if (low.startsWith(kw) && /\s/.test(t.charAt(kw.length))) return t.slice(kw.length).trim();
  return null;
}

export function decide(e: LiveEvent, s: Settings, ctx: RulesContext): Decision {
  if (e.type === 'gift') {
    if (e.coins < s.minCoins) return { action: 'ignore' };
    if (!s.acceptingGifts) return { action: 'owe' };
    return { action: 'enqueue', reason: 'gift', coins: e.coins, label: `${e.giftName} ×${e.count}` };
  }
  if (e.type !== 'comment') return { action: 'ignore' };
  const rest = matchFreeRequest(e.text, s.freeKeyword);
  if (rest === null) return { action: 'ignore' };
  if (!s.allowFreeRequests) return { action: 'decline' };
  if (ctx.queueSize >= s.freeQueueLimit) return { action: 'decline' };
  const label = rest === '' ? 'xin vẽ' : rest;
  if (e.at - (ctx.lastGiftAt ?? ctx.sessionStartAt) >= s.freeIdleMs) {
    return { action: 'enqueue', reason: 'free', coins: 0, label, via: 'idle' };
  }
  if (ctx.roll < s.freeChance) return { action: 'enqueue', reason: 'free', coins: 0, label, via: 'chance' };
  return { action: 'decline' };
}
