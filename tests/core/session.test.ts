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

  test('27. skip có id khác bức đang vẽ thì bỏ qua', () => {
    const s = mk(); s.handle(gift('a', 5, 0)); s.handle(gift('b', 1, 0)); start(s, 0);
    const first = st(s).drawing!.entry.id;
    s.command({ type: 'skip', id: first }, 0);
    s.tick(1); s.command({ type: 'ready', id: st(s).drawing!.entry.id }, 1);
    s.command({ type: 'skip', id: first }, 2);
    s.tick(3);
    expect(st(s).drawing!.entry.user.userId).toBe('b');
    s.command({ type: 'skip', id: 'nope' }, 4);
    expect(st(s).drawing!.entry.user.userId).toBe('b');
  });
  test('27b. skip có id khi không vẽ gì thì không làm gì', () => {
    const s = mk(); s.command({ type: 'skip', id: 'x' }, 0); expect(st(s).drawing).toBeNull();
  });
  test('28. error không đổi conn, không vào feed, vào errors', () => {
    const s = mk(); s.handle({ type: 'status', state: 'connected', at: 1 });
    const feedLen = st(s).feed.length;
    s.handle({ type: 'error', message: 'oops', at: 2 });
    expect(st(s).conn).toBe('connected'); expect(st(s).feed.length).toBe(feedLen);
    expect(st(s).errors).toEqual([{ id: 1, at: 2, text: 'oops', fatal: false }]);
    expect(st(s).draining).toBe(false);
  });
  test('29. status error là lỗi nặng, không vào feed', () => {
    const s = mk();
    s.handle({ type: 'status', state: 'error', at: 1 });
    s.handle({ type: 'status', state: 'error', message: 'rớt', at: 2 });
    expect(st(s).errors.map(e => [e.text, e.fatal])).toEqual([['Lỗi kết nối', true], ['rớt', true]]);
    expect(st(s).feed).toEqual([]); expect(st(s).draining).toBe(true);
  });
  test('30. errors giữ 50', () => {
    const s = mk(); for (let i = 1; i <= 60; i++) s.handle({ type: 'error', message: 'e' + i, at: i });
    expect(st(s).errors.length).toBe(50); expect(st(s).errors[0].text).toBe('e11'); expect(st(s).errors.at(-1)!.text).toBe('e60');
  });
  test('31. draining: vẽ xong bức hiện tại, không lấy lượt kế', () => {
    const s = mk(); s.handle(gift('a', 5, 0)); s.handle(gift('b', 1, 0)); start(s, 0);
    s.handle({ type: 'status', state: 'disconnected', at: 1 });
    expect(st(s).draining).toBe(true);
    s.tick(45_000);
    expect(st(s).drawn).toBe(1); expect(st(s).drawing).toBeNull(); expect(st(s).queue.length).toBe(1);
    s.tick(46_000); expect(st(s).drawing).toBeNull();
    s.handle({ type: 'status', state: 'connecting', at: 46_001 }); expect(st(s).draining).toBe(true);
    s.handle({ type: 'status', state: 'connected', at: 46_002 }); expect(st(s).draining).toBe(false);
    s.tick(46_003); expect(st(s).drawing!.entry.user.userId).toBe('b');
  });
  test('32. draining vẫn nhận lệnh tay', () => {
    const s = mk(); s.handle({ type: 'status', state: 'ended', at: 0 });
    s.command({ type: 'addManual', handle: 'x' }, 0); expect(st(s).queue.length).toBe(1);
    s.tick(1); expect(st(s).drawing).toBeNull();
  });
  test('33. bảng xếp hạng chung khung 5 phút', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.handle(gift('b', 2, 299_999));
    const b = st(s).boards;
    expect(b.length).toBe(1);
    expect(b[0]).toMatchObject({ startAt: 0, endAt: 300_000, locked: false });
    expect(b[0].top).toEqual([{ handle: 'b_test', nickname: 'b', coins: 2 }, { handle: 'a_test', nickname: 'a', coins: 1 }]);
  });
  test('33b. chưa có quà thì boards rỗng', () => { expect(st(mk()).boards).toEqual([]); });
  test('34. quà ở 300000 khoá bảng một, mở bảng hai; bảng khoá không đổi', () => {
    const s = mk(); s.handle(gift('a', 1, 10)); s.handle(gift('a', 1, 300_010));
    const b = st(s).boards;
    expect(b.length).toBe(2);
    expect(b[0]).toMatchObject({ locked: true, startAt: 10, endAt: 300_010 });
    expect(b[0].top[0].coins).toBe(1);
    expect(b[1]).toMatchObject({ locked: false, startAt: 300_010 });
    s.handle(gift('a', 5, 300_020));
    expect(st(s).boards[0].top[0].coins).toBe(1); expect(st(s).boards[1].top[0].coins).toBe(6);
  });
  test('35. 14 khung → 12 bảng khoá + 1 mở, cũ trước', () => {
    const s = mk();
    for (let i = 0; i < 14; i++) s.handle(gift('a', i + 1, i * 300_000));
    const b = st(s).boards;
    expect(b.length).toBe(13);
    expect(b.slice(0, 12).every(x => x.locked)).toBe(true); expect(b[12].locked).toBe(false);
    expect(b[0].top[0].coins).toBe(2); expect(b[12].top[0].coins).toBe(14);
  });
  test('36. tick khoá bảng hết giờ và emit', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.tick(0);
    const cb = vi.fn(); s.onChange(cb);
    s.tick(299_999); expect(st(s).boards[0].locked).toBe(false);
    cb.mockClear();
    s.tick(300_000); expect(st(s).boards[0].locked).toBe(true); expect(cb).toHaveBeenCalled();
  });
  test('37. top tối đa 10, xu giảm dần, bằng xu ai tặng trước đứng trước', () => {
    const s = mk();
    for (let i = 0; i < 12; i++) s.handle(gift('u' + i, 5, i));
    s.handle(gift('u11', 10, 20));
    const top = st(s).boards[0].top;
    expect(top.length).toBe(10);
    expect(top.map(r => r.nickname)).toEqual(['u11', 'u0', 'u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']);
  });
  test('38. stats.gifters là số, JSON không chứa coinsByUser', () => {
    const s = mk(); s.handle(gift('a', 1, 0)); s.handle(gift('a', 1, 1)); s.handle(gift('b', 1, 2));
    expect(st(s).stats.gifters).toBe(2);
    const json = JSON.stringify(st(s));
    expect(json).not.toContain('coinsByUser'); expect(json).not.toContain('topGifters');
  });
});
