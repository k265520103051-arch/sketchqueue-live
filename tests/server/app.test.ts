import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { LiveEvent, LiveSource } from '../../src/core/events';
import type { SessionState } from '../../src/core/session';
import type { ClientMsg, ServerMsg } from '../../src/client/protocol';
import { createApp, type LiveFactory } from '../../src/server/app';

type App = ReturnType<typeof createApp>;

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  while (cleanups.length) await cleanups.pop()!();
});

function makeDirs(settings?: object) {
  const dir = mkdtempSync(join(tmpdir(), 'sq-app-'));
  const staticDir = join(dir, 'static');
  mkdirSync(join(staticDir, 'control'), { recursive: true });
  mkdirSync(join(staticDir, 'stage'), { recursive: true });
  mkdirSync(join(staticDir, 'assets'), { recursive: true });
  writeFileSync(join(staticDir, 'control', 'index.html'), '<!doctype html><title>control</title>');
  writeFileSync(join(staticDir, 'stage', 'index.html'), '<!doctype html><title>stage</title>');
  writeFileSync(join(staticDir, 'assets', 'a.js'), 'console.log(1)');
  writeFileSync(join(dir, 'package.json'), '{"secret":true}');
  writeFileSync(join(staticDir, 'package.json'), '{"secret":true}');
  const settingsPath = join(dir, 'settings.json');
  if (settings) writeFileSync(settingsPath, JSON.stringify(settings));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, staticDir, settingsPath };
}

async function start(opts: { settings?: object; liveFactory?: LiveFactory; fetch?: typeof fetch; avatarTimeoutMs?: number } = {}) {
  const dirs = makeDirs(opts.settings);
  const app = createApp({
    port: 0,
    staticDir: dirs.staticDir,
    settingsPath: dirs.settingsPath,
    liveFactory: opts.liveFactory ?? (() => ({ error: 'Chưa hỗ trợ' })),
    fetch: opts.fetch,
    avatarTimeoutMs: opts.avatarTimeoutMs,
  });
  const { port } = await app.listen();
  cleanups.push(() => app.close());
  return { app, port, base: `http://127.0.0.1:${port}`, ...dirs };
}

function rawGet(port: number, path: string, headers: Record<string, string> = {}, method = 'GET') {
  return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers, agent: false }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

class Client {
  states: SessionState[] = [];
  private waiters: { pred: (s: SessionState) => boolean; resolve: (s: SessionState) => void }[] = [];
  constructor(readonly ws: WebSocket) {
    ws.on('message', data => {
      const msg = JSON.parse(String(data)) as ServerMsg;
      if (msg.type !== 'state') return;
      this.states.push(msg.state);
      this.waiters = this.waiters.filter(w => {
        if (w.pred(msg.state)) {
          w.resolve(msg.state);
          return false;
        }
        return true;
      });
    });
  }
  get last(): SessionState | undefined {
    return this.states[this.states.length - 1];
  }
  send(msg: ClientMsg | string) {
    this.ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  waitFor(pred: (s: SessionState) => boolean, timeoutMs = 3000): Promise<SessionState> {
    if (this.last && pred(this.last)) return Promise.resolve(this.last);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('waitFor timeout')), timeoutMs);
      this.waiters.push({
        pred,
        resolve: s => {
          clearTimeout(t);
          resolve(s);
        },
      });
    });
  }
}

async function openWs(port: number, opts: { origin?: string; headers?: Record<string, string> } = {}): Promise<Client> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, opts);
  const c = new Client(ws);
  ws.on('error', () => {});
  cleanups.push(() => {
    ws.terminate();
  });
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
    ws.once('unexpected-response', (_req, res) => reject(new Error('HTTP ' + res.statusCode)));
  });
  await c.waitFor(() => true);
  return c;
}

