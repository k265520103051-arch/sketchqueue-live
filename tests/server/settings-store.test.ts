import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { loadSettings, saveSettings } from '../../src/server/settings-store';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'sq-settings-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('settings-store', () => {
  test('file không tồn tại → DEFAULT_SETTINGS', () => {
    expect(loadSettings(join(dir, 'none.json'))).toEqual(DEFAULT_SETTINGS);
  });

  test("nội dung '{oops' → DEFAULT_SETTINGS", () => {
    const p = join(dir, 's.json');
    writeFileSync(p, '{oops');
    expect(loadSettings(p)).toEqual(DEFAULT_SETTINGS);
  });

  test('giá trị vô lý → mặc định cho trường sai', () => {
    const p = join(dir, 's.json');
    writeFileSync(p, '{"drawSeconds":0,"minCoins":"x"}');
    const s = loadSettings(p);
    expect(s.drawSeconds).toBe(5);
    expect(s.minCoins).toBe(1);
  });

  test('saveSettings rồi loadSettings trả lại đúng đối tượng', () => {
    const p = join(dir, 's.json');
    const s = { ...DEFAULT_SETTINGS, drawSeconds: 30, freeKeyword: '!draw', acceptingGifts: false };
    saveSettings(p, s);
    expect(loadSettings(p)).toEqual(s);
  });

  test('saveSettings vào đường dẫn không ghi được → không ném lỗi', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => saveSettings(join(dir, 'no', 'such', 'dir', 's.json'), DEFAULT_SETTINGS)).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });
});
