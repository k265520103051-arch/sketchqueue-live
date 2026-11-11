import { describe, expect, test } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../../src/core/settings';

describe('sanitizeSettings', () => {
  test('mặc định', () => {
    expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      minCoins: 1, combineWindowMs: 60000, maxQueue: 50, freeKeyword: '!ve', freeIdleMs: 120000,
      freeChance: 0.1, freeQueueLimit: 3, colorMinCoins: 99, drawSeconds: 45, stageDelayMs: 3000,
      acceptingGifts: true, allowFreeRequests: true,
    });
  });
  test('kẹp khoảng và làm tròn', () => {
    expect(sanitizeSettings({ drawSeconds: 0 }).drawSeconds).toBe(5);
    expect(sanitizeSettings({ drawSeconds: 9999 }).drawSeconds).toBe(600);
    expect(sanitizeSettings({ minCoins: -3 }).minCoins).toBe(1);
    expect(sanitizeSettings({ minCoins: 2.9 }).minCoins).toBe(2);
    expect(sanitizeSettings({ freeChance: 5 }).freeChance).toBe(1);
  });
  test('sai kiểu lấy base', () => {
    expect(sanitizeSettings({ freeChance: '0.5' }).freeChance).toBe(0.1);
    expect(sanitizeSettings({ combineWindowMs: NaN }).combineWindowMs).toBe(60000);
    expect(sanitizeSettings({ acceptingGifts: 'no' }).acceptingGifts).toBe(true);
  });
  test('từ khoá', () => {
    expect(sanitizeSettings({ freeKeyword: '  ' }).freeKeyword).toBe('!ve');
    expect(sanitizeSettings({ freeKeyword: ' !Draw ' }).freeKeyword).toBe('!Draw');
    expect(sanitizeSettings({ freeKeyword: 'a b' }).freeKeyword).toBe('!ve');
  });
  test('bỏ trường lạ, dùng base', () => {
    expect(sanitizeSettings({ hack: 1 })).not.toHaveProperty('hack');
    expect(sanitizeSettings({ drawSeconds: 20 }, { ...DEFAULT_SETTINGS, minCoins: 7 })).toMatchObject({ drawSeconds: 20, minCoins: 7 });
  });
});
