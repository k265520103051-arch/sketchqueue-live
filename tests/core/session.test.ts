import { describe, expect, test, vi } from 'vitest';
import { Session } from '../../src/core/session';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/settings';
import type { LiveEvent, LiveUser } from '../../src/core/events';

const u = (id: string): LiveUser => ({ userId: id, handle: id + '_test', nickname: id, avatarUrl: null });
const gift = (id: string, coins: number, at: number): LiveEvent => ({ type: 'gift', user: u(id), giftName: 'Rose', coins, count: coins, at });
const cm = (id: string, text: string, at: number): LiveEvent => ({ type: 'comment', user: u(id), text, at });
function mk(p: Partial<Settings> = {}, opts: { random?: () => number; startAt?: number } = {}) {
  return new Session({ settings: { ...DEFAULT_SETTINGS, stageDelayMs: 0, ...p }, random: opts.random ?? (() => 0.5), startAt: opts.startAt ?? 0 });
}
function start(s: Session, now: number) {
  s.tick(now);
  const d = s.getState().drawing;
  if (d) s.command({ type: 'ready', id: d.entry.id }, now);
}
const st = (s: Session) => s.getState();

describe('Session', () => {
  test('1. quà vào hàng chờ, tick bắt đầu vẽ', () => {
    const s = mk(); s.handle(gift('a', 1, 0));
    expect(st(s).queue.length).toBe(1);
    s.tick(0);
    expect(st(s).drawing!.entry.user.userId).toBe('a');
    expect(st(s).drawing!.ready).toBe(false);
    expect(st(s).queue.length).toBe(0);
  });
  test('2. chờ ready', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.tick(0);
    s.tick(30_000); expect(st(s).drawing!.progress).toBe(0);
    s.command({ type: 'ready', id: 'nope' }, 30_000); s.tick(30_000); expect(st(s).drawing!.progress).toBe(0);
    s.command({ type: 'ready', id: st(s).drawing!.entry.id }, 30_000);
    s.tick(52_500); expect(st(s).drawing!.progress).toBeCloseTo(0.5);
  });
  test('3. vẽ xong chuyển lượt kế', () => {
    const s = mk(); s.handle(gift('a', 5, 0)); start(s, 0); s.handle(gift('b', 1, 1));
    s.tick(45_000);
    expect(st(s).drawn).toBe(1); expect(st(s).lastDrawn!.user.userId).toBe('a');
    expect(st(s).drawing!.entry.user.userId).toBe('b');
  });
  test('4. ưu tiên xu cao, màu', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.handle(gift('b', 99, 0)); start(s, 0);
    expect(st(s).drawing!.entry.user.userId).toBe('b'); expect(st(s).drawing!.color).toBe(true);
    s.tick(45_000); expect(st(s).drawing!.color).toBe(false);
  });
  test('5. gộp đạt ngưỡng màu', () => {
    const s = mk({ colorMinCoins: 5 }); s.handle(gift('a', 3, 0)); s.handle(gift('a', 3, 10_000));
    expect(st(s).queue.length).toBe(1); start(s, 10_000);
    expect(st(s).drawing!.color).toBe(true);
  });
  test('6. đổi colorMinCoins không đổi bức đang vẽ', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); start(s, 0);
    s.command({ type: 'setSettings', patch: { colorMinCoins: 1 } }, 0);
    expect(st(s).drawing!.color).toBe(false);
  });
  test('7. độ trễ sân khấu', () => {
    const s = mk({ stageDelayMs: 3000 }); s.handle(gift('a', 1, 0));
    s.tick(2999); expect(st(s).drawing).toBeNull();
    s.tick(3000); expect(st(s).drawing).not.toBeNull();
  });
  test('8. không ai bị chặn', () => {
    const s = mk({ stageDelayMs: 3000 });
    s.handle(gift('b', 1, 0));
    for (const t of [0, 2000, 4000, 6000]) s.handle(gift('a', 5, t));
    s.tick(6500); expect(st(s).drawing!.entry.user.userId).toBe('b');
  });
  test('9. tạm dừng', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); start(s, 0);
    s.command({ type: 'pause' }, 0); s.tick(60_000); expect(st(s).drawing!.progress).toBe(0);
    s.command({ type: 'resume' }, 60_000); s.tick(82_500); expect(st(s).drawing!.progress).toBeCloseTo(0.5);
  });
  test('10. bỏ qua khi đang tạm dừng', () => {
    const s = mk(); s.handle(gift('a', 5, 0)); s.handle(gift('b', 1, 0)); start(s, 0);
    s.command({ type: 'pause' }, 0); s.command({ type: 'skip' }, 0);
    expect(st(s).drawn).toBe(0); expect(st(s).lastDrawn).toBeNull();
    s.tick(1); expect(st(s).drawing!.entry.user.userId).toBe('b'); expect(st(s).drawing!.paused).toBe(false);
  });
  test('11. bỏ qua khi rỗng', () => {
    const s = mk(); const before = st(s); s.command({ type: 'skip' }, 0); expect(st(s)).toEqual(before);
  });
  test('12. xoá hết giữ bức đang vẽ', () => {
    const s = mk(); s.handle(gift('a', 9, 0)); s.handle(gift('b', 1, 0)); s.handle(gift('c', 1, 0)); start(s, 0);
    s.command({ type: 'clearQueue' }, 0);
    expect(st(s).queue).toEqual([]); expect(st(s).drawing!.entry.user.userId).toBe('a');
  });
  test('13. đang được vẽ mà tặng thêm → lượt mới', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); start(s, 0); s.handle(gift('a', 1, 10));
    expect(st(s).queue.length).toBe(1);
  });
  test('14. đầy → nợ', () => {
    const s = mk({ maxQueue: 2 }); s.handle(gift('a', 1, 0)); s.handle(gift('b', 1, 0)); s.handle(gift('c', 1, 0));
    expect(st(s).queue.length).toBe(2); expect(st(s).owed).toBe(1); expect(st(s).stats.giftCount).toBe(3);
  });
  test('15. ngưng nhận quà', () => {
    const s = mk(); s.command({ type: 'setSettings', patch: { acceptingGifts: false } }, 0);
    s.handle(gift('a', 3, 0));
    expect(st(s).owed).toBe(1); expect(st(s).queue).toEqual([]); expect(st(s).stats.coins).toBe(3);
  });
  test('16. xin miễn phí theo thời gian chờ', () => {
    const s = mk({}, { startAt: 0 });
    s.handle(cm('a', '!ve', 119_999)); expect(st(s).declined).toBe(1);
    s.handle(cm('b', '!ve', 120_000)); expect(st(s).queue.length).toBe(1); expect(st(s).freeAccepted).toBe(1);
    s.handle(gift('c', 1, 130_000)); s.handle(cm('d', '!ve', 200_000)); expect(st(s).declined).toBe(2);
  });
  test('17. xin miễn phí theo tỉ lệ', () => {
    const s1 = mk({}, { random: () => 0.05 }); s1.handle(cm('a', '!ve', 1000)); expect(st(s1).queue.length).toBe(1);
    const s2 = mk({}, { random: () => 0.5 }); s2.handle(cm('a', '!ve', 1000)); expect(st(s2).declined).toBe(1);
  });
  test('18. xin hai lần', () => {
    const s = mk({}, { random: () => 0 }); s.handle(cm('a', '!ve', 1)); s.handle(cm('a', '!ve', 2));
    expect(st(s).queue.length).toBe(1); expect(st(s).declined).toBe(0);
  });
  test('19. mất kết nối giữ trạng thái', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.handle(gift('b', 1, 0)); start(s, 0);
    const before = st(s);
    s.handle({ type: 'status', state: 'disconnected', at: 1 });
    s.handle({ type: 'status', state: 'connected', roomId: '7', at: 2 });
    const after = st(s);
    expect(after.drawing).toEqual(before.drawing); expect(after.queue).toEqual(before.queue);
    expect(after.stats).toEqual(before.stats); expect(after.drawn).toBe(before.drawn);
    expect(after.conn).toBe('connected'); expect(after.roomId).toBe('7');
  });
  test('20. vẽ lại', () => {
    const s = mk(); s.command({ type: 'redoLast' }, 0); expect(st(s).queue).toEqual([]);
    s.handle(gift('a', 1, 0)); start(s, 0); s.tick(45_000);
    s.handle(gift('b', 99, 45_001));
    s.command({ type: 'redoLast' }, 45_002);
    expect(st(s).queue.map(e => e.user.userId)).toEqual(['a', 'b']);
  });
  test('21. tự nhập', () => {
    const s = mk(); s.command({ type: 'addManual', handle: '  @mai_test ' }, 0);
    expect(st(s).queue[0]).toMatchObject({ reason: 'manual', user: { handle: 'mai_test', userId: 'manual:mai_test' } });
    s.command({ type: 'addManual', handle: '@' }, 0); expect(st(s).queue.length).toBe(1);
  });
  test('22. setSettings qua sanitize', () => {
    const s = mk(); s.command({ type: 'setSettings', patch: { drawSeconds: 0, hack: 1 } }, 0);
    expect(st(s).settings.drawSeconds).toBe(5); expect(st(s).settings).not.toHaveProperty('hack');
  });
  test('23. feed giữ 200', () => {
    const s = mk(); for (let i = 1; i <= 250; i++) s.handle(cm('a', 'm' + i, i));
    expect(st(s).feed.length).toBe(200); expect(st(s).feed.at(-1)!.text).toBe('m250');
  });
  test('24. onChange cho handle/command, huỷ đăng ký', () => {
    const s = mk(); const cb = vi.fn(); const off = s.onChange(cb);
    s.handle(gift('a', 1, 0)); s.command({ type: 'pause' }, 0);
    expect(cb).toHaveBeenCalledTimes(2);
    off(); s.handle(gift('b', 1, 0)); expect(cb).toHaveBeenCalledTimes(2);
  });
  test('25. onChange từ tick', () => {
    const s = mk(); const cb = vi.fn(); s.onChange(cb);
    s.tick(0); expect(cb).not.toHaveBeenCalled();
    s.handle(gift('a', 1, 0)); cb.mockClear();
    s.tick(0); expect(cb).toHaveBeenCalledTimes(1);
    s.command({ type: 'ready', id: st(s).drawing!.entry.id }, 0); cb.mockClear();
    s.tick(1000); expect(cb).toHaveBeenCalledTimes(1);
    s.command({ type: 'pause' }, 1000); cb.mockClear();
    s.tick(2000); expect(cb).not.toHaveBeenCalled();
    s.command({ type: 'resume' }, 2000); cb.mockClear();
    s.tick(100_000); expect(cb).toHaveBeenCalled(); expect(st(s).drawn).toBe(1);
  });
  test('26. hàng chờ 3 lượt quà, xin miễn phí bị từ chối', () => {
    const s = mk({ stageDelayMs: 60_000 });
    s.handle(gift('a', 1, 0)); s.handle(gift('b', 1, 0)); s.handle(gift('c', 1, 0));
    s.handle(cm('d', '!ve', 500_000));
    expect(st(s).declined).toBe(1); expect(st(s).queue.length).toBe(3);
  });
});
