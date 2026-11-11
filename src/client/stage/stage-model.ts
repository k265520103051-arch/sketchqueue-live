import type { Drawing, SessionState } from '../../core/session';
import { displayName } from '../../core/text';

/** Phần nội suy tối đa (ms) khi chưa nhận state mới từ máy chủ. */
const MAX_EXTRAPOLATE_MS = 500;

/** Tối đa 3 lượt đầu hàng chờ. */
export function upNext(state: SessionState): { rank: number; name: string; coins: number }[] {
  return state.queue.slice(0, 3).map((e, i) => ({ rank: i + 1, name: displayName(e.user), coins: e.coins }));
}

export function noticeVisible(state: SessionState): boolean {
  return state.settings.acceptingGifts === false;
}

export function stageCaption(state: SessionState): string {
  const d = state.drawing;
  if (!d) return 'Đang chờ lượt vẽ…';
  if (!d.ready) return 'Đang chuẩn bị…';
  return '@' + d.entry.user.handle;
}

/** Tiến độ để vẽ ở khung hình hiện tại, nội suy từ state nhận lúc `receivedAt`. */
export function liveProgress(d: Drawing, receivedAt: number, now: number, drawSeconds: number): number {
  if (d.paused || !d.ready) return d.progress;
  const elapsed = Math.min(MAX_EXTRAPOLATE_MS, Math.max(0, now - receivedAt));
  const durationMs = Math.max(1, drawSeconds * 1000);
  return Math.min(1, d.progress + elapsed / durationMs);
}
