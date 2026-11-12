import { describe, expect, test } from 'vitest';
import { upNext, noticeVisible, stageCaption, liveProgress } from '../../src/client/stage/stage-model';
import type { Drawing, SessionState } from '../../src/core/session';
import type { QueueEntry } from '../../src/core/queue';
import { DEFAULT_SETTINGS, type Settings } from '../../src/core/settings';
import { EMPTY_STATS, type SessionStats } from '../../src/core/stats';

function entry(p: Partial<QueueEntry> & { nickname?: string; handle?: string } = {}): QueueEntry {
  const { nickname = 'Mai', handle = 'mai_test', ...rest } = p;
  return {
    id: 'q1',
    user: { userId: 'sim:' + handle, handle, nickname, avatarUrl: null },
    reason: 'gift',
    coins: 1,
    gifts: 1,
    label: 'Rose',
    enqueuedAt: 0,
    lastGiftAt: 0,
    pinSeq: 0,
    ...rest,
  };
}

const idleState: SessionState = {
  conn: 'idle',
  roomId: null,
  stats: EMPTY_STATS,
  drawn: 0,
  owed: 0,
  declined: 0,
  freeAccepted: 0,
  drawing: null,
  lastDrawn: null,
  queue: [],
  feed: [],
  settings: { ...DEFAULT_SETTINGS },
  errors: [],
  draining: false,
  boards: [],
};

const state = idleState;

function stateWithQueue(n: number): SessionState {
  const queue = Array.from({ length: n }, (_, i) =>
    entry({ id: 'q' + (i + 1), handle: 'u' + i, nickname: 'Người ' + (i + 1), coins: 10 - i }),
  );
  return { ...idleState, queue };
}

function stateWith(p: Partial<Settings> & Partial<SessionStats>): SessionState {
  const settings = { ...DEFAULT_SETTINGS };
  const stats = { ...EMPTY_STATS };
  for (const [k, v] of Object.entries(p)) {
    if (k in settings) (settings as Record<string, unknown>)[k] = v;
    else (stats as Record<string, unknown>)[k] = v;
  }
  return { ...idleState, settings, stats };
}

function drawingState(p: Partial<Drawing> & { handle?: string }): SessionState {
  const { handle = 'mai_test', ...rest } = p;
  const drawing: Drawing = { entry: entry({ handle }), progress: 0, paused: false, ready: true, color: false, ...rest };
  return { ...idleState, drawing };
}

describe('stage-model', () => {
  test('upNext: tối đa 3 lượt đầu', () => {
    expect(upNext(stateWithQueue(5)).map(x => x.rank)).toEqual([1, 2, 3]);
    expect(upNext(stateWithQueue(0))).toEqual([]);
    expect(upNext(stateWithQueue(2))[0]).toEqual({ rank: 1, name: 'Người 1', coins: 10 });
  });

  test('noticeVisible', () => {
    expect(noticeVisible(stateWith({ acceptingGifts: false }))).toBe(true);
    expect(noticeVisible(stateWith({ acceptingGifts: true }))).toBe(false);
  });

  test('stageCaption', () => {
    expect(stageCaption(idleState)).toBe('Đang chờ lượt vẽ…');
    expect(stageCaption(drawingState({ ready: false }))).toBe('Đang chuẩn bị…');
    expect(stageCaption(drawingState({ ready: true, handle: 'mai_test' }))).toBe('@mai_test');
  });

  test('liveProgress', () => {
    const d = (p: Partial<Drawing>) => ({ ...drawingState({ ready: true }).drawing!, progress: 0.2, ...p });
    expect(liveProgress(d({}), 1000, 1100, 10)).toBeCloseTo(0.21);
    expect(liveProgress(d({ paused: true }), 1000, 1100, 10)).toBe(0.2);
    expect(liveProgress(d({ ready: false }), 1000, 1100, 10)).toBe(0.2);
    expect(liveProgress(d({}), 1000, 9000, 10)).toBeCloseTo(0.25);
    expect(liveProgress(d({ progress: 0.99 }), 1000, 1400, 10)).toBe(1);
    expect(liveProgress(d({}), 1000, 900, 10)).toBe(0.2);
  });
});
