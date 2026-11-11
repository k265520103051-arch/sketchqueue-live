import type { LiveEvent, LiveSource, LiveUser } from '../core/events';

export const TEST_USERS: LiveUser[] = [
  { userId: 'sim:mai_test', handle: 'mai_test', nickname: 'Mai', avatarUrl: null },
  { userId: 'sim:bao_test', handle: 'bao_test', nickname: 'Bảo', avatarUrl: null },
  { userId: 'sim:linh_test', handle: 'linh_test', nickname: 'Linh', avatarUrl: null },
];

export const TEST_GIFTS: { name: string; coins: number }[] = [
  { name: 'Rose', coins: 1 },
  { name: 'Mũ', coins: 99 },
];

const COMMENTS = ['xin chào', 'vẽ đẹp quá', 'hay ghê', 'cho mình xem với', 'tuyệt vời'];

export class SimulatorSource implements LiveSource {
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(e: LiveEvent) => void>();
  private viewers = 120;

  constructor(opts?: { intervalMs?: number; now?: () => number; random?: () => number }) {
    this.intervalMs = opts?.intervalMs ?? 1500;
    this.now = opts?.now ?? Date.now;
    this.random = opts?.random ?? Math.random;
  }

  async start(): Promise<void> {
    if (this.timer) return;
    this.emit({ type: 'status', state: 'connected', roomId: 'rehearsal', at: this.now() });
    this.timer = setInterval(() => this.emitRandom(), this.intervalMs);
  }

  async stop(): Promise<void> {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    this.emit({ type: 'status', state: 'disconnected', at: this.now() });
  }

  onEvent(cb: (e: LiveEvent) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  emitGift(handle: string, giftName: string, coinsEach: number, count: number): void {
    this.emit({ type: 'gift', user: this.user(handle), giftName, coins: coinsEach * count, count, at: this.now() });
  }

  emitComment(handle: string, text: string): void {
    this.emit({ type: 'comment', user: this.user(handle), text, at: this.now() });
  }

  emitLikes(handle: string, count: number): void {
    this.emit({ type: 'like', user: this.user(handle), count, at: this.now() });
  }

  private user(handle: string): LiveUser {
    const h = handle.trim().replace(/^@+/, '');
    if (h === '') return TEST_USERS[0];
    return TEST_USERS.find(u => u.handle === h) ?? { userId: 'sim:' + h, handle: h, nickname: h, avatarUrl: null };
  }

  private pickUser(): LiveUser {
    return TEST_USERS[Math.floor(this.random() * TEST_USERS.length) % TEST_USERS.length];
  }

  private emitRandom(): void {
    const r = this.random();
    const user = this.pickUser();
    const at = this.now();
    if (r < 0.5) {
      this.emit({ type: 'comment', user, text: COMMENTS[Math.floor(this.random() * COMMENTS.length) % COMMENTS.length], at });
    } else if (r < 0.7) {
      this.emit({ type: 'like', user, count: 1 + Math.floor(this.random() * 10), at });
    } else if (r < 0.85) {
      this.viewers += 1;
      this.emit({ type: 'join', user, at });
      this.emit({ type: 'viewers', count: this.viewers, at });
    } else if (r < 0.93) {
      this.emit({ type: 'gift', user, giftName: 'Rose', coins: 1, count: 1, at });
    } else if (r < 0.95) {
      this.emit({ type: 'gift', user, giftName: 'Mũ', coins: 99, count: 1, at });
    } else {
      this.emit({ type: 'comment', user, text: '!ve', at });
    }
  }

  private emit(e: LiveEvent): void {
    for (const cb of this.listeners) cb(e);
  }
}
