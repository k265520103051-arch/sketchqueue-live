import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, test } from 'vitest';
import type { TikTokLiveConnection } from 'tiktok-live-connector';
import { createTikTokSource, parseTikTokTarget, type RawConnection } from '../../src/sources/tiktok';
import type { LiveEvent } from '../../src/core/events';

// Kiểm tra kiểu: lớp thật của thư viện phải gán được cho RawConnection.
const _typeCheck = (c: TikTokLiveConnection): RawConnection => c;
void _typeCheck;

describe('parseTikTokTarget', () => {
  const ok = (s: string) => parseTikTokTarget(s);
  test('tên và link hợp lệ', () => {
    expect(ok('  @mai_test ')).toEqual({ handle: 'mai_test' });
    expect(ok('mai.test_01')).toEqual({ handle: 'mai.test_01' });
    expect(ok('https://www.tiktok.com/@mai_test')).toEqual({ handle: 'mai_test' });
    expect(ok('https://www.tiktok.com/@mai_test/live')).toEqual({ handle: 'mai_test' });
    expect(ok('https://www.tiktok.com/@mai_test/live?lang=vi-VN&x=1#y')).toEqual({ handle: 'mai_test' });
    expect(ok('tiktok.com/@mai_test')).toEqual({ handle: 'mai_test' });
    expect(ok('https://m.tiktok.com/@mai_test/video/123')).toEqual({ handle: 'mai_test' });
  });
  test('đầu vào sai', () => {
    for (const bad of ['', '   ', '@', 'a', 'a b', 'tên_có_dấu', 'x'.repeat(25)]) expect(ok(bad)).toHaveProperty('error');
    expect(ok('')).toEqual({ error: 'Hãy nhập link hoặc tên tài khoản TikTok' });
    expect(ok('a b')).toEqual({ error: 'Tên tài khoản không hợp lệ' });
    expect(ok('https://vm.tiktok.com/ZSabc/')).toEqual({ error: expect.stringContaining('rút gọn') });
    expect(ok('https://vt.tiktok.com/ZSabc/')).toEqual({ error: expect.stringContaining('rút gọn') });
    expect(ok('https://example.com/@mai_test')).toEqual({ error: 'Đây không phải link TikTok' });
    expect(ok('https://tiktok.com.evil.example/@mai_test')).toEqual({ error: 'Đây không phải link TikTok' });
    expect(ok('https://www.tiktok.com/foryou')).toEqual({ error: expect.stringContaining('@ten') });
    expect(ok('javascript://www.tiktok.com/@mai_test')).toHaveProperty('error');
  });
});

// RawConnection giả, dữ liệu có hình dạng tiktok-live-proto/v3 mà TikTokLiveConnection 2.5.0 phát ra.
class FakeConn extends EventEmitter implements RawConnection {
  disconnectCalls = 0;
  connectResult: Promise<{ roomId?: string | number }> = Promise.resolve({ roomId: 123 });
  connect() { return this.connectResult; }
  disconnect() { this.disconnectCalls++; return Promise.resolve(); }
}

const user = (over: Record<string, unknown> = {}) => ({
  id: '7001', displayId: 'mai_test', nickname: 'Mai',
  avatarThumb: { urlList: ['https://p16.example/a.jpg'] }, ...over,
});

const g = (o: { giftType?: number; repeatEnd?: number; repeatCount?: number; coinsEach?: unknown; name?: string } = {}) => ({
  user: user(),
  gift: { type: o.giftType ?? 2, name: o.name ?? 'Rose', diamondCount: 'coinsEach' in o ? o.coinsEach : 1 },
  repeatCount: o.repeatCount ?? 1,
  repeatEnd: o.repeatEnd ?? 0,
});

let fake: FakeConn;
let events: LiveEvent[];
let handles: string[];
const make = () => {
  const src = createTikTokSource('mai_test', h => { handles.push(h); return fake; }, () => 42);
  src.onEvent(e => events.push(e));
  return src;
};

beforeEach(() => { fake = new FakeConn(); events = []; handles = []; });

