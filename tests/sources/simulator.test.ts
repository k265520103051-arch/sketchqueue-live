import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { SimulatorSource, TEST_GIFTS } from '../../src/sources/simulator';
import type { LiveEvent } from '../../src/core/events';

let src: SimulatorSource;
let events: LiveEvent[];
let off: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  src = new SimulatorSource({ intervalMs: 1500, now: () => 0, random: () => 0.3 });
  events = [];
  off = src.onEvent(e => events.push(e));
});
afterEach(() => vi.useRealTimers());

test('start phát connected rồi sự kiện định kỳ', async () => {
  await src.start();
  expect(events[0]).toMatchObject({ type: 'status', state: 'connected', roomId: 'rehearsal' });
  vi.advanceTimersByTime(4500);
  expect(events.length).toBe(4);
  await src.stop();
});
test('stop dừng phát và idempotent', async () => {
  await src.start(); await src.stop(); await src.stop();
  const n = events.length; vi.advanceTimersByTime(10_000);
  expect(events.length).toBe(n);
  expect(events.filter(e => e.type === 'status' && e.state === 'disconnected').length).toBe(1);
});
test('stop khi chưa start không phát gì', async () => { await src.stop(); expect(events).toEqual([]); });
test('emitGift nhân xu', () => {
  src.emitGift('mai_test', 'Rose', 1, 5);
  expect(events.at(-1)).toMatchObject({ type: 'gift', coins: 5, count: 5, giftName: 'Rose' });
});
test('handle rỗng dùng người thử đầu tiên', () => {
  src.emitComment('', 'xin chào');
  expect((events.at(-1) as { user: { handle: string } }).user.handle).toBe('mai_test');
});
test('handle lạ tạo người dùng sim:', () => {
  src.emitLikes('khach', 3);
  expect(events.at(-1)).toMatchObject({ type: 'like', count: 3, user: { userId: 'sim:khach', handle: 'khach' } });
});
test('huỷ đăng ký', () => { off(); src.emitLikes('a', 10); expect(events.length).toBe(0); });
test('TEST_GIFTS', () => { expect(TEST_GIFTS).toEqual([{ name: 'Rose', coins: 1 }, { name: 'Mũ', coins: 99 }]); });
