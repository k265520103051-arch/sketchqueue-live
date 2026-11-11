import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { extname, join, resolve, sep } from 'node:path';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import type { LiveEvent, LiveSource } from '../core/events';
import { Session, type Command, type SessionState } from '../core/session';
import { SimulatorSource, TEST_GIFTS } from '../sources/simulator';
import type { ClientMsg, ServerMsg } from '../client/protocol';
import { fetchAvatar, type AvatarImage } from './avatar';
import { loadSettings, saveSettings } from './settings-store';

export type LiveFactory = (target: string) => LiveSource | { error: string };

const HOST = '127.0.0.1';
const MAX_MSG_BYTES = 16 * 1024;
const STATE_THROTTLE_MS = 250;
const TICK_MS = 100;
const AVATAR_CACHE_MAX = 20;
const COMMENT_MAX = 200;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const NO_ARG_COMMANDS = new Set(['pause', 'resume', 'skip', 'redoLast', 'clearQueue']);
const ID_COMMANDS = new Set(['remove', 'moveToFront', 'ready']);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Chỉ nhận lệnh đúng hình dạng; còn lại trả null. */
function parseCommand(v: unknown): Command | null {
  if (!isObj(v) || typeof v.type !== 'string') return null;
  if (NO_ARG_COMMANDS.has(v.type)) return { type: v.type } as Command;
  if (ID_COMMANDS.has(v.type)) return typeof v.id === 'string' ? ({ type: v.type, id: v.id } as Command) : null;
  if (v.type === 'addManual') return typeof v.handle === 'string' ? { type: 'addManual', handle: v.handle } : null;
  if (v.type === 'setSettings') return { type: 'setSettings', patch: v.patch };
  return null;
}

function parseClientMsg(v: unknown): ClientMsg | null {
  if (!isObj(v)) return null;
  switch (v.type) {
    case 'command': {
      const command = parseCommand(v.command);
      return command ? { type: 'command', command } : null;
    }
    case 'connect':
      if (v.mode !== 'rehearsal' && v.mode !== 'live') return null;
      return { type: 'connect', mode: v.mode, target: typeof v.target === 'string' ? v.target : undefined };
    case 'disconnect':
      return { type: 'disconnect' };
    case 'test':
      if (v.kind !== 'gift' && v.kind !== 'comment' && v.kind !== 'likes') return null;
      if (typeof v.handle !== 'string' || typeof v.arg !== 'string') return null;
      return { type: 'test', kind: v.kind, handle: v.handle, arg: v.arg, count: typeof v.count === 'number' ? v.count : 1 };
    default:
      return null;
  }
}