function fakeLive(events: (at: number) => LiveEvent[]): LiveSource {
  const listeners = new Set<(e: LiveEvent) => void>();
  return {
    async start() {
      for (const e of events(Date.now())) for (const cb of listeners) cb(e);
    },
    async stop() {},
    onEvent(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

describe('createApp', () => {
  test('GET / và /stage trả 200 text/html kèm CSP', async () => {
    const { port, base } = await start();
    for (const [path, title] of [
      ['/', 'control'],
      ['/stage', 'stage'],
    ]) {
      const r = await fetch(base + path);
      expect(r.status).toBe(200);
      expect(r.headers.get('content-type')).toMatch(/^text\/html/);
      const csp = r.headers.get('content-security-policy')!;
      expect(csp).toBe(
        `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
      );
      expect(await r.text()).toContain(title);
    }
  });

  test('GET /assets/a.js → 200; /assets/../../package.json và /assets/%2e%2e/x → 404', async () => {
    const { port } = await start();
    const ok = await rawGet(port, '/assets/a.js');
    expect(ok.status).toBe(200);
    expect(ok.body).toBe('console.log(1)');
    for (const p of [
      '/assets/../../package.json',
      '/assets/../package.json',
      '/assets/%2e%2e/%2e%2e/package.json',
      '/assets/%2e%2e/package.json',
      '/assets/%2e%2e/x',
      '/assets/..%5cpackage.json',
      '/assets/..%5c..%5cpackage.json',
      '/assets/',
      '/assets/%E0%A4%A',
    ]) {
      const r = await rawGet(port, p);
      expect(r.status, p).toBe(404);
      expect(r.body).not.toContain('secret');
    }
  });

  test('POST / → 405; GET /khong-co → 404', async () => {
    const { base } = await start();
    expect((await fetch(base + '/', { method: 'POST' })).status).toBe(405);
    expect((await fetch(base + '/khong-co')).status).toBe(404);
  });

  test('Host lạ → 403', async () => {
    const { port } = await start();
    expect((await rawGet(port, '/', { Host: 'evil.example' })).status).toBe(403);
    expect((await rawGet(port, '/', { Host: `127.0.0.1:${port + 1}` })).status).toBe(403);
    expect((await rawGet(port, '/', { Host: `localhost:${port}` })).status).toBe(200);
  });

  test('WebSocket với Origin lạ bị từ chối', async () => {
    const { port } = await start();
    await expect(openWs(port, { origin: 'http://evil.example' })).rejects.toThrow();
    const ok = await openWs(port, { origin: `http://localhost:${port}` });
    expect(ok.last?.conn).toBe('idle');
  });

  test('WebSocket với Host lạ bị từ chối', async () => {
    const { port } = await start();
    await expect(openWs(port, { headers: { Host: 'evil.example' } })).rejects.toThrow();
  });

  test('WebSocket nhận state ngay khi nối', async () => {
    const { port } = await start();
    const c = await openWs(port);
    expect(c.states.length).toBe(1);
    expect(c.last?.conn).toBe('idle');
  });

  test('connect rehearsal → state.conn thành connected', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'rehearsal' });
    const s = await c.waitFor(s => s.conn === 'connected');
    expect(s.roomId).toBe('rehearsal');
    c.send({ type: 'disconnect' });
    await c.waitFor(s => s.conn === 'disconnected');
  });

  test('test gift Rose ×5 → hàng chờ hoặc bức đang vẽ có lượt 5 xu', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send({ type: 'test', kind: 'gift', handle: '@mai_test', arg: 'Rose', count: 5 });
    const s = await c.waitFor(s => s.queue.some(q => q.coins === 5) || s.drawing?.entry.coins === 5);
    expect(s.stats.coins).toBe(5);
  });

  test('test gift tên lạ → không đổi gì', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send({ type: 'test', kind: 'gift', handle: 'mai_test', arg: 'Không có', count: 5 });
    c.send({ type: 'test', kind: 'comment', handle: 'bao_test', arg: 'mốc', count: 1 });
    const s = await c.waitFor(s => s.feed.some(f => f.text === 'mốc'));
    expect(s.stats.coins).toBe(0);
    expect(s.queue.length).toBe(0);
    expect(s.feed.some(f => f.kind === 'gift')).toBe(false);
  });

  test('test gift count kẹp 1..999, comment cắt 200 ký tự', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send({ type: 'test', kind: 'gift', handle: 'mai_test', arg: 'Rose', count: 5000 });
    c.send({ type: 'test', kind: 'comment', handle: 'bao_test', arg: 'x'.repeat(500), count: 1 });
    const s = await c.waitFor(s => s.feed.some(f => f.kind === 'comment'));
    expect(s.stats.coins).toBe(999);
    expect(s.feed.find(f => f.kind === 'comment')!.text.length).toBe(200);
  });

  test('rác qua WebSocket (chuỗi "abc", JSON sai type, 20 KB) → kết nối vẫn mở, vẫn nhận state sau đó', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send('abc');
    c.send('null');
    c.send(JSON.stringify({ type: 'nope' }));
    c.send(JSON.stringify({ type: 'command', command: { type: 'addManual', handle: 42 } }));
    c.send(JSON.stringify({ type: 'command', command: { type: 'bogus' } }));
    c.send(JSON.stringify({ type: 'test', kind: 'gift', handle: null, arg: 'Rose', count: 1 }));
    c.send(JSON.stringify({ type: 'command', command: { type: 'addManual', handle: 'x'.repeat(20 * 1024) } }));
    c.send({ type: 'command', command: { type: 'addManual', handle: 'linh_test' } });
    const s = await c.waitFor(s => s.queue.some(q => q.user.handle === 'linh_test'));
    expect(s.queue.length).toBe(1);
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
  });

  test('setSettings được lưu', async () => {
    const { port, settingsPath } = await start();
    const c = await openWs(port);
    c.send({ type: 'command', command: { type: 'setSettings', patch: { drawSeconds: 30 } } });
    await c.waitFor(s => s.settings.drawSeconds === 30);
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).drawSeconds).toBe(30);
  });

  test('cài đặt được nạp lúc khởi động', async () => {
    const { port } = await start({ settings: { drawSeconds: 20, minCoins: 'x' } });
    const c = await openWs(port);
    expect(c.last?.settings.drawSeconds).toBe(20);
    expect(c.last?.settings.minCoins).toBe(1);
  });

  test('connect live với liveFactory trả error → state.conn error, feed có thông báo', async () => {
    const { port } = await start();
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@ai_do' });
    const s = await c.waitFor(s => s.conn === 'error');
    expect(s.errors.some(e => e.text.includes('Chưa hỗ trợ'))).toBe(true);
  });

  test('/api/avatar/<id sai> → 404', async () => {
    const { base } = await start();
    expect((await fetch(base + '/api/avatar/khong-co')).status).toBe(404);
  });

  test('/api/avatar/<id bức đang vẽ> với fetch giả trả PNG → 200 image/png', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
    const calls: string[] = [];
    const fakeFetch = (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
    }) as typeof fetch;
    const user = { userId: 'u1', handle: 'mai_test', nickname: 'Mai', avatarUrl: 'https://img.example/mai.png' };
    const { port, base } = await start({
      settings: { stageDelayMs: 0 },
      fetch: fakeFetch,
      liveFactory: () =>
        fakeLive(at => [
          { type: 'status', state: 'connected', roomId: 'r1', at },
          { type: 'gift', user, giftName: 'Rose', coins: 5, count: 5, at },
        ]),
    });
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@mai_test' });
    const s = await c.waitFor(s => s.drawing?.ready === true);
    const r = await fetch(`${base}/api/avatar/${encodeURIComponent(s.drawing!.entry.id)}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await r.arrayBuffer()).equals(png)).toBe(true);
    expect(calls).toEqual(['https://img.example/mai.png']);
  });

  test('avatarUrl null → bức vẫn chuyển sang ready', async () => {
    const { port, base } = await start({ settings: { stageDelayMs: 0 } });
    const c = await openWs(port);
    c.send({ type: 'command', command: { type: 'addManual', handle: 'bao_test' } });
    const s = await c.waitFor(s => s.drawing?.ready === true);
    expect(s.drawing!.entry.user.avatarUrl).toBeNull();
    expect((await fetch(`${base}/api/avatar/${encodeURIComponent(s.drawing!.entry.id)}`)).status).toBe(404);
  });

  const gifter = (n: number) => ({ userId: 'u' + n, handle: 'user_' + n, nickname: 'U' + n, avatarUrl: `https://img.example/${n}.png` });
  const giftsFrom = (users: ReturnType<typeof gifter>[]) => () =>
    fakeLive(at => [
      { type: 'status', state: 'connected', roomId: 'r1', at },
      ...users.map(user => ({ type: 'gift' as const, user, giftName: 'Rose', coins: 5, count: 5, at })),
    ]);
  const pngFetch = (calls: string[]) =>
    (async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), { status: 200, headers: { 'content-type': 'image/png' } });
    }) as typeof fetch;

  test('fetch không bao giờ xong → ready đặt khi hết hạn, /api/avatar 404, fetch gọi 1 lần', async () => {
    const calls: string[] = [];
    const hang = ((url: string | URL | Request) => {
      calls.push(String(url));
      return new Promise<Response>(() => {});
    }) as typeof fetch;
    const { port, base } = await start({
      settings: { stageDelayMs: 0 },
      fetch: hang,
      avatarTimeoutMs: 150,
      liveFactory: giftsFrom([gifter(1)]),
    });
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@x' });
    const s = await c.waitFor(s => s.drawing?.ready === true);
    const r = await fetch(`${base}/api/avatar/${encodeURIComponent(s.drawing!.entry.id)}`);
    expect(r.status).toBe(404);
    expect(calls).toEqual(['https://img.example/1.png']);
  });

  test('fetch thành công → GET trả ảnh, fetch gọi 1 lần', async () => {
    const calls: string[] = [];
    const { port, base } = await start({ settings: { stageDelayMs: 0 }, fetch: pngFetch(calls), liveFactory: giftsFrom([gifter(1)]) });
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@x' });
    const s = await c.waitFor(s => s.drawing?.ready === true);
    const id = encodeURIComponent(s.drawing!.entry.id);
    expect((await fetch(`${base}/api/avatar/${id}`)).status).toBe(200);
    expect((await fetch(`${base}/api/avatar/${id}`)).status).toBe(200);
    expect(calls).toEqual(['https://img.example/1.png']);
  });

  test('lượt đứng đầu hàng chờ được tải trước; tới lượt thì không tải lại', async () => {
    const calls: string[] = [];
    const { port, base } = await start({ settings: { stageDelayMs: 0 }, fetch: pngFetch(calls), liveFactory: giftsFrom([gifter(1), gifter(2), gifter(3)]) });
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@x' });
    const s = await c.waitFor(s => s.drawing?.ready === true);
    expect(s.drawing!.entry.user.userId).toBe('u1');
    await c.waitFor(() => calls.length >= 2);
    expect(calls).toEqual(['https://img.example/1.png', 'https://img.example/2.png']);
    c.send({ type: 'command', command: { type: 'skip' } });
    const s2 = await c.waitFor(s => s.drawing?.entry.user.userId === 'u2' && s.drawing.ready);
    expect((await fetch(`${base}/api/avatar/${encodeURIComponent(s2.drawing!.entry.id)}`)).status).toBe(200);
    await c.waitFor(() => calls.length >= 3);
    expect(calls).toEqual(['https://img.example/1.png', 'https://img.example/2.png', 'https://img.example/3.png']);
  });

  test('bộ nhớ ảnh giữ tối đa 8 mục', async () => {
    const calls: string[] = [];
    const users = Array.from({ length: 12 }, (_, i) => gifter(i + 1));
    const { app, port } = await start({ settings: { stageDelayMs: 0 }, fetch: pngFetch(calls), liveFactory: giftsFrom(users) });
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'live', target: '@x' });
    for (let i = 1; i <= 12; i++) {
      await c.waitFor(s => s.drawing?.entry.user.userId === 'u' + i && s.drawing.ready);
      expect(app.avatarMemoSize()).toBeLessThanOrEqual(8);
      c.send({ type: 'command', command: { type: 'skip' } });
    }
    expect(calls.length).toBe(12);
    expect(app.avatarMemoSize()).toBe(8);
  });

  test('lệnh skip có id đi nguyên vẹn tới session.command', async () => {
    const { app, port } = await start();
    const spy = vi.spyOn(app.session, 'command');
    const c = await openWs(port);
    c.send({ type: 'command', command: { type: 'skip', id: 5 as unknown as string } }); // id sai kiểu → bỏ
    c.send({ type: 'command', command: { type: 'skip', id: 'abc' } });
    c.send({ type: 'command', command: { type: 'skip' } });
    await vi.waitFor(() => expect(spy.mock.calls.length).toBe(2));
    expect(spy.mock.calls[0][0]).toEqual({ type: 'skip', id: 'abc' });
    expect(spy.mock.calls[1][0]).toEqual({ type: 'skip' });
  });

  test('100 sự kiện dồn dập → số thông điệp state nhận được trong 1 s ≤ 6', async () => {
    const { port } = await start();
    const c = await openWs(port);
    const before = c.states.length;
    for (let i = 0; i < 100; i++) c.send({ type: 'test', kind: 'comment', handle: 'mai_test', arg: 'c' + i, count: 1 });
    await new Promise(r => setTimeout(r, 1000));
    const got = c.states.length - before;
    expect(got).toBeGreaterThanOrEqual(1);
    expect(got).toBeLessThanOrEqual(6);
    // lần cuối luôn được gửi
    expect(c.last!.feed.some(f => f.text === 'c99')).toBe(true);
  });

  test('close() giải phóng cổng', async () => {
    const dirs = makeDirs();
    const app: App = createApp({ port: 0, staticDir: dirs.staticDir, settingsPath: dirs.settingsPath, liveFactory: () => ({ error: 'x' }) });
    const { port } = await app.listen();
    const c = await openWs(port);
    c.send({ type: 'connect', mode: 'rehearsal' });
    await c.waitFor(s => s.conn === 'connected');
    await app.close();
    const srv = net.createServer();
    await new Promise<void>((resolve, reject) => {
      srv.once('error', reject);
      srv.listen(port, '127.0.0.1', () => resolve());
    });
    await new Promise<void>(r => srv.close(() => r()));
  });
});
