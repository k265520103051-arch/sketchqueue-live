import { beforeEach, expect, test } from 'vitest';
import { DrawQueue, type NewEntry } from '../../src/core/queue';
import type { LiveUser } from '../../src/core/events';

const u = (id: string): LiveUser => ({ userId: id, handle: id + '_test', nickname: id, avatarUrl: null });
const g = (id: string, coins: number): NewEntry => ({ user: u(id), reason: 'gift', coins, label: 'Rose' });
const free = (id: string): NewEntry => ({ user: u(id), reason: 'free', coins: 0, label: 'xin vẽ' });
const manual = (id: string): NewEntry => ({ user: u(id), reason: 'manual', coins: 0, label: 'tự nhập' });
const O = { combineWindowMs: 60000, max: 50 };
let q: DrawQueue;
const ids = () => q.list().map(e => e.user.userId);
beforeEach(() => { q = new DrawQueue(); });

test('xu cao vẽ trước, bằng xu thì vào trước vẽ trước', () => { q.add(g('a', 1), 0, O); q.add(g('b', 5), 1, O); q.add(g('c', 1), 2, O); expect(ids()).toEqual(['b', 'a', 'c']); });
test('gộp trong cửa sổ', () => { q.add(g('a', 1), 0, O); const r = q.add(g('a', 2), 30_000, O); expect(r.result).toBe('merged'); expect(q.size).toBe(1); expect(q.list()[0]).toMatchObject({ coins: 3, gifts: 2, lastGiftAt: 30_000, enqueuedAt: 0 }); });
test('cửa sổ tính từ quà gần nhất, không phải quà đầu', () => { q.add(g('a', 1), 0, O); q.add(g('a', 1), 50_000, O); expect(q.add(g('a', 1), 100_000, O).result).toBe('merged'); });
test('đúng biên 60 000 ms vẫn gộp, 60 001 thì không', () => { q.add(g('a', 1), 0, O); expect(q.add(g('a', 1), 60_000, O).result).toBe('merged'); expect(q.add(g('a', 1), 120_001, O).result).toBe('added'); expect(q.size).toBe(2); });
test('combineWindowMs 0 chỉ gộp quà cùng mili giây', () => { const Z = { ...O, combineWindowMs: 0 }; q.add(g('a', 1), 5, Z); expect(q.add(g('a', 1), 5, Z).result).toBe('merged'); expect(q.add(g('a', 1), 6, Z).result).toBe('added'); });
test('gộp làm đổi thứ tự', () => { q.add(g('a', 1), 0, O); q.add(g('b', 5), 0, O); q.add(g('a', 10), 1000, O); expect(ids()).toEqual(['a', 'b']); });
test('quà thay lượt miễn phí của cùng người', () => { q.add(free('a'), 0, O); const r = q.add(g('a', 1), 10, O); expect(r.result).toBe('added'); expect(q.size).toBe(1); expect(q.list()[0].reason).toBe('gift'); });
test('miễn phí/thủ công trùng người → duplicate', () => { q.add(g('a', 1), 0, O); expect(q.add(free('a'), 1, O).result).toBe('duplicate'); q.add(free('b'), 2, O); expect(q.add(manual('b'), 3, O).result).toBe('duplicate'); expect(q.size).toBe(2); });
test('đầy → full; gộp vẫn được khi đầy', () => { const M = { ...O, max: 1 }; q.add(g('a', 1), 0, M); expect(q.add(g('b', 9), 1, M).result).toBe('full'); expect(q.add(g('a', 2), 2, M).result).toBe('merged'); });
test('takeEligible tôn trọng độ trễ và không để ai bị chặn', () => {
  q.add(g('b', 1), 0, O); q.add(g('a', 5), 1000, O);
  expect(q.takeEligible(2000, 3000)).toBeNull();
  expect(q.takeEligible(3000, 3000)!.user.userId).toBe('b');
  expect(q.takeEligible(3999, 3000)).toBeNull();
  expect(q.takeEligible(4000, 3000)!.user.userId).toBe('a');
  expect(q.size).toBe(0);
});
test('stageDelayMs 0 → lấy ngay lượt đầu', () => { q.add(g('a', 1), 7, O); expect(q.takeEligible(7, 0)!.user.userId).toBe('a'); });
test('ghim vượt xu; ghim sau xếp trước', () => {
  q.add(g('a', 9), 0, O); q.add(g('b', 1), 1, O); q.add(g('c', 1), 2, O);
  const id = (x: string) => q.list().find(e => e.user.userId === x)!.id;
  expect(q.moveToFront(id('b'))).toBe(true); expect(q.moveToFront(id('c'))).toBe(true);
  expect(ids()).toEqual(['c', 'b', 'a']);
  expect(q.moveToFront('nope')).toBe(false);
});
test('pushFront cho id mới và đứng đầu', () => {
  q.add(g('a', 1), 0, O); const a = q.takeEligible(0, 0)!;
  q.add(g('b', 99), 1, O);
  const again = q.pushFront(a, 2);
  expect(ids()).toEqual(['a', 'b']); expect(again.id).not.toBe(a.id);
});
test('remove / clear / rỗng', () => {
  q.add(g('a', 1), 0, O); q.add(g('b', 1), 0, O);
  expect(q.remove('nope')).toBe(false);
  expect(q.remove(q.list()[0].id)).toBe(true); expect(q.size).toBe(1);
  q.clear(); expect(q.size).toBe(0); expect(q.takeEligible(10, 0)).toBeNull();
});
test('id là duy nhất', () => { for (let i = 0; i < 100; i++) q.add(g('u' + i, 1), i, { ...O, max: 100 }); expect(new Set(q.list().map(e => e.id)).size).toBe(100); });
