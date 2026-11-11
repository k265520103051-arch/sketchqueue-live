// tiktok-live-connector@2.5.0 — TikTokLiveConnection phát thông điệp thô của tiktok-live-proto/v3.
import type { LiveEvent, LiveSource, LiveUser } from '../core/events';

export type RawConnection = {
  connect(): Promise<{ roomId?: string | number }>;
  disconnect(): void | Promise<void>;
  on(event: string, cb: (data: any) => void): void;
};
export type ParsedTarget = { handle: string } | { error: string };

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;
const TIKTOK_HOSTS = new Set(['tiktok.com', 'www.tiktok.com', 'm.tiktok.com']);
const SHORT_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com']);

export function parseTikTokTarget(input: string): ParsedTarget {
  const s = input.trim();
  if (s === '') return { error: 'Hãy nhập link hoặc tên tài khoản TikTok' };

  if (!/^[a-z]+:\/\//i.test(s) && !s.includes('/')) {
    const name = s.startsWith('@') ? s.slice(1) : s;
    return HANDLE_RE.test(name) ? { handle: name } : { error: 'Tên tài khoản không hợp lệ' };
  }

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : 'https://' + s);
  } catch {
    return { error: 'Link không hợp lệ' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return { error: 'Link không hợp lệ' };
  const host = url.hostname.toLowerCase();
  if (SHORT_HOSTS.has(host)) return { error: 'Link rút gọn chưa được hỗ trợ. Hãy mở link, rồi dán link dạng tiktok.com/@ten' };
  if (!TIKTOK_HOSTS.has(host)) return { error: 'Đây không phải link TikTok' };

  const first = url.pathname.split('/').filter(Boolean)[0] ?? '';
  let seg = first;
  try { seg = decodeURIComponent(first); } catch { /* giữ nguyên */ }
  if (seg.startsWith('@') && HANDLE_RE.test(seg.slice(1))) return { handle: seg.slice(1) };
  return { error: 'Link không chứa tên tài khoản (@ten)' };
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : typeof v === 'string' || typeof v === 'bigint' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function firstUrl(img: any): string | null {
  const u = Array.isArray(img?.urlList) ? img.urlList[0] : undefined;
  return typeof u === 'string' && u !== '' ? u : null;
}

function toUser(raw: any): LiveUser | null {
  const id = raw?.id;
  let userId: string;
  if (typeof id === 'string') userId = id;
  else if (typeof id === 'number' || typeof id === 'bigint') userId = String(id);
  else return null;
  if (userId === '' || userId === '0') return null;
  const handle = str(raw.displayId);
  return {
    userId,
    handle,
    nickname: str(raw.nickname) || handle,
    avatarUrl: firstUrl(raw.avatarThumb) ?? firstUrl(raw.avatarMedium) ?? firstUrl(raw.avatarLarge),
  };
}

function errorMessage(e: any): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object') {
    const parts = [e.info, e.exception instanceof Error ? e.exception.message : e.exception, e.message]
      .filter(p => typeof p === 'string' && p !== '');
    if (parts.length) return parts.join(': ');
  }
  return typeof e === 'string' && e !== '' ? e : 'Lỗi không rõ';
}

export function createTikTokSource(
  handle: string,
  factory: (handle: string) => RawConnection,
  now: () => number = Date.now,
): LiveSource {
  const listeners = new Set<(e: LiveEvent) => void>();
  const emit = (e: LiveEvent) => {
    for (const l of [...listeners]) l(e);
  };
  const conn = factory(handle);
  let stopped = false;

  const withUser = (data: any, make: (user: LiveUser, at: number) => LiveEvent | null) => {
    const user = toUser(data?.user);
    if (!user) return;
    const ev = make(user, now());
    if (ev) emit(ev);
  };

  conn.on('chat', data => withUser(data, (user, at) => ({ type: 'comment', user, text: str(data.content), at })));
  conn.on('gift', data =>
    withUser(data, (user, at) => {
      const gift = data.gift;
      if (gift?.type === 1 && !num(data.repeatEnd)) return null;
      const count = num(data.repeatCount);
      return { type: 'gift', user, giftName: str(gift?.name), coins: num(gift?.diamondCount) * count, count, at };
    }),
  );
  conn.on('like', data => withUser(data, (user, at) => ({ type: 'like', user, count: num(data.count), at })));
  conn.on('member', data => withUser(data, (user, at) => ({ type: 'join', user, at })));
  conn.on('follow', data => withUser(data, (user, at) => ({ type: 'follow', user, at })));
  conn.on('roomUser', data => emit({ type: 'viewers', count: num(data?.total), at: now() }));
  conn.on('streamEnd', () => emit({ type: 'status', state: 'ended', at: now() }));
  conn.on('disconnected', () => emit({ type: 'status', state: 'disconnected', at: now() }));
  conn.on('error', err => emit({ type: 'status', state: 'error', message: errorMessage(err), at: now() }));

  return {
    async start() {
      emit({ type: 'status', state: 'connecting', at: now() });
      try {
        const state = await conn.connect();
        const roomId = state?.roomId;
        emit({
          type: 'status',
          state: 'connected',
          ...(roomId !== undefined && roomId !== null ? { roomId: String(roomId) } : {}),
          at: now(),
        });
      } catch (e) {
        emit({ type: 'status', state: 'error', message: errorMessage(e), at: now() });
      }
    },
    async stop() {
      if (stopped) return;
      stopped = true;
      try {
        await conn.disconnect();
      } catch {
        /* bỏ qua */
      }
    },
    onEvent(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}
