import { expect, test } from 'vitest';
import { EMPTY_STATS, reduceStats } from '../../src/core/stats';
import type { LiveEvent, LiveUser } from '../../src/core/events';

const u = (id: string): LiveUser => ({ userId: id, handle: id, nickname: id, avatarUrl: null });
const gift = (id: string, coins: number): LiveEvent => ({ type: 'gift', user: u(id), giftName: 'Rose', coins, count: 1, at: 0 });
const join = (id: string): LiveEvent => ({ type: 'join', user: u(id), at: 0 });

test('quà cộng xu, lượt quà, người tặng duy nhất', () => {
  const s = [gift('a', 5), gift('b', 1), gift('a', 2)].reduce(reduceStats, EMPTY_STATS);
  expect(s).toMatchObject({ coins: 8, giftCount: 3, gifters: 2 });
  expect(s.topGifters.map(t => [t.user.userId, t.coins])).toEqual([['a', 7], ['b', 1]]);
});
test('top chỉ giữ 3', () => {
  const s = [gift('a', 1), gift('b', 2), gift('c', 3), gift('d', 4)].reduce(reduceStats, EMPTY_STATS);
  expect(s.topGifters.map(t => t.coins)).toEqual([4, 3, 2]);
});
test('viewers ghi đè, like cộng dồn, follow và comment đếm', () => {
  const evs: LiveEvent[] = [
    { type: 'viewers', count: 150, at: 0 }, { type: 'viewers', count: 140, at: 0 },
    { type: 'like', user: u('a'), count: 10, at: 0 }, { type: 'like', user: u('a'), count: 5, at: 0 },
    { type: 'follow', user: u('a'), at: 0 }, { type: 'comment', user: u('a'), text: 'x', at: 0 },
  ];
  expect(evs.reduce(reduceStats, EMPTY_STATS)).toMatchObject({ viewers: 140, likes: 15, newFollowers: 1, comments: 1 });
});
test('status và join không đổi số liệu', () => {
  expect(reduceStats(EMPTY_STATS, join('a'))).toEqual(EMPTY_STATS);
  expect(reduceStats(EMPTY_STATS, { type: 'status', state: 'connected', at: 0 })).toEqual(EMPTY_STATS);
});
test('không sửa đối tượng đầu vào', () => {
  const f = Object.freeze({ ...EMPTY_STATS, coinsByUser: Object.freeze({}) });
  expect(() => reduceStats(f, gift('a', 1))).not.toThrow();
});