function rawLength(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

function clampCount(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(999, Math.max(1, Math.floor(n)));
}

export function createApp(opts: {
  port: number;
  staticDir: string;
  settingsPath: string;
  liveFactory: LiveFactory;
  fetch?: typeof fetch;
  now?: () => number;
}): { listen(): Promise<{ port: number }>; close(): Promise<void>; session: Session } {
  const now = opts.now ?? Date.now;
  const doFetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  const staticDir = resolve(opts.staticDir);
  const assetsDir = resolve(staticDir, 'assets');
  const avatarCache = new Map<string, AvatarImage>();

  const session = new Session({ settings: loadSettings(opts.settingsPath), startAt: now() });
  const sim = new SimulatorSource({ now });
  const unsubSim = sim.onEvent(e => session.handle(e));

  let port = 0;
  let closed = false;
  let active: LiveSource | null = null;
  let unsubActive: (() => void) | null = null;
  let chain: Promise<void> = Promise.resolve();
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSentAt = -Infinity;
  let dirty = false;
  let drawingId: string | null = null;

  const allowedHosts = () => new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  const allowedOrigins = () => new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`]);
  const csp = () =>
    `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`;

  // ---------- phát state (gom, tối đa 1 lần / 250 ms, lần cuối luôn gửi) ----------
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024 * 1024 });

  function sendTo(ws: WebSocket, payload: string): void {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }

  function flush(): void {
    throttleTimer = null;
    if (closed || !dirty) return;
    dirty = false;
    lastSentAt = performance.now();
    const msg: ServerMsg = { type: 'state', state: session.getState() };
    const payload = JSON.stringify(msg);
    for (const ws of wss.clients) sendTo(ws, payload);
  }

  function scheduleBroadcast(): void {
    if (closed) return;
    dirty = true;
    if (throttleTimer) return;
    const wait = lastSentAt + STATE_THROTTLE_MS - performance.now();
    if (wait <= 0) flush();
    else throttleTimer = setTimeout(flush, wait);
  }

  // ---------- tải ảnh trước khi vẽ ----------
  function onState(s: SessionState): void {
    const d = s.drawing;
    const id = d ? d.entry.id : null;
    if (id !== drawingId) {
      drawingId = id;
      if (d && id !== null && !d.ready) {
        void fetchAvatar(d.entry.user.avatarUrl, { fetch: doFetch, cache: avatarCache }).then(() => {
          trimCache(d.entry.user.avatarUrl);
          if (!closed) session.command({ type: 'ready', id }, now());
        });
      }
    }
    scheduleBroadcast();
  }

  function trimCache(keep: string | null): void {
    for (const key of avatarCache.keys()) {
      if (avatarCache.size <= AVATAR_CACHE_MAX) break;
      if (key !== keep) avatarCache.delete(key);
    }
  }

  const unsubSession = session.onChange(onState);

  // ---------- nguồn sự kiện ----------
  function statusError(message: string): void {
    const e: LiveEvent = { type: 'status', state: 'error', message, at: now() };
    session.handle(e);
  }

  async function stopActive(): Promise<void> {
    const src = active;
    const unsub = unsubActive;
    active = null;
    unsubActive = null;
    if (src) {
      try {
        await src.stop();
      } catch {
        // bỏ qua
      }
    }
    unsub?.();
  }

  function runSerial(fn: () => Promise<void>): void {
    chain = chain.then(fn).catch(err => {
      if (!closed) statusError(err instanceof Error ? err.message : String(err));
    });
  }

  async function connectRehearsal(): Promise<void> {
    if (active === sim) return;
    await stopActive();
    if (closed) return;
    active = sim;
    await sim.start();
  }

  async function connectLive(target: string): Promise<void> {
    await stopActive();
    if (closed) return;
    const made = opts.liveFactory(target);
    if ('error' in made) {
      statusError(made.error);
      return;
    }
    active = made;
    unsubActive = made.onEvent(e => {
      if (!closed) session.handle(e);
    });
    try {
      await made.start();
    } catch (err) {
      if (!closed) statusError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleTest(msg: Extract<ClientMsg, { type: 'test' }>): void {
    if (msg.kind === 'gift') {
      const gift = TEST_GIFTS.find(g => g.name === msg.arg);
      if (!gift) return;
      sim.emitGift(msg.handle, gift.name, gift.coins, clampCount(msg.count));
    } else if (msg.kind === 'comment') {
      sim.emitComment(msg.handle, msg.arg.slice(0, COMMENT_MAX));
    } else {
      sim.emitLikes(msg.handle, clampCount(msg.count));
    }
  }

  function handleMessage(data: RawData): void {
    if (rawLength(data) > MAX_MSG_BYTES) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(Array.isArray(data) ? Buffer.concat(data).toString('utf8') : Buffer.from(data as ArrayBuffer).toString('utf8'));
    } catch {
      return;
    }
    const msg = parseClientMsg(parsed);
    if (!msg) return;
    switch (msg.type) {
      case 'command':
        session.command(msg.command, now());
        if (msg.command.type === 'setSettings') saveSettings(opts.settingsPath, session.getState().settings);
        break;
      case 'connect':
        if (msg.mode === 'rehearsal') runSerial(connectRehearsal);
        else runSerial(() => connectLive(msg.target ?? ''));
        break;
      case 'disconnect':
        runSerial(stopActive);
        break;
      case 'test':
        handleTest(msg);
        break;
    }
  }

  wss.on('connection', ws => {
    ws.on('error', () => {});
    ws.on('message', data => {
      try {
        handleMessage(data);
      } catch {
        // thông điệp lỗi không được làm sập máy chủ
      }
    });
    const msg: ServerMsg = { type: 'state', state: session.getState() };
    sendTo(ws, JSON.stringify(msg));
  });

  // ---------- HTTP ----------
  function send(res: http.ServerResponse, status: number, body: string | Buffer, headers: Record<string, string> = {}): void {
    res.writeHead(status, { 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'text/plain; charset=utf-8', ...headers });
    res.end(body);
  }

  async function serveFile(res: http.ServerResponse, file: string): Promise<void> {
    try {
      const st = await stat(file);
      if (!st.isFile()) return send(res, 404, 'Không tìm thấy');
      const body = await readFile(file);
      const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
      const headers: Record<string, string> = { 'Content-Type': type, 'Cache-Control': 'no-cache' };
      if (type.startsWith('text/html')) headers['Content-Security-Policy'] = csp();
      send(res, 200, body, headers);
    } catch {
      send(res, 404, 'Không tìm thấy');
    }
  }

  async function serveAvatar(res: http.ServerResponse, rawId: string): Promise<void> {
    let id: string;
    try {
      id = decodeURIComponent(rawId);
    } catch {
      return send(res, 404, 'Không tìm thấy');
    }
    const d = session.getState().drawing;
    if (!d || d.entry.id !== id) return send(res, 404, 'Không tìm thấy');
    const img = await fetchAvatar(d.entry.user.avatarUrl, { fetch: doFetch, cache: avatarCache });
    if (!img) return send(res, 404, 'Không tìm thấy');
    send(res, 200, img.body, {
      'Content-Type': img.contentType,
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    });
  }

  async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    if (!allowedHosts().has((req.headers.host ?? '').toLowerCase())) return send(res, 403, 'Bị từ chối');
    if (req.method !== 'GET') return send(res, 405, 'Phương thức không được hỗ trợ', { Allow: 'GET' });
    const url = req.url ?? '/';
    const q = url.indexOf('?');
    const pathname = q === -1 ? url : url.slice(0, q);

    if (pathname === '/') return serveFile(res, join(staticDir, 'control', 'index.html'));
    if (pathname === '/stage') return serveFile(res, join(staticDir, 'stage', 'index.html'));
    if (pathname.startsWith('/assets/')) {
      let rel: string;
      try {
        rel = decodeURIComponent(pathname.slice('/assets/'.length));
      } catch {
        return send(res, 404, 'Không tìm thấy');
      }
      if (rel === '' || rel.includes('\0')) return send(res, 404, 'Không tìm thấy');
      const full = resolve(assetsDir, rel);
      if (!full.startsWith(assetsDir + sep)) return send(res, 404, 'Không tìm thấy');
      return serveFile(res, full);
    }
    if (pathname.startsWith('/api/avatar/')) return serveAvatar(res, pathname.slice('/api/avatar/'.length));
    return send(res, 404, 'Không tìm thấy');
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(() => {
      if (!res.headersSent) send(res, 500, 'Lỗi máy chủ');
      else res.destroy();
    });
  });

  function reject(socket: Duplex, status: number, text: string): void {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    if (closed) return reject(socket, 503, 'Service Unavailable');
    if (!allowedHosts().has((req.headers.host ?? '').toLowerCase())) return reject(socket, 403, 'Forbidden');
    const origin = req.headers.origin;
    if (origin !== undefined && !allowedOrigins().has(origin.toLowerCase())) return reject(socket, 403, 'Forbidden');
    const pathname = (req.url ?? '').split('?')[0];
    if (pathname !== '/ws') return reject(socket, 404, 'Not Found');
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });

  return {
    session,
    listen() {
      return new Promise((resolveListen, rejectListen) => {
        const onError = (err: Error) => rejectListen(err);
        server.once('error', onError);
        server.listen(opts.port, HOST, () => {
          server.off('error', onError);
          server.on('error', () => {});
          port = (server.address() as AddressInfo).port;
          tickTimer = setInterval(() => {
            if (!closed) session.tick(now());
          }, TICK_MS);
          resolveListen({ port });
        });
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      if (tickTimer) clearInterval(tickTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
      tickTimer = null;
      throttleTimer = null;
      unsubSession();
      const src = active;
      active = null;
      unsubActive?.();
      unsubActive = null;
      await Promise.allSettled([sim.stop(), src && src !== sim ? src.stop() : Promise.resolve()]);
      unsubSim();
      for (const ws of wss.clients) ws.terminate();
      await new Promise<void>(r => wss.close(() => r()));
      server.closeAllConnections();
      await new Promise<void>(r => server.close(() => r()));
    },
  };
}
