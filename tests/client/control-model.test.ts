import { describe, expect, test } from 'vitest';
import { statTiles, feedLine, keyToCommand, queueRow, SETTING_FIELDS, toFormValue, fromFormValue } from '../../src/client/control/control-model';
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

describe('control-model', () => {
  test('statTiles: 10 ô đúng thứ tự', () => {
    expect(statTiles(state).map(t => t.label)).toEqual(['Người xem', 'Xu buổi này', 'Lượt quà', 'Người tặng', 'Fan mới', 'Tim', 'Bình luận', 'Đã vẽ', 'Đang chờ', 'Nợ vẽ sau']);
    expect(statTiles(stateWith({ viewers: 150 }))[0].value).toBe('150');
    expect(statTiles(stateWithQueue(4))[8].value).toBe('4');
  });

  test('keyToCommand', () => {
    expect(keyToCommand('p', drawingState({ paused: false }))).toEqual({ type: 'pause' });
    expect(keyToCommand('P', drawingState({ paused: true }))).toEqual({ type: 'resume' });
    expect(keyToCommand('s', drawingState({}))).toEqual({ type: 'skip' });
    expect(keyToCommand('s', idleState)).toBeNull();
    expect(keyToCommand('x', drawingState({}))).toBeNull();
  });

  test('feedLine', () => {
    expect(feedLine({ id: 1, at: Date.UTC(2026, 0, 1, 9, 5, 7), kind: 'system', user: null, text: 'Đã kết nối' })).toMatch(/^\d\d:\d\d:\d\d  · Đã kết nối$/);
    const u = { userId: 'sim:mai_test', handle: 'mai_test', nickname: 'Mai', avatarUrl: null };
    expect(feedLine({ id: 2, at: 0, kind: 'comment', user: u, text: '<b>x</b>' })).toMatch(/^\d\d:\d\d:\d\d  Mai @mai_test: <b>x<\/b>$/);
  });

  test('queueRow', () => {
    expect(queueRow(entry({ reason: 'gift', coins: 6, gifts: 2, nickname: 'Mai' }))).toBe('Mai · 6 xu (gộp 2 lần)');
    expect(queueRow(entry({ reason: 'gift', coins: 1, gifts: 1, nickname: 'Mai' }))).toBe('Mai · 1 xu');
    expect(queueRow(entry({ reason: 'free', nickname: 'Bảo' }))).toBe('Bảo · xin vẽ');
    expect(queueRow(entry({ reason: 'manual', nickname: 'linh_test' }))).toBe('linh_test · tự nhập');
  });

  test('SETTING_FIELDS và chuyển đổi giá trị form', () => {
    expect(SETTING_FIELDS.map(f => f.key).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
    expect(toFormValue('combineWindowMs', DEFAULT_SETTINGS)).toBe('60');
    expect(toFormValue('freeChance', DEFAULT_SETTINGS)).toBe('10');
    expect(toFormValue('drawSeconds', DEFAULT_SETTINGS)).toBe('45');
    expect(toFormValue('acceptingGifts', DEFAULT_SETTINGS)).toBe(true);
    expect(toFormValue('freeKeyword', DEFAULT_SETTINGS)).toBe('!ve');
    expect(fromFormValue('combineWindowMs', '90')).toEqual({ combineWindowMs: 90000 });
    expect(fromFormValue('freeChance', '25')).toEqual({ freeChance: 0.25 });
    expect(fromFormValue('drawSeconds', 'abc')).toEqual({});
    expect(fromFormValue('drawSeconds', '')).toEqual({});
    expect(fromFormValue('acceptingGifts', false)).toEqual({ acceptingGifts: false });
    expect(fromFormValue('freeKeyword', '!draw')).toEqual({ freeKeyword: '!draw' });
  });
});
