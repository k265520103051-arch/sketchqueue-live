import type { Command, FeedItem, SessionState } from '../../core/session';
import type { QueueEntry } from '../../core/queue';
import type { Settings } from '../../core/settings';
import { displayName } from '../../core/text';

function num(n: number): string {
  return n.toLocaleString('vi-VN');
}

/** Đúng 10 ô số liệu theo thứ tự cố định. */
export function statTiles(s: SessionState): { label: string; value: string }[] {
  const st = s.stats;
  return [
    { label: 'Người xem', value: num(st.viewers) },
    { label: 'Xu buổi này', value: num(st.coins) },
    { label: 'Lượt quà', value: num(st.giftCount) },
    { label: 'Người tặng', value: num(st.gifters) },
    { label: 'Fan mới', value: num(st.newFollowers) },
    { label: 'Tim', value: num(st.likes) },
    { label: 'Bình luận', value: num(st.comments) },
    { label: 'Đã vẽ', value: num(s.drawn) },
    { label: 'Đang chờ', value: num(s.queue.length) },
    { label: 'Nợ vẽ sau', value: num(s.owed) },
  ];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function clock(at: number): string {
  const d = new Date(at);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** 'HH:MM:SS  Tên @handle: nội dung'; mục system: 'HH:MM:SS  · nội dung'. */
export function feedLine(f: FeedItem): string {
  const t = clock(f.at);
  if (f.kind === 'system' || !f.user) return `${t}  · ${f.text}`;
  return `${t}  ${displayName(f.user)} @${f.user.handle}: ${f.text}`;
}

export function keyToCommand(key: string, s: SessionState): Command | null {
  if (!s.drawing) return null;
  const k = key.toLowerCase();
  if (k === 'p') return { type: s.drawing.paused ? 'resume' : 'pause' };
  if (k === 's') return { type: 'skip' };
  return null;
}

export function queueRow(e: QueueEntry): string {
  const name = displayName(e.user);
  if (e.reason === 'free') return `${name} · xin vẽ`;
  if (e.reason === 'manual') return `${name} · tự nhập`;
  return `${name} · ${e.coins} xu` + (e.gifts > 1 ? ` (gộp ${e.gifts} lần)` : '');
}

export type SettingField = { key: keyof Settings; label: string; kind: 'number' | 'seconds' | 'percent' | 'boolean' | 'text' };

export const SETTING_FIELDS: SettingField[] = [
  { key: 'minCoins', label: 'Số xu tối thiểu để vào hàng', kind: 'number' },
  { key: 'combineWindowMs', label: 'Gộp quà trong (giây)', kind: 'seconds' },
  { key: 'maxQueue', label: 'Hàng chờ tối đa', kind: 'number' },
  { key: 'acceptingGifts', label: 'Nhận quà', kind: 'boolean' },
  { key: 'allowFreeRequests', label: 'Cho xin vẽ miễn phí', kind: 'boolean' },
  { key: 'freeKeyword', label: 'Từ khoá xin vẽ', kind: 'text' },
  { key: 'freeIdleMs', label: 'Nhận xin vẽ khi không có quà trong (giây)', kind: 'seconds' },
  { key: 'freeChance', label: 'Tỉ lệ ngẫu nhiên (%)', kind: 'percent' },
  { key: 'freeQueueLimit', label: 'Chỉ nhận xin vẽ khi hàng chờ dưới (lượt)', kind: 'number' },
  { key: 'colorMinCoins', label: 'Vẽ màu từ (xu)', kind: 'number' },
  { key: 'drawSeconds', label: 'Thời gian vẽ (giây)', kind: 'number' },
  { key: 'stageDelayMs', label: 'Độ trễ sân khấu (giây)', kind: 'seconds' },
];

/** Ba nhóm của bảng cài đặt, theo thứ tự hiển thị. */
export const SETTING_GROUPS: { title: string; keys: (keyof Settings)[] }[] = [
  { title: 'Quà và hàng chờ', keys: ['minCoins', 'combineWindowMs', 'maxQueue', 'acceptingGifts'] },
  { title: 'Xin vẽ không quà', keys: ['allowFreeRequests', 'freeKeyword', 'freeIdleMs', 'freeChance', 'freeQueueLimit'] },
  { title: 'Vẽ và sân khấu', keys: ['colorMinCoins', 'drawSeconds', 'stageDelayMs'] },
];

function kindOf(key: keyof Settings): SettingField['kind'] {
  const f = SETTING_FIELDS.find(x => x.key === key);
  return f ? f.kind : 'text';
}

/** Làm tròn để tránh lỗi dấu phẩy động khi đổi đơn vị (vd 0.1 × 100). */
function tidy(n: number): string {
  return String(Math.round(n * 1e6) / 1e6);
}

export function toFormValue(key: keyof Settings, s: Settings): string | boolean {
  const v = s[key];
  switch (kindOf(key)) {
    case 'boolean':
      return Boolean(v);
    case 'seconds':
      return tidy((v as number) / 1000);
    case 'percent':
      return tidy((v as number) * 100);
    case 'number':
      return tidy(v as number);
    default:
      return String(v);
  }
}

export function fromFormValue(key: keyof Settings, raw: string | boolean): Partial<Settings> {
  const kind = kindOf(key);
  if (kind === 'boolean') return typeof raw === 'boolean' ? ({ [key]: raw } as Partial<Settings>) : {};
  if (typeof raw !== 'string') return {};
  if (kind === 'text') return { [key]: raw } as Partial<Settings>;
  const t = raw.trim().replace(',', '.');
  if (t === '') return {};
  const n = Number(t);
  if (!Number.isFinite(n)) return {};
  const value = kind === 'seconds' ? Math.round(n * 1000) : kind === 'percent' ? Math.round(n * 1e4) / 1e6 : n;
  return { [key]: value } as Partial<Settings>;
}
