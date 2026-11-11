import { expect, test } from 'vitest';
import { INK, buildStrokes, placeholderGray, strokeColors, strokesAt, toGray, type Stroke } from '../../src/core/sketch';

const N = 96 * 96;
const white = new Uint8ClampedArray(N).fill(255);
const black = new Uint8ClampedArray(N);

test('toGray', () => { expect(Array.from(toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])))).toEqual([76, 255]); });
test('mọi điểm nằm trong khung', () => {
  for (const p of buildStrokes(black).flat()) {
    expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[0]).toBeLessThanOrEqual(1);
    expect(p[1]).toBeGreaterThanOrEqual(-0.02); expect(p[1]).toBeLessThanOrEqual(1.02);
  }
});
test('ảnh trắng cho nét thẳng', () => { for (const s of buildStrokes(white)) expect(new Set(s.map(p => p[1])).size).toBe(1); });
test('ảnh đen cho nét gợn', () => { expect(buildStrokes(black).some(s => new Set(s.map(p => p[1])).size > 1)).toBe(true); });
test('zíc-zắc', () => { const s = buildStrokes(white); expect(s[0][0][0]).toBeLessThan(s[0].at(-1)![0]); expect(s[1][0][0]).toBeGreaterThan(s[1].at(-1)![0]); });
test('số nét không vượt lines', () => { expect(buildStrokes(white, { lines: 10 }).length).toBeLessThanOrEqual(10); });
test('strokeColors: ảnh đỏ thuần → #d90000', () => {
  const red = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) { red[i * 4] = 255; red[i * 4 + 3] = 255; }
  const s = buildStrokes(white); const c = strokeColors(red, s);
  expect(c.length).toBe(s.length); expect(new Set(c)).toEqual(new Set(['#d90000']));
});
test('strokeColors: null hoặc trong suốt → INK', () => {
  const s = buildStrokes(white);
  expect(new Set(strokeColors(null, s))).toEqual(new Set([INK]));
  expect(new Set(strokeColors(new Uint8ClampedArray(N * 4), s))).toEqual(new Set([INK]));
});
test('strokesAt biên', () => {
  const s: Stroke[] = [[[0, 0], [1, 0]], [[1, 1], [0, 1]]];
  expect(strokesAt(s, 0)).toEqual({ done: [], pen: [0, 0] });
  expect(strokesAt(s, 0.25)).toEqual({ done: [[[0, 0], [0.5, 0]]], pen: [0.5, 0] });
  expect(strokesAt(s, 1)).toEqual({ done: s, pen: null });
  expect(strokesAt(s, 7)).toEqual({ done: s, pen: null });
  expect(strokesAt([], 0.5)).toEqual({ done: [], pen: null });
});
test('placeholder xác định và đúng cỡ', () => {
  expect(placeholderGray('a')).toEqual(placeholderGray('a'));
  expect(placeholderGray('a').length).toBe(N);
  expect(buildStrokes(placeholderGray('a')).length).toBeGreaterThan(0);
});
