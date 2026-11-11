import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchAvatar, type AvatarImage } from '../../src/server/avatar';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

function okFetch(contentType = 'image/png', body: Uint8Array = PNG, status = 200) {
  return vi.fn(async () => new Response(new Uint8Array(body), { status, headers: { 'content-type': contentType } })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchAvatar', () => {
  test('url null hoặc http: → null, không gọi fetch', async () => {
    const f = okFetch();
    const cache = new Map<string, AvatarImage>();
    expect(await fetchAvatar(null, { fetch: f, cache })).toBeNull();
    expect(await fetchAvatar('http://img.example/a.png', { fetch: f, cache })).toBeNull();
    expect(await fetchAvatar('not a url', { fetch: f, cache })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  test('200 image/png → ảnh; lần hai lấy từ cache', async () => {
    const f = okFetch();
    const cache = new Map<string, AvatarImage>();
    const a = await fetchAvatar('https://img.example/a.png', { fetch: f, cache });
    expect(a?.contentType).toBe('image/png');
    expect(Buffer.compare(a!.body, PNG)).toBe(0);
    const b = await fetchAvatar('https://img.example/a.png', { fetch: f, cache });
    expect(b).toEqual(a);
    expect(f).toHaveBeenCalledTimes(1);
  });

  test('404 → null', async () => {
    const f = okFetch('image/png', PNG, 404);
    expect(await fetchAvatar('https://img.example/a.png', { fetch: f, cache: new Map() })).toBeNull();
  });

  test('text/html → null', async () => {
    const f = okFetch('text/html');
    expect(await fetchAvatar('https://img.example/a.png', { fetch: f, cache: new Map() })).toBeNull();
  });

  test('fetch ném lỗi → null', async () => {
    const f = vi.fn(async () => {
      throw new Error('boom');
    }) as unknown as typeof fetch;
    expect(await fetchAvatar('https://img.example/a.png', { fetch: f, cache: new Map() })).toBeNull();
  });

  test('quá hạn 8000 ms → null', async () => {
    vi.useFakeTimers();
    const f = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    let done = false;
    const p = fetchAvatar('https://img.example/a.png', { fetch: f, cache: new Map() }).then(r => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(7999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toBeNull();
  });

  test('thân 3 MB → null', async () => {
    const f = okFetch('image/png', new Uint8Array(3 * 1024 * 1024));
    expect(await fetchAvatar('https://img.example/a.png', { fetch: f, cache: new Map() })).toBeNull();
  });

  test('kết quả null không được cache', async () => {
    const f = okFetch('image/png', PNG, 500);
    const cache = new Map<string, AvatarImage>();
    await fetchAvatar('https://img.example/a.png', { fetch: f, cache });
    await fetchAvatar('https://img.example/a.png', { fetch: f, cache });
    expect(f).toHaveBeenCalledTimes(2);
    expect(cache.size).toBe(0);
  });
});
