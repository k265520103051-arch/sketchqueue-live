export type Point = [number, number];
export type Stroke = Point[];

export const SKETCH_SIZE = 96;
export const INK = '#1f3a8a';

const S = SKETCH_SIZE;

function clampIdx(v: number): number {
  return Math.min(S - 1, Math.max(0, Math.floor(v * S)));
}

/** RGBA → xám (0.299R + 0.587G + 0.114B, làm tròn); alpha 0 coi là trắng. */
export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const n = Math.floor(rgba.length / 4);
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const a = rgba[i * 4 + 3];
    out[i] = a === 0 ? 255 : Math.round(0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]);
  }
  return out;
}

/** Nét sóng điều biên trong vòng tròn, một nét mỗi hàng, đi zíc-zắc. */
export function buildStrokes(gray: Uint8ClampedArray, opts?: { lines?: number }): Stroke[] {
  const lines = opts?.lines ?? 40;
  const r = 0.5;
  const step = 1 / lines;
  const amp = step * 0.45;
  const freq = 2 * Math.PI * 24;
  const dx = 1 / (S * 2);
  const out: Stroke[] = [];
  for (let i = 0; i < lines; i++) {
    const y = (i + 0.5) * step;
    const dy = y - 0.5;
    if (Math.abs(dy) >= r) continue;
    const half = Math.sqrt(r * r - dy * dy);
    const x0 = 0.5 - half;
    const x1 = 0.5 + half;
    const pts: Stroke = [];
    for (let x = x0; x <= x1 + 1e-9; x += dx) {
      const xc = Math.min(1, x);
      const d = 1 - gray[clampIdx(y) * S + clampIdx(xc)] / 255;
      pts.push([xc, y + Math.sin(xc * freq) * amp * d]);
    }
    if (i % 2 === 1) pts.reverse();
    if (pts.length >= 2) out.push(pts);
  }
  return out;
}

const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');

/** Một màu '#rrggbb' cho mỗi nét = trung bình RGB tại các điểm của nét, nhân 0.85. */
export function strokeColors(rgba: Uint8ClampedArray | null, strokes: Stroke[]): string[] {
  return strokes.map(stroke => {
    if (!rgba) return INK;
    let r = 0, g = 0, b = 0, n = 0;
    for (const [x, y] of stroke) {
      const i = (clampIdx(y) * S + clampIdx(x)) * 4;
      if (rgba[i + 3] === 0) continue;
      r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++;
    }
    if (n === 0) return INK;
    return '#' + hex((r / n) * 0.85) + hex((g / n) * 0.85) + hex((b / n) * 0.85);
  });
}

const segLen = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function strokeLen(s: Stroke): number {
  let L = 0;
  for (let i = 1; i < s.length; i++) L += segLen(s[i - 1], s[i]);
  return L;
}

/** Phần đã vẽ ở tiến độ t (0..1) và vị trí bút. */
export function strokesAt(strokes: Stroke[], t: number): { done: Stroke[]; pen: Point | null } {
  if (strokes.length === 0) return { done: [], pen: null };
  if (t >= 1) return { done: strokes, pen: null };
  if (t <= 0) return { done: [], pen: strokes[0][0] };
  const total = strokes.reduce((a, s) => a + strokeLen(s), 0);
  if (total === 0) return { done: strokes, pen: null };
  let remaining = t * total;
  const done: Stroke[] = [];
  for (const s of strokes) {
    const L = strokeLen(s);
    if (remaining >= L) {
      done.push(s);
      remaining -= L;
      if (remaining === 0) return { done, pen: s[s.length - 1] };
      continue;
    }
    const part: Stroke = [s[0]];
    for (let i = 1; i < s.length; i++) {
      const l = segLen(s[i - 1], s[i]);
      if (remaining >= l) {
        part.push(s[i]);
        remaining -= l;
        continue;
      }
      const f = l === 0 ? 0 : remaining / l;
      const p: Point = [s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f];
      part.push(p);
      done.push(part);
      return { done, pen: p };
    }
    done.push(part);
    return { done, pen: part[part.length - 1] };
  }
  return { done, pen: null };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ảnh thay thế: dải chéo, xác định theo seed. */
export function placeholderGray(seed: string): Uint8ClampedArray {
  const h = hashSeed(seed);
  const period = 10 + (h % 14);
  const shift = (h >>> 8) % period;
  const out = new Uint8ClampedArray(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const band = Math.floor((x + y + shift) / period) % 2;
      out[y * S + x] = band === 0 ? 70 : 200;
    }
  }
  return out;
}
