import type { ConnState, LiveEvent, LiveUser } from './events';
import { DrawQueue, type NewEntry, type QueueEntry } from './queue';
import { decide, matchFreeRequest } from './rules';
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './settings';
import { EMPTY_STATS, reduceStats, type SessionStats } from './stats';

export type Drawing = {
  entry: QueueEntry;
  /** 0..1 */
  progress: number;
  paused: boolean;
  /** Ảnh đã tải xong hoặc đã xác định dùng ảnh thay thế. */
  ready: boolean;
  /** entry.coins ≥ colorMinCoins lúc bắt đầu vẽ; sau đó không đổi. */
  color: boolean;
};

export type FeedItem = {
  id: number;
  at: number;
  kind: 'comment' | 'gift' | 'join' | 'follow' | 'system';
  user: LiveUser | null;
  text: string;
};

export type ErrorItem = { id: number; at: number; text: string; fatal: boolean };

export type BoardRow = { handle: string; nickname: string; coins: number };

export type Board = { startAt: number; endAt: number; locked: boolean; top: BoardRow[] };

export type SessionState = {
  conn: ConnState;
  roomId: string | null;
  stats: SessionStats;
  drawn: number;
  owed: number;
  declined: number;
  freeAccepted: number;
  drawing: Drawing | null;
  lastDrawn: QueueEntry | null;
  queue: readonly QueueEntry[];
  /** 200 mục mới nhất. */
  feed: FeedItem[];
  settings: Settings;
  /** 50 mục mới nhất, cũ trước. */
  errors: ErrorItem[];
  /** true sau disconnected/ended/error; false khi connected. Khi true, tick không lấy lượt mới. */
  draining: boolean;
  /** Cũ trước; phần tử cuối là bảng đang mở (nếu chưa hết giờ). Tối đa 12 bảng khoá + 1 bảng mở. */
  boards: Board[];
};

export type Command =
  | { type: 'pause' }
  | { type: 'resume' }
  /** Có id mà khác bức đang vẽ thì bỏ qua lệnh. */
  | { type: 'skip'; id?: string }
  | { type: 'redoLast' }
  | { type: 'clearQueue' }
  | { type: 'remove'; id: string }
  | { type: 'moveToFront'; id: string }
  | { type: 'addManual'; handle: string }
  | { type: 'setSettings'; patch: unknown }
  | { type: 'ready'; id: string };

const FEED_MAX = 200;
const ERRORS_MAX = 50;
/** Khung bảng xếp hạng, tính từ quà đầu tiên của bảng. */
export const BOARD_MS = 300_000;
const BOARD_TOP = 10;
const BOARDS_LOCKED_MAX = 12;

type OpenBoard = { startAt: number; endAt: number; rows: Map<string, BoardRow> };

const STATUS_TEXT: Record<ConnState, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối…',
  connected: 'Đã kết nối',
  disconnected: 'Đã ngắt kết nối',
  ended: 'Phiên live đã kết thúc',
  error: 'Lỗi kết nối',
};

export class Session {
  private settings: Settings;
  private random: () => number;
  private readonly startAt: number;
  private queue = new DrawQueue();
  private conn: ConnState = 'idle';
  private roomId: string | null = null;
  private stats: SessionStats = EMPTY_STATS;
  private drawn = 0;
  private owed = 0;
  private declined = 0;
  private freeAccepted = 0;
  private drawing: Drawing | null = null;
  private lastDrawn: QueueEntry | null = null;
  private feed: FeedItem[] = [];
  private feedId = 1;
  private errors: ErrorItem[] = [];
  private errorId = 1;
  private draining = false;
  private gifters = new Set<string>();
  /** Bảng đã khoá, cũ trước; chỉ giữ top 10. */
  private lockedBoards: Board[] = [];
  private openBoard: OpenBoard | null = null;
  private lastGiftAt: number | null = null;
  private lastTickAt: number | null = null;
  private listeners = new Set<(s: SessionState) => void>();

  constructor(opts?: { settings?: Settings; random?: () => number; startAt?: number }) {
    this.settings = sanitizeSettings(opts?.settings ?? DEFAULT_SETTINGS);
    this.random = opts?.random ?? Math.random;
    this.startAt = opts?.startAt ?? 0;
  }

