import { expect, test } from 'vitest';
import { decide, type RulesContext } from '../../src/core/rules';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/settings';
import type { LiveEvent, LiveUser } from '../../src/core/events';

const user: LiveUser = { userId: 'a', handle: 'mai_test', nickname: 'Mai', avatarUrl: null };
const S = (p: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...p });
const C = (p: Partial<RulesContext> = {}): RulesContext => ({ queueSize: 0, lastGiftAt: null, sessionStartAt: 0, roll: 0.5, ...p });
const gift = (coins: number, at = 10_000): LiveEvent => ({ type: 'gift', user, giftName: 'Rose', coins, count: 1, at });
const cm = (text: string, at = 10_000): LiveEvent => ({ type: 'comment', user, text, at });

test('quà 1 xu', () => expect(decide(gift(1), S(), C())).toEqual({ action: 'enqueue', reason: 'gift', coins: 1, label: 'Rose ×1' }));
test('quà 0 xu', () => expect(decide(gift(0), S(), C())).toEqual({ action: 'ignore' }));
test('dưới ngưỡng', () => expect(decide(gift(5), S({ minCoins: 10 }), C())).toEqual({ action: 'ignore' }));
test('ngưng nhận quà', () => expect(decide(gift(5), S({ acceptingGifts: false }), C())).toEqual({ action: 'owe' }));
test('idle, có nội dung', () => expect(decide(cm('!ve con meo cam', 120_000), S(), C())).toEqual({ action: 'enqueue', reason: 'free', coins: 0, label: 'con meo cam', via: 'idle' }));
test('đủ chờ nhưng hàng chờ đầy 3', () => expect(decide(cm('!ve', 500_000), S(), C({ queueSize: 3 }))).toEqual({ action: 'decline' }));
test('chưa đủ chờ', () => expect(decide(cm('!ve', 119_999), S(), C())).toEqual({ action: 'decline' }));
test('100 s kể từ quà', () => expect(decide(cm('!ve', 200_000), S(), C({ lastGiftAt: 100_000 }))).toEqual({ action: 'decline' }));
test('120 s kể từ quà', () => expect(decide(cm('!ve', 220_000), S(), C({ lastGiftAt: 100_000 }))).toMatchObject({ action: 'enqueue', via: 'idle' }));
test('trúng tỉ lệ', () => expect(decide(cm('!ve'), S(), C({ roll: 0.09, queueSize: 2 }))).toMatchObject({ action: 'enqueue', via: 'chance' }));
test('roll bằng freeChance', () => expect(decide(cm('!ve'), S(), C({ roll: 0.1 }))).toEqual({ action: 'decline' }));
test('roll trúng nhưng hàng chờ 3', () => expect(decide(cm('!ve'), S(), C({ roll: 0.01, queueSize: 3 }))).toEqual({ action: 'decline' }));
test('tắt xin miễn phí', () => expect(decide(cm('!ve', 500_000), S({ allowFreeRequests: false }), C())).toEqual({ action: 'decline' }));
test('freeChance 0', () => expect(decide(cm('!ve'), S({ freeChance: 0 }), C({ roll: 0 }))).toEqual({ action: 'decline' }));
test('hoa thường + rỗng', () => expect(decide(cm('  !VE  ', 120_000), S(), C())).toMatchObject({ action: 'enqueue', label: 'xin vẽ' }));
test('không có khoảng trắng sau từ khoá', () => expect(decide(cm('!vexyz', 120_000), S(), C())).toEqual({ action: 'ignore' }));
test('từ khoá tuỳ chỉnh', () => expect(decide(cm('!draw x', 120_000), S({ freeKeyword: '!draw' }), C())).toMatchObject({ action: 'enqueue', label: 'x' }));
test('sự kiện khác bị bỏ qua', () => {
  const evs: LiveEvent[] = [cm('chào'), { type: 'like', user, count: 1, at: 0 }, { type: 'join', user, at: 0 }, { type: 'follow', user, at: 0 }, { type: 'viewers', count: 3, at: 0 }, { type: 'status', state: 'connected', at: 0 }];
  for (const e of evs) expect(decide(e, S(), C())).toEqual({ action: 'ignore' });
});
