import type { ClientMsg, ServerMsg } from '../protocol';
import type { Command, SessionState } from '../../core/session';
import type { ConnState } from '../../core/events';
import { DEFAULT_SETTINGS, type Settings } from '../../core/settings';
import { TEST_GIFTS } from '../../sources/simulator';
import { displayName } from '../../core/text';
import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  boardRows,
  boardTitle,
  drainBanner,
  errorLine,
  feedLine,
  fromFormValue,
  keyToCommand,
  queueRow,
  statTiles,
  toFormValue,
  type SettingField,
} from './control-model';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const CONN_TEXT: Record<ConnState, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối…',
  connected: 'Đã kết nối',
  disconnected: 'Đã ngắt',
  ended: 'Live đã kết thúc',
  error: 'Lỗi kết nối',
};

let ws: WebSocket | null = null;
let state: SessionState | null = null;

// ---------- WebSocket ----------

function connect(): void {
  const sock = new WebSocket(`ws://${location.host}/ws`);
  ws = sock;
  sock.addEventListener('open', () => {
    $('offline').hidden = true;
  });
  sock.addEventListener('message', ev => {
    let msg: ServerMsg;
    try {
      msg = JSON.parse(String(ev.data)) as ServerMsg;
    } catch {
      return;
    }
    if (msg.type === 'state') {
      state = msg.state;
      render(msg.state);
    }
  });
  sock.addEventListener('close', () => {
    if (ws === sock) ws = null;
    $('offline').hidden = false;
    setTimeout(connect, 2000);
  });
}

function send(msg: ClientMsg): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function command(c: Command): void {
  send({ type: 'command', command: c });
}

// ---------- Helpers DOM ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function isTyping(): boolean {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  if (tag === 'INPUT') return (a as HTMLInputElement).type !== 'checkbox';
  return tag === 'TEXTAREA' || tag === 'SELECT' || (a as HTMLElement).isContentEditable;
}

// ---------- Render ----------

function render(s: SessionState): void {
  renderConn(s);
  renderToggles(s);
  renderStats(s);
  renderBanner(s);
  renderBoards(s);
  renderErrors(s);
  renderFeed(s);
  renderNow(s);
  renderQueue(s);
  renderSettings(s.settings);
}

function renderConn(s: SessionState): void {
  const st = $('conn-status');
  st.textContent = CONN_TEXT[s.conn];
  st.dataset.state = s.conn;
  $('room-id').textContent = s.roomId ? `room ${s.roomId}` : '';
  const busy = s.conn === 'connecting' || s.conn === 'connected';
  $<HTMLButtonElement>('btn-rehearsal').disabled = busy;
  $<HTMLButtonElement>('btn-live').disabled = busy;
  $<HTMLButtonElement>('btn-disconnect').disabled = !busy;
}

function renderToggles(s: SessionState): void {
  $<HTMLInputElement>('tg-gifts').checked = s.settings.acceptingGifts;
  $<HTMLInputElement>('tg-free').checked = s.settings.allowFreeRequests;
}

function renderStats(s: SessionState): void {
  const box = $('tiles');
  const tiles = statTiles(s);
  if (box.children.length !== tiles.length) {
    box.replaceChildren(
      ...tiles.map(() => {
        const t = el('div', 'tile');
        t.append(el('div', 'tile-value'), el('div', 'tile-label'));
        return t;
      }),
    );
  }
  tiles.forEach((t, i) => {
    const node = box.children[i];
    node.children[0].textContent = t.value;
    node.children[1].textContent = t.label;
  });

  $('free-line').textContent = `Xin miễn phí: nhận ${s.freeAccepted} · từ chối ${s.declined}`;
}

function renderBanner(s: SessionState): void {
  const text = drainBanner(s);
  const b = $('drain-banner');
  b.hidden = text === null;
  b.textContent = text ?? '';
}

let lastBoardSig: string | null = null;

function renderBoards(s: SessionState): void {
  const box = $('boards');
  const sig = JSON.stringify(s.boards);
  if (sig === lastBoardSig) return;
  const prevCount = box.children.length;
  lastBoardSig = sig;
  if (s.boards.length === 0) {
    box.replaceChildren(el('div', 'muted', 'Chưa có quà'));
    return;
  }
  const keep = box.scrollTop;
  box.replaceChildren(
    ...s.boards.map(b => {
      const sec = el('section', 'board' + (b.locked ? ' locked' : ' open'));
      sec.append(el('h3', 'board-title', boardTitle(b)));
      const rows = boardRows(b);
      if (rows.length === 0) sec.append(el('div', 'muted', 'Chưa có quà'));
      else {
        const ol = el('ol', 'board-rows');
        for (const r of rows) ol.append(el('li', undefined, r));
        sec.append(ol);
      }
      return sec;
    }),
  );
  if (s.boards.length !== prevCount) {
    const last = box.lastElementChild as HTMLElement | null;
    if (last) box.scrollTop = last.offsetTop - box.offsetTop;
  } else box.scrollTop = keep;
}