  handle(e: LiveEvent): void {
    this.stats = reduceStats(this.stats, e);
    this.addFeed(e);

    if (e.type === 'status') {
      this.conn = e.state;
      if (e.state === 'connected') this.draining = false;
      else if (e.state === 'disconnected' || e.state === 'ended' || e.state === 'error') this.draining = true;
      if (e.state === 'error') this.addError(e.at, e.message || STATUS_TEXT.error, true);
      if (e.roomId !== undefined) this.roomId = e.roomId;
    } else if (e.type === 'error') {
      this.addError(e.at, e.message, false);
    } else if (e.type === 'gift') {
      this.gifters.add(e.user.userId);
      this.addToBoard(e);
      if (e.coins >= this.settings.minCoins) this.lastGiftAt = e.at;
      this.admit(e);
    } else if (e.type === 'comment') {
      const rest = matchFreeRequest(e.text, this.settings.freeKeyword);
      const alreadyQueued = rest !== null && this.queue.list().some(q => q.user.userId === e.user.userId);
      if (rest !== null && !alreadyQueued) this.admit(e);
    }
    this.emit();
  }

  command(c: Command, now: number): void {
    switch (c.type) {
      case 'pause':
      case 'resume':
        if (this.drawing) this.drawing = { ...this.drawing, paused: c.type === 'pause' };
        break;
      case 'skip':
        if (c.id !== undefined && c.id !== this.drawing?.entry.id) break;
        this.drawing = null;
        break;
      case 'redoLast':
        if (this.lastDrawn) this.queue.pushFront(this.lastDrawn, now);
        break;
      case 'clearQueue':
        this.queue.clear();
        break;
      case 'remove':
        this.queue.remove(c.id);
        break;
      case 'moveToFront':
        this.queue.moveToFront(c.id);
        break;
      case 'addManual': {
        const handle = c.handle.trim().replace(/^@+/, '').trim();
        if (handle === '') break;
        const user: LiveUser = { userId: 'manual:' + handle, handle, nickname: handle, avatarUrl: null };
        this.queue.add({ user, reason: 'manual', coins: 0, label: 'tự nhập' }, now, this.addOpts());
        break;
      }
      case 'setSettings':
        this.settings = sanitizeSettings(c.patch, this.settings);
        break;
      case 'ready':
        if (this.drawing && this.drawing.entry.id === c.id) this.drawing = { ...this.drawing, ready: true };
        break;
    }
    this.emit();
  }

