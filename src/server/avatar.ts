export type AvatarImage = { contentType: string; body: Buffer };

const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Tải ảnh đại diện qua https. Trả `null` khi url null / không phải https, hết giờ,
 * HTTP không 2xx, content-type không phải ảnh, hoặc thân > 2 MB. Không bao giờ ném lỗi.
 * Chỉ cache kết quả thành công.
 */
export async function fetchAvatar(
  url: string | null,
  deps: { fetch: typeof fetch; cache: Map<string, AvatarImage>; timeoutMs?: number },
): Promise<AvatarImage | null> {
  if (url === null || typeof url !== 'string') return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;

  const cached = deps.cache.get(url);
  if (cached) return cached;

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>(resolve => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  });

  const load = async (): Promise<AvatarImage | null> => {
    const res = await deps.fetch(url, { signal: controller.signal, redirect: 'follow' });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') ?? '').trim();
    if (!contentType.toLowerCase().startsWith('image/')) return null;
    const declared = Number(res.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) return null;
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length > MAX_BYTES) return null;
    return { contentType, body };
  };

  try {
    const result = await Promise.race([load().catch(() => null), timeout]);
    if (result) deps.cache.set(url, result);
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
