import type { LiveUser } from './events';

export type QueueReason = 'gift' | 'free' | 'manual';

export type QueueEntry = {
  id: string;
  user: LiveUser;
  reason: QueueReason;
  /** Tổng xu đã gộp. */
  coins: number;
  /** Số lần tặng đã gộp (0 với free/manual). */
  gifts: number;
  label: string;
  enqueuedAt: number;
  /** Với free/manual bằng enqueuedAt. */
  lastGiftAt: number;
  /** 0 = không ghim; lớn hơn = ghim sau, xếp trước. */
  pinSeq: number;
};

export type NewEntry = { user: LiveUser; reason: QueueReason; coins: number; label: string };

export type AddResult = { result: 'added' | 'merged'; entry: QueueEntry } | { result: 'full' | 'duplicate' };

type Slot = { entry: QueueEntry; order: number };

export class DrawQueue {
  private slots: Slot[] = [];
  private nextId = 1;
  private nextOrder = 1;
  private nextPin = 1;

  add(e: NewEntry, now: number, opts: { combineWindowMs: number; max: number }): AddResult {
    const uid = e.user.userId;
    if (e.reason === 'gift') {
      this.slots = this.slots.filter(s => !(s.entry.user.userId === uid && s.entry.reason === 'free'));
      let target: Slot | null = null;
      for (const s of this.slots) {
        const x = s.entry;
        if (x.user.userId !== uid || x.reason !== 'gift') continue;
        if (now - x.lastGiftAt > opts.combineWindowMs) continue;
        if (!target || x.lastGiftAt > target.entry.lastGiftAt) target = s;
      }
      if (target) {
        const x = target.entry;
        target.entry = { ...x, coins: x.coins + e.coins, gifts: x.gifts + 1, lastGiftAt: now, label: e.label, user: e.user };
        this.sort();
        return { result: 'merged', entry: target.entry };
      }
    } else if (this.slots.some(s => s.entry.user.userId === uid)) {
      return { result: 'duplicate' };
    }
    if (this.slots.length >= opts.max) return { result: 'full' };
    const entry: QueueEntry = {
      id: this.newId(),
      user: e.user,
      reason: e.reason,
      coins: e.coins,
      gifts: e.reason === 'gift' ? 1 : 0,
      label: e.label,
      enqueuedAt: now,
      lastGiftAt: now,
      pinSeq: 0,
    };
    this.slots.push({ entry, order: this.nextOrder++ });
    this.sort();
    return { result: 'added', entry };
  }

  takeEligible(now: number, stageDelayMs: number): QueueEntry | null {
    const i = this.slots.findIndex(s => now - s.entry.lastGiftAt >= stageDelayMs);
    if (i < 0) return null;
    return this.slots.splice(i, 1)[0].entry;
  }

  pushFront(e: QueueEntry, now: number): QueueEntry {
    const entry: QueueEntry = { ...e, id: this.newId(), pinSeq: this.nextPin++, enqueuedAt: now, lastGiftAt: Math.min(e.lastGiftAt, now) };
    this.slots.push({ entry, order: this.nextOrder++ });
    this.sort();
    return entry;
  }

  remove(id: string): boolean {
    const n = this.slots.length;
    this.slots = this.slots.filter(s => s.entry.id !== id);
    return this.slots.length !== n;
  }

  moveToFront(id: string): boolean {
    const s = this.slots.find(x => x.entry.id === id);
    if (!s) return false;
    s.entry = { ...s.entry, pinSeq: this.nextPin++ };
    this.sort();
    return true;
  }

  clear(): void {
    this.slots = [];
  }

  list(): readonly QueueEntry[] {
    return this.slots.map(s => s.entry);
  }

  get size(): number {
    return this.slots.length;
  }

  private newId(): string {
    return 'q' + this.nextId++;
  }

  private sort(): void {
    this.slots.sort(
      (a, b) =>
        b.entry.pinSeq - a.entry.pinSeq ||
        b.entry.coins - a.entry.coins ||
        a.entry.enqueuedAt - b.entry.enqueuedAt ||
        a.order - b.order,
    );
  }
}