let lastErrorSig: string | null = null;

function renderErrors(s: SessionState): void {
  $('errors-title').textContent = s.errors.length ? `LỖI (${s.errors.length})` : 'Lỗi';
  const sig = s.errors.map(e => e.id).join(',');
  if (sig === lastErrorSig) return;
  lastErrorSig = sig;
  const box = $('errors');
  if (s.errors.length === 0) {
    box.replaceChildren(el('li', 'muted', 'Chưa có lỗi'));
    return;
  }
  box.replaceChildren(...[...s.errors].reverse().map(e => el('li', 'error-item' + (e.fatal ? ' fatal' : ''), errorLine(e))));
}

let lastFeedId = 0;

function renderFeed(s: SessionState): void {
  const box = $('feed');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 24;
  const newest = s.feed.length ? s.feed[s.feed.length - 1].id : 0;
  if (newest === lastFeedId && box.children.length === s.feed.length) return;
  lastFeedId = newest;
  box.replaceChildren(
    ...s.feed.map(f => {
      const li = el('li', 'feed-item kind-' + f.kind, feedLine(f));
      return li;
    }),
  );
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

function renderNow(s: SessionState): void {
  const d = s.drawing;
  const pause = $<HTMLButtonElement>('btn-pause');
  $<HTMLButtonElement>('btn-skip').disabled = !d;
  pause.disabled = !d;
  $<HTMLButtonElement>('btn-redo').disabled = !s.lastDrawn;
  if (!d) {
    $('now-name').textContent = '—';
    $('now-label').textContent = 'Chưa có bức nào đang vẽ';
    $('now-badge').hidden = true;
    $('now-bar').style.width = '0%';
    pause.textContent = 'Tạm dừng (P)';
    return;
  }
  $('now-name').textContent = `${displayName(d.entry.user)} @${d.entry.user.handle}`;
  const extra = !d.ready ? ' · đang tải ảnh…' : d.paused ? ' · đã tạm dừng' : '';
  $('now-label').textContent = queueRow(d.entry) + extra;
  $('now-badge').hidden = !d.color;
  $('now-bar').style.width = `${Math.round(d.progress * 100)}%`;
  pause.textContent = d.paused ? 'Tiếp tục (P)' : 'Tạm dừng (P)';
}

let lastQueueSig: string | null = null;

function renderQueue(s: SessionState): void {
  // Chỉ dựng lại khi hàng chờ đổi, để không mất cú bấm ↑ / × giữa hai lần nhận state.
  const sig = s.queue.map(e => e.id + '|' + queueRow(e)).join('\n');
  if (sig === lastQueueSig) return;
  lastQueueSig = sig;
  $('queue-count').textContent = `(${s.queue.length})`;
  const box = $('queue');
  if (s.queue.length === 0) {
    box.replaceChildren(el('li', 'queue-empty muted', 'Hàng chờ trống'));
    return;
  }
  box.replaceChildren(
    ...s.queue.map((e, i) => {
      const li = el('li', 'queue-item');
      li.append(el('span', 'q-rank', String(i + 1)), el('span', 'q-text', queueRow(e)));
      const up = el('button', 'icon', '↑');
      up.title = 'Đưa lên đầu';
      up.disabled = i === 0;
      up.addEventListener('click', () => command({ type: 'moveToFront', id: e.id }));
      const rm = el('button', 'icon danger', '×');
      rm.title = 'Xoá khỏi hàng';
      rm.addEventListener('click', () => command({ type: 'remove', id: e.id }));
      li.append(up, rm);
      return li;
    }),
  );
}

// ---------- Cài đặt ----------

const settingInputs = new Map<keyof Settings, HTMLInputElement>();
/** Ô đang gõ dở (chưa 'change') thì không ghi đè. */
const dirtyInputs = new Set<HTMLInputElement>();

function buildSettings(): void {
  const host = $('settings-groups');
  const byKey = new Map(SETTING_FIELDS.map(f => [f.key, f] as const));
  for (const g of SETTING_GROUPS) {
    const fs = el('fieldset', 'group');
    fs.append(el('legend', undefined, g.title));
    for (const key of g.keys) {
      const f = byKey.get(key);
      if (f) fs.append(settingRow(f));
    }
    host.append(fs);
  }
}

function settingRow(f: SettingField): HTMLElement {
  const row = el('label', 'set-row' + (f.kind === 'boolean' ? ' is-bool' : ''));
  const input = el('input', f.kind === 'boolean' ? '' : 'field');
  if (f.kind === 'boolean') input.type = 'checkbox';
  else if (f.kind === 'text') input.type = 'text';
  else {
    input.type = 'number';
    input.step = 'any';
    input.min = '0';
  }
  input.addEventListener('input', () => dirtyInputs.add(input));
  input.addEventListener('change', () => {
    dirtyInputs.delete(input);
    const raw = f.kind === 'boolean' ? input.checked : input.value;
    const patch = fromFormValue(f.key, raw);
    if (Object.keys(patch).length > 0) command({ type: 'setSettings', patch });
    // Không hợp lệ → hiện lại ngay giá trị hiện có; hợp lệ → state kế tiếp (có thể đã bị kẹp) ghi đè.
    else if (state) syncInput(f.key, input, state.settings);
  });
  settingInputs.set(f.key, input);
  row.append(el('span', 'set-label', f.label), input);
  return row;
}

function syncInput(key: keyof Settings, input: HTMLInputElement, s: Settings): void {
  const v = toFormValue(key, s);
  if (typeof v === 'boolean') input.checked = v;
  else input.value = v;
}

function renderSettings(s: Settings): void {
  for (const [key, input] of settingInputs) {
    if (dirtyInputs.has(input)) continue;
    syncInput(key, input, s);
  }
}

// ---------- Sự kiện giao diện ----------

function wire(): void {
  $('btn-rehearsal').addEventListener('click', () => send({ type: 'connect', mode: 'rehearsal' }));
  $('btn-live').addEventListener('click', () => {
    const target = $<HTMLInputElement>('target').value.trim();
    send({ type: 'connect', mode: 'live', target });
  });
  $('btn-disconnect').addEventListener('click', () => send({ type: 'disconnect' }));

  $<HTMLInputElement>('tg-gifts').addEventListener('change', ev =>
    command({ type: 'setSettings', patch: { acceptingGifts: (ev.target as HTMLInputElement).checked } }),
  );
  $<HTMLInputElement>('tg-free').addEventListener('change', ev =>
    command({ type: 'setSettings', patch: { allowFreeRequests: (ev.target as HTMLInputElement).checked } }),
  );

  const dlg = $<HTMLDialogElement>('settings');
  $('btn-close-settings').addEventListener('click', () => dlg.close());
  $('btn-settings').addEventListener('click', () => {
    if (state) renderSettings(state.settings);
    dlg.showModal();
  });
  $('btn-defaults').addEventListener('click', () => command({ type: 'setSettings', patch: { ...DEFAULT_SETTINGS } }));

  $('btn-pause').addEventListener('click', () => {
    if (state?.drawing) command({ type: state.drawing.paused ? 'resume' : 'pause' });
  });
  $('btn-skip').addEventListener('click', () => { if (state?.drawing) command({ type: 'skip', id: state.drawing.entry.id }); });
  $('btn-redo').addEventListener('click', () => command({ type: 'redoLast' }));

  $('btn-manual').addEventListener('click', () => {
    const handle = prompt('Tên tài khoản TikTok cần vẽ (không cần @):');
    if (handle && handle.trim()) command({ type: 'addManual', handle: handle.trim() });
  });
  $('btn-clear').addEventListener('click', () => {
    const n = state?.queue.length ?? 0;
    if (n === 0) return;
    if (confirm(`Xoá hết ${n} lượt trong hàng chờ?`)) command({ type: 'clearQueue' });
  });

  const giftSel = $<HTMLSelectElement>('test-gift');
  for (const g of TEST_GIFTS) {
    const o = el('option', undefined, `${g.name} (${g.coins} xu)`);
    o.value = g.name;
    giftSel.append(o);
  }
  const testUser = () => $<HTMLInputElement>('test-user').value.trim().replace(/^@+/, '') || 'mai_test';
  $('btn-test-gift').addEventListener('click', () => {
    const count = Math.max(1, Math.floor(Number($<HTMLInputElement>('test-count').value) || 1));
    send({ type: 'test', kind: 'gift', handle: testUser(), arg: giftSel.value, count });
  });
  $('btn-test-comment').addEventListener('click', () => {
    const input = $<HTMLInputElement>('test-comment');
    if (!input.value) return;
    send({ type: 'test', kind: 'comment', handle: testUser(), arg: input.value, count: 1 });
  });
  $('btn-test-likes').addEventListener('click', () => send({ type: 'test', kind: 'likes', handle: testUser(), arg: '', count: 10 }));

  document.addEventListener('keydown', ev => {
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || isTyping() || !state) return;
    const c = keyToCommand(ev.key, state);
    if (c) {
      ev.preventDefault();
      command(c);
    }
  });
}

buildSettings();
wire();
connect();