  tick(now: number): void {
    const prev = this.lastTickAt ?? now;
    this.lastTickAt = now;
    let changed = false;

    const d = this.drawing;
    if (d && d.ready && !d.paused && now > prev) {
      const progress = Math.min(1, d.progress + (now - prev) / (this.settings.drawSeconds * 1000));
      changed = true;
      if (progress >= 1) {
        this.drawn += 1;
        this.lastDrawn = d.entry;
        this.drawing = null;
      } else {
        this.drawing = { ...d, progress };
      }
    }

    if (this.openBoard && now >= this.openBoard.endAt) {
      this.lockOpenBoard();
      changed = true;
    }

    if (!this.drawing && !this.draining) {
      const next = this.queue.takeEligible(now, this.settings.stageDelayMs);
      if (next) {
        this.drawing = { entry: next, progress: 0, paused: false, ready: false, color: next.coins >= this.settings.colorMinCoins };
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  getState(): SessionState {
    return {
      conn: this.conn,
      roomId: this.roomId,
      stats: { ...this.stats, gifters: this.gifters.size },
      drawn: this.drawn,
      owed: this.owed,
      declined: this.declined,
      freeAccepted: this.freeAccepted,
      drawing: this.drawing,
      lastDrawn: this.lastDrawn,
      queue: this.queue.list(),
      feed: [...this.feed],
      settings: { ...this.settings },
      errors: [...this.errors],
      draining: this.draining,
      boards: this.boardsView(),
    };
  }

  onChange(cb: (s: SessionState) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private admit(e: LiveEvent): void {
    const roll = e.type === 'comment' ? this.random() : 0;
    const d = decide(e, this.settings, {
      queueSize: this.queue.size,
      lastGiftAt: this.lastGiftAt,
      sessionStartAt: this.startAt,
      roll,
    });
    if (d.action === 'owe') this.owed += 1;
    else if (d.action === 'decline') this.declined += 1;
    else if (d.action === 'enqueue' && (e.type === 'gift' || e.type === 'comment')) {
      const entry: NewEntry = { user: e.user, reason: d.reason, coins: d.coins, label: d.label };
      const r = this.queue.add(entry, e.at, this.addOpts());
      if (r.result === 'full') this.owed += 1;
      else if (r.result === 'added' && d.reason === 'free') this.freeAccepted += 1;
    }
  }

  private addError(at: number, text: string, fatal: boolean): void {
    this.errors.push({ id: this.errorId++, at, text, fatal });
    if (this.errors.length > ERRORS_MAX) this.errors.splice(0, this.errors.length - ERRORS_MAX);
  }

  private addToBoard(e: Extract<LiveEvent, { type: 'gift' }>): void {
    if (this.openBoard && e.at >= this.openBoard.endAt) this.lockOpenBoard();
    if (!this.openBoard) this.openBoard = { startAt: e.at, endAt: e.at + BOARD_MS, rows: new Map() };
    const prev = this.openBoard.rows.get(e.user.userId);
    // Map giữ thứ tự chèn → bằng xu thì ai tặng trước đứng trước.
    this.openBoard.rows.set(e.user.userId, {
      handle: e.user.handle,
      nickname: e.user.nickname,
      coins: (prev?.coins ?? 0) + e.coins,
    });
  }

  private lockOpenBoard(): void {
    const b = this.openBoard;
    if (!b) return;
    this.openBoard = null;
    this.lockedBoards.push({ startAt: b.startAt, endAt: b.endAt, locked: true, top: topRows(b.rows) });
    if (this.lockedBoards.length > BOARDS_LOCKED_MAX) this.lockedBoards.splice(0, this.lockedBoards.length - BOARDS_LOCKED_MAX);
  }

  private boardsView(): Board[] {
    const out = this.lockedBoards.map(b => ({ ...b, top: b.top.map(r => ({ ...r })) }));
    if (this.openBoard) {
      out.push({ startAt: this.openBoard.startAt, endAt: this.openBoard.endAt, locked: false, top: topRows(this.openBoard.rows) });
    }
    return out;
  }

  private addOpts() {
    return { combineWindowMs: this.settings.combineWindowMs, max: this.settings.maxQueue };
  }

  private addFeed(e: LiveEvent): void {
    let item: Omit<FeedItem, 'id'> | null = null;
    switch (e.type) {
      case 'comment':
        item = { at: e.at, kind: 'comment', user: e.user, text: e.text };
        break;
      case 'gift':
        item = { at: e.at, kind: 'gift', user: e.user, text: `${e.giftName} ×${e.count} · ${e.coins} xu` };
        break;
      case 'join':
        item = { at: e.at, kind: 'join', user: e.user, text: 'đã tham gia' };
        break;
      case 'follow':
        item = { at: e.at, kind: 'follow', user: e.user, text: 'đã theo dõi' };
        break;
      case 'status': {
        if (e.state === 'error') return; // vào bảng lỗi, không vào feed
        let text = STATUS_TEXT[e.state];
        if (e.roomId) text += ` (room ${e.roomId})`;
        if (e.message) text += `: ${e.message}`;
        item = { at: e.at, kind: 'system', user: null, text };
        break;
      }
    }
    if (!item) return;
    this.feed.push({ id: this.feedId++, ...item });
    if (this.feed.length > FEED_MAX) this.feed.splice(0, this.feed.length - FEED_MAX);
  }

  private emit(): void {
    if (this.listeners.size === 0) return;
    const s = this.getState();
    for (const cb of this.listeners) cb(s);
  }
}

function topRows(rows: Map<string, BoardRow>): BoardRow[] {
  // sort ổn định: bằng xu giữ thứ tự chèn
  return [...rows.values()].sort((a, b) => b.coins - a.coins).slice(0, BOARD_TOP).map(r => ({ ...r }));
}
