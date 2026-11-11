import type { ServerMsg } from '../protocol';
import type { Drawing, SessionState } from '../../core/session';
import { INK, SKETCH_SIZE, buildStrokes, placeholderGray, strokeColors, strokesAt, toGray, type Stroke } from '../../core/sketch';
import { initials } from '../../core/text';
import { liveProgress, noticeVisible, stageCaption, upNext } from './stage-model';

const W = 540;
const H = 960;
const PAPER = '#f4efe6';
const ACCENT = '#d97706';
const DARK = '#3b3a36';
const CX = 270;
const CY = 420;
const DIAM = 380;
const R = DIAM / 2;
const NOTICE = 'Tạm ngưng nhận quà — hàng chờ đang dài, cảm ơn mọi người!';

const canvas = document.getElementById('stage') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

type Art = { id: string; strokes: Stroke[]; colors: string[]; placeholder: string | null };

let state: SessionState | null = null;
let receivedAt = 0;
let art: Art | null = null;
let loadingId: string | null = null;

// ---------- WebSocket ----------

function connect(): void {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.addEventListener('message', ev => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMsg;
    } catch {
      return;
    }
    if (msg.type === 'state') onState(msg.state);
  });
  ws.addEventListener('close', () => setTimeout(connect, 2000));
}

function onState(s: SessionState): void {
  state = s;
  receivedAt = performance.now();
  const d = s.drawing;
  if (!d) {
    art = null;
    loadingId = null;
    return;
  }
  if (d.ready && art?.id !== d.entry.id && loadingId !== d.entry.id) prepare(d);
}

// ---------- Ảnh → nét ----------

function prepare(d: Drawing): void {
  const id = d.entry.id;
  loadingId = id;
  const img = new Image();
  img.decoding = 'async';
  const finish = (result: Art) => {
    // Kết quả về trễ cho bức cũ thì bỏ.
    if (loadingId !== id || state?.drawing?.entry.id !== id) return;
    art = result;
    loadingId = null;
  };
  img.onload = () => {
    try {
      const off = document.createElement('canvas');
      off.width = SKETCH_SIZE;
      off.height = SKETCH_SIZE;
      const octx = off.getContext('2d', { willReadFrequently: true })!;
      octx.drawImage(img, 0, 0, SKETCH_SIZE, SKETCH_SIZE);
      const rgba = octx.getImageData(0, 0, SKETCH_SIZE, SKETCH_SIZE).data;
      const strokes = buildStrokes(toGray(rgba));
      finish({ id, strokes, colors: d.color ? strokeColors(rgba, strokes) : strokes.map(() => INK), placeholder: null });
    } catch {
      finish(fallback(d));
    }
  };
  img.onerror = () => finish(fallback(d));
  img.src = `/api/avatar/${encodeURIComponent(id)}`;
}

function fallback(d: Drawing): Art {
  const strokes = buildStrokes(placeholderGray(d.entry.user.userId));
  return { id: d.entry.id, strokes, colors: strokeColors(null, strokes), placeholder: initials(d.entry.user) };
}

// ---------- Vẽ ----------

const toX = (u: number) => CX - R + u * DIAM;
const toY = (v: number) => CY - R + v * DIAM;

function ring(radius: number, color: string, width: number): void {
  ctx.beginPath();
  ctx.arc(CX, CY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawFrame(d: Drawing | null, color: boolean): void {
  ring(R + 6, DARK, 2);
  ring(R + 14, DARK, 2);
  if (d && color) ring(R + 24, ACCENT, 4);
}

function drawArt(a: Art, t: number): [number, number] | null {
  ctx.save();
  ctx.beginPath();
  ctx.arc(CX, CY, R, 0, Math.PI * 2);
  ctx.clip();

  if (a.placeholder) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = DARK;
    ctx.font = '700 120px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.placeholder, CX, CY);
    ctx.globalAlpha = 1;
  }

  const { done, pen } = strokesAt(a.strokes, t);
  ctx.lineWidth = 1.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (let i = 0; i < done.length; i++) {
    const s = done[i];
    if (s.length < 2) continue;
    ctx.strokeStyle = a.colors[i] ?? INK;
    ctx.beginPath();
    ctx.moveTo(toX(s[0][0]), toY(s[0][1]));
    for (let k = 1; k < s.length; k++) ctx.lineTo(toX(s[k][0]), toY(s[k][1]));
    ctx.stroke();
  }
  ctx.restore();
  return pen ? [toX(pen[0]), toY(pen[1])] : null;
}

function drawPen(p: [number, number]): void {
  const [x, y] = p;
  // Thanh ray ngang chạy theo y của bút.
  ctx.fillStyle = DARK;
  ctx.fillRect(CX - R - 40, y - 7, DIAM + 80, 14);
  ctx.fillStyle = '#5b5953';
  ctx.fillRect(CX - R - 52, y - 11, 12, 22);
  ctx.fillRect(CX + R + 40, y - 11, 12, 22);
  // Đầu bút.
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x - 13, y - 13, 26, 26);
  ctx.fillStyle = '#fff7ea';
  ctx.fillRect(x - 3, y - 3, 6, 6);
}

function drawUpNext(s: SessionState): void {
  const list = upNext(s);
  const x = 24;
  let y = 36;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ACCENT;
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillText('TIẾP THEO', x, y);
  ctx.fillRect(x, y + 6, 40, 3);
  y += 34;
  ctx.font = '500 18px system-ui, sans-serif';
  if (list.length === 0) {
    ctx.fillStyle = '#8a857a';
    ctx.fillText('Chưa có ai', x, y);
    y += 26;
  }
  for (const it of list) {
    ctx.fillStyle = DARK;
    ctx.fillText(`${it.rank}. ${it.name}`, x, y, 190);
    if (it.coins > 0) {
      ctx.fillStyle = '#8a857a';
      ctx.fillText(`${it.coins} xu`, x + 196, y);
    }
    y += 26;
  }
  if (noticeVisible(s)) drawNotice(x, y + 8);
}

function wrap(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? line + ' ' + w : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawNotice(x: number, y: number): void {
  ctx.font = '600 16px system-ui, sans-serif';
  const lines = wrap(NOTICE, 240);
  const h = lines.length * 22 + 20;
  ctx.fillStyle = '#fff7ea';
  ctx.fillRect(x, y, 264, h);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, 264, h);
  ctx.setLineDash([]);
  ctx.fillStyle = '#7c4a03';
  lines.forEach((l, i) => ctx.fillText(l, x + 12, y + 26 + i * 22));
}

function drawCaption(s: SessionState | null): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = DARK;
  ctx.font = '600 28px system-ui, sans-serif';
  ctx.fillText(s ? stageCaption(s) : 'Đang kết nối…', CX, 660, W - 60);
  if (s?.drawing?.color && s.drawing.ready) {
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillStyle = ACCENT;
    ctx.fillText('MÀU', CX, 690);
  }
}

function frame(): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  const s = state;
  const d = s?.drawing ?? null;
  drawFrame(d, !!d?.color);

  if (s && d && art && art.id === d.entry.id) {
    const t = liveProgress(d, receivedAt, performance.now(), s.settings.drawSeconds);
    const pen = drawArt(art, t);
    if (pen) drawPen(pen);
  }

  drawCaption(s);
  if (s) drawUpNext(s);
  requestAnimationFrame(frame);
}

connect();
requestAnimationFrame(frame);