describe('createTikTokSource', () => {
  test('start: connecting rồi connected kèm roomId chuỗi', async () => {
    await make().start();
    expect(handles).toEqual(['mai_test']);
    expect(events).toEqual([
      { type: 'status', state: 'connecting', at: 42 },
      { type: 'status', state: 'connected', roomId: '123', at: 42 },
    ]);
  });

  test('connect() thất bại → status error, start() không ném', async () => {
    fake.connectResult = Promise.reject(new Error('Người dùng không live'));
    await expect(make().start()).resolves.toBeUndefined();
    expect(events.at(-1)).toMatchObject({ type: 'status', state: 'error', message: expect.stringContaining('không live') });
  });

  test('chat → comment', async () => {
    await make().start();
    fake.emit('chat', { user: user(), content: 'xin chào' });
    expect(events.at(-1)).toEqual({
      type: 'comment', text: 'xin chào', at: 42,
      user: { userId: '7001', handle: 'mai_test', nickname: 'Mai', avatarUrl: 'https://p16.example/a.jpg' },
    });
  });

  test('chuỗi quà đang chạy bị bỏ qua', async () => {
    await make().start();
    fake.emit('gift', g({ giftType: 1, repeatEnd: 0, repeatCount: 3 }));
    expect(events.filter(e => e.type === 'gift')).toEqual([]);
  });

  test('chuỗi quà kết thúc → một gift, coins = xu một quà × repeatCount', async () => {
    await make().start();
    fake.emit('gift', g({ giftType: 1, repeatEnd: 1, repeatCount: 5, coinsEach: 1 }));
    expect(events.at(-1)).toMatchObject({ type: 'gift', giftName: 'Rose', coins: 5, count: 5 });
  });

  test('quà không theo chuỗi (giftType 2) được tính ngay', async () => {
    await make().start();
    fake.emit('gift', g({ giftType: 2, repeatEnd: 0, repeatCount: 1, coinsEach: 99, name: 'Mũ' }));
    expect(events.at(-1)).toMatchObject({ type: 'gift', giftName: 'Mũ', coins: 99, count: 1 });
  });

  test('thiếu ảnh đại diện → avatarUrl null; dùng ảnh cỡ khác nếu có', async () => {
    await make().start();
    fake.emit('member', { user: user({ avatarThumb: undefined }) });
    expect(events.at(-1)).toMatchObject({ type: 'join', user: { avatarUrl: null } });
    fake.emit('member', { user: user({ avatarThumb: { urlList: [] }, avatarMedium: { urlList: ['https://m.example/b.jpg'] } }) });
    expect(events.at(-1)).toMatchObject({ type: 'join', user: { avatarUrl: 'https://m.example/b.jpg' } });
    fake.emit('follow', { user: user({ avatarThumb: { urlList: [5] } }) });
    expect(events.at(-1)).toMatchObject({ type: 'follow', user: { avatarUrl: null } });
  });

  test('thiếu data.user, hoặc thiếu userId → bỏ qua, không lỗi', async () => {
    await make().start();
    const before = events.length;
    expect(() => {
      fake.emit('chat', { content: 'x' });
      fake.emit('chat', { user: user({ id: undefined }), content: 'x' });
      fake.emit('chat', { user: user({ id: '' }), content: 'x' });
      fake.emit('gift', { repeatCount: 1 });
      fake.emit('like', null);
    }).not.toThrow();
    expect(events.length).toBe(before);
  });

  test('thiếu gift → coi là quà 0 xu, không bỏ qua theo chuỗi', async () => {
    await make().start();
    fake.emit('gift', { user: user(), repeatCount: 2, repeatEnd: 0 });
    expect(events.at(-1)).toMatchObject({ type: 'gift', coins: 0, count: 2 });
  });

  test('xu một quà không phải số → coins 0', async () => {
    await make().start();
    fake.emit('gift', g({ coinsEach: 'nhiều' }));
    expect(events.at(-1)).toMatchObject({ type: 'gift', coins: 0 });
  });

  test('userId là số hoặc bigint → chuỗi', async () => {
    await make().start();
    fake.emit('chat', { user: user({ id: 7001 }), content: 'a' });
    expect(events.at(-1)).toMatchObject({ user: { userId: '7001' } });
    fake.emit('chat', { user: user({ id: 9007199254740993n }), content: 'b' });
    expect(events.at(-1)).toMatchObject({ user: { userId: '9007199254740993' } });
  });

  test('like → like với count', async () => {
    await make().start();
    fake.emit('like', { user: user(), count: 15, total: '300' });
    expect(events.at(-1)).toMatchObject({ type: 'like', count: 15 });
  });

  test('roomUser → viewers', async () => {
    await make().start();
    fake.emit('roomUser', { total: '321', totalUser: '5000' });
    expect(events.at(-1)).toEqual({ type: 'viewers', count: 321, at: 42 });
    fake.emit('roomUser', { total: 'abc' });
    expect(events.at(-1)).toEqual({ type: 'viewers', count: 0, at: 42 });
  });

  test('streamEnd → status ended', async () => {
    await make().start();
    fake.emit('streamEnd', { action: 3 });
    expect(events.at(-1)).toEqual({ type: 'status', state: 'ended', at: 42 });
  });

  test('disconnected → status disconnected', async () => {
    await make().start();
    fake.emit('disconnected', { code: 1000, reason: '' });
    expect(events.at(-1)).toEqual({ type: 'status', state: 'disconnected', at: 42 });
  });

  test('error sau connected → sự kiện error kèm message, không phát status', async () => {
    await make().start();
    const before = events.length;
    fake.emit('error', { info: 'WebSocket Error after connecting', exception: new Error('boom') });
    expect(events.length).toBe(before + 1);
    expect(events.at(-1)).toMatchObject({ type: 'error', message: expect.stringContaining('boom'), at: 42 });
    expect(events.filter(e => e.type === 'status' && e.state === 'error')).toEqual([]);
  });

  test('error đến trước connected (đang connect) → bỏ qua; connect() bị từ chối → status error đúng một lần', async () => {
    fake.connectResult = new Promise((_res, rej) => {
      setTimeout(() => {
        fake.emit('error', { info: 'Failed to connect', exception: new Error('boom') });
        rej(new Error('boom'));
      }, 0);
    });
    await make().start();
    expect(events.filter(e => (e.type as string) === 'error')).toEqual([]);
    expect(events.filter(e => e.type === 'status' && e.state === 'error')).toHaveLength(1);
  });

  test('streamEnd rồi disconnected → status cuối cùng vẫn là ended', async () => {
    await make().start();
    fake.emit('streamEnd', { action: 3 });
    fake.emit('disconnected', { code: 1000, reason: '' });
    const statuses = events.filter(e => e.type === 'status');
    expect(statuses.at(-1)).toEqual({ type: 'status', state: 'ended', at: 42 });
    expect(statuses.some(e => e.type === 'status' && e.state === 'disconnected')).toBe(false);
  });

  test('stop() hai lần → disconnect() gọi một lần', async () => {
    const src = make();
    await src.start();
    await src.stop();
    await src.stop();
    expect(fake.disconnectCalls).toBe(1);
  });

  test('stop() khi chưa start() → không lỗi', async () => {
    const src = make();
    await expect(src.stop()).resolves.toBeUndefined();
    await expect(src.stop()).resolves.toBeUndefined();
    expect(fake.disconnectCalls).toBe(1);
  });

  test('disconnect() bị từ chối → stop() không ném', async () => {
    fake.disconnect = () => { fake.disconnectCalls++; return Promise.reject(new Error('x')); };
    const src = make();
    await src.start();
    await expect(src.stop()).resolves.toBeUndefined();
  });

  test('hàm huỷ đăng ký ngừng nhận sự kiện', async () => {
    const src = createTikTokSource('mai_test', () => fake, () => 1);
    const got: LiveEvent[] = [];
    const off = src.onEvent(e => got.push(e));
    off();
    await src.start();
    expect(got).toEqual([]);
  });
});
