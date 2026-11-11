# SketchQueue LIVE (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ứng dụng chạy trên localhost cho chủ phòng TikTok LIVE: người xem tặng quà hoặc xin vẽ → vào hàng chờ ưu tiên theo giá trị quà → "máy vẽ ảo" trên trang sân khấu vẽ dần chân dung từ ảnh đại diện của họ, kèm bảng điều khiển, số liệu và trang cài đặt.

**Architecture:** Lõi thuần TypeScript (`src/core`) gồm cài đặt, hàng chờ ưu tiên, luật nhận, số liệu, sinh nét vẽ và bộ điều phối `Session` — không phụ thuộc mạng hay DOM, kiểm thử bằng vitest. Nguồn sự kiện nằm sau giao diện `LiveSource` với hai cài đặt: bộ giả lập (làm trước) và bộ nối TikTok (làm gần cuối). Một máy chủ Node chỉ nghe trên `127.0.0.1` giữ `Session`, phục vụ hai trang tĩnh (`/` điều khiển, `/stage` sân khấu) và đẩy `SessionState` qua WebSocket; trình duyệt chỉ hiển thị và gửi lệnh.

**Tech Stack:** Node ≥ 20, TypeScript (strict), `ws`, `tsx`, Vite (đóng gói hai trang), vitest, Canvas 2D, `tiktok-live-connector`.

**Spec:** `docs/superpowers/specs/2026-11-11-sketchqueue-live-spec.md` (đọc mục 3 và 5 trước khi làm bất kỳ task nào).

**Phân vai (chủ dự án quyết định):** Task 1–10 do **Opus 5.5, effort medium** thực thi. Task 11 (README) do **Haiku 5.5** viết. **Fable chỉ làm cố vấn**, không viết mã. Chủ dự án tự chuyển model; sau mỗi lần chuyển, model ở yên đó và làm hết phần của mình, xong thì dừng và chờ chủ dự án xác nhận trước lần chuyển kế tiếp.

**Giữ quỹ quota (chủ dự án yêu cầu):** sau khi commit xong mỗi task, kiểm tra mức dùng gói (công cụ `get_usage`). Nếu bất kỳ giới hạn nào (5 giờ, tuần, tuần theo model) đã dùng từ 85 % trở lên, hoặc task kế tiếp có khả năng đẩy vượt 85 %, thì **dừng ngay**, không bắt đầu task kế, và báo chủ dự án: task nào đã xong, mức dùng hiện tại, thời điểm giới hạn đặt lại. Luôn để lại ít nhất 15 % cho chủ dự án.

## Global Constraints

- Thư mục gốc dự án: `E:\REA\sketchqueue-live\`. Mọi đường dẫn dưới đây tính từ đó. Không sửa gì trong `E:\REA\reverse-engineer-anything\`.
- `src/core/**` không được `import` từ `node:*`, `ws`, hay `tiktok-live-connector`, và không chạm `window`/`document`.
- Mọi giá trị mặc định lấy đúng từ spec mục 5.3: `minCoins 1`, `combineWindowMs 60000`, `maxQueue 50`, `freeKeyword '!ve'`, `freeIdleMs 120000`, `freeChance 0.1`, `freeQueueLimit 3`, `colorMinCoins 99`, `drawSeconds 45`, `stageDelayMs 3000`, chờ ảnh 8 s, tên tối đa 14 grapheme + `…`.
- Máy chủ chỉ bind `127.0.0.1`, cổng mặc định `4780`. Từ chối mọi yêu cầu HTTP và WebSocket có header `Host` khác `127.0.0.1:<cổng>` / `localhost:<cổng>`, và mọi WebSocket có header `Origin` khác hai gốc đó. WebSocket **không có** header `Origin` (client không phải trình duyệt, ví dụ test) được chấp nhận nếu `Host` đúng.
- Tên sản phẩm là "SketchQueue LIVE". Không dùng tên, preset, hay tài khoản xuất hiện trong ảnh chụp ứng dụng gốc. Dữ liệu mẫu dùng người dùng bịa: `@mai_test`, `@bao_test`, `@linh_test`.
- Chữ trên giao diện bằng tiếng Việt; định danh trong mã bằng tiếng Anh.
- Thời gian và số ngẫu nhiên luôn được truyền vào lõi (`now: number` mili giây, `random: () => number`); lõi không gọi `Date.now()` hay `Math.random()`.
- Ứng dụng chỉ đọc sự kiện phòng live: không đăng nhập, không `sessionId`, không gửi tin nhắn.
- Nội dung do người xem nhập luôn gán bằng `textContent`, không dùng `innerHTML`.
- Mỗi commit kết thúc bằng dòng `Co-Authored-By:` của model thực hiện commit đó.

## Review Focus

Năm tình huống spec có hàm ý nhưng dễ bị bỏ sót; mỗi dòng đã có test ở task ghi trong ngoặc.

1. Ảnh đại diện không tải được hoặc `avatarUrl` là `null` → vẫn vẽ ảnh thay thế, hàng chờ không kẹt (Task 5, Task 6, Task 8).
2. Một người tặng liên tục không nghỉ → lượt của họ không bao giờ đủ trễ; các lượt khác vẫn phải được vẽ, không ai bị chặn (Task 2, Task 6).
3. Bỏ qua hoặc xoá hết đúng lúc đang vẽ, kể cả khi đang tạm dừng → không cộng "đã vẽ", không mất bức đang vẽ khi xoá hết (Task 6).
4. `settings.json` hỏng, thiếu trường, hoặc có giá trị vô lý (số âm, chuỗi thay cho số, `drawSeconds: 0`) → dùng mặc định cho trường sai, ứng dụng vẫn mở (Task 1, Task 8).
5. Đầu vào kết nối là link rút gọn, link trang khác, hoặc tên có ký tự lạ; tên hiển thị dài, có emoji ghép hoặc rỗng → báo lỗi rõ ràng, không gọi mạng; cắt tên theo grapheme (Task 5, Task 10).

## File Structure

```
package.json, tsconfig.json, vite.config.ts, vitest.config.ts, .gitignore
src/core/events.ts          kiểu LiveUser, LiveEvent, LiveSource
src/core/settings.ts        Settings, DEFAULT_SETTINGS, sanitizeSettings()
src/core/queue.ts           DrawQueue — ưu tiên theo xu, gộp theo cửa sổ thời gian, độ trễ sân khấu
src/core/rules.ts           decide() — luật nhận yêu cầu
src/core/stats.ts           reduceStats()
src/core/text.ts            displayName(), initials()
src/core/sketch.ts          toGray(), buildStrokes(), strokeColors(), strokesAt(), placeholderGray()
src/core/session.ts         Session — điều phối tất cả
src/sources/simulator.ts    SimulatorSource
src/sources/tiktok.ts       parseTikTokTarget(), createTikTokSource()
src/server/avatar.ts        fetchAvatar()
src/server/settings-store.ts loadSettings(), saveSettings()
src/server/app.ts           createApp() — HTTP + WebSocket
src/server/main.ts          điểm khởi động
src/client/protocol.ts      kiểu thông điệp WebSocket dùng chung
src/client/stage/{index.html,stage-model.ts,stage.ts,stage.css}
src/client/control/{index.html,control-model.ts,control.ts,control.css}
tests/**                    một file test cho mỗi module ở trên (trừ stage.ts, control.ts, main.ts)
README.md
```

---

### Task 1: Khung dự án, kiểu sự kiện, `Settings`

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `src/core/events.ts`, `src/core/settings.ts`
- Test: `tests/core/settings.test.ts`

**Interfaces:**
- Produces (`src/core/events.ts`):

```ts
export type LiveUser = { userId: string; handle: string; nickname: string; avatarUrl: string | null };
export type ConnState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'ended' | 'error';
export type LiveEvent =
  | { type: 'comment'; user: LiveUser; text: string; at: number }
  | { type: 'gift'; user: LiveUser; giftName: string; coins: number; count: number; at: number } // coins = tổng xu của cả chuỗi
  | { type: 'like'; user: LiveUser; count: number; at: number }
  | { type: 'join'; user: LiveUser; at: number }
  | { type: 'follow'; user: LiveUser; at: number }
  | { type: 'viewers'; count: number; at: number }
  | { type: 'status'; state: ConnState; roomId?: string; message?: string; at: number };
export interface LiveSource {
  start(): Promise<void>;
  stop(): Promise<void>;                                  // gọi nhiều lần không lỗi
  onEvent(cb: (e: LiveEvent) => void): () => void;        // trả về hàm huỷ đăng ký
}
```

- Produces (`src/core/settings.ts`):

```ts
export type Settings = {
  minCoins: number;           // nguyên, ≥ 1
  combineWindowMs: number;    // 0..600_000
  maxQueue: number;           // nguyên, 1..500
  acceptingGifts: boolean;
  allowFreeRequests: boolean;
  freeKeyword: string;        // đã trim, 1..20 ký tự, không chứa khoảng trắng
  freeIdleMs: number;         // 0..3_600_000
  freeChance: number;         // 0..1
  freeQueueLimit: number;     // nguyên, 0..50
  colorMinCoins: number;      // nguyên, ≥ 1
  drawSeconds: number;        // 5..600
  stageDelayMs: number;       // 0..60_000
};
export const DEFAULT_SETTINGS: Settings;                        // giá trị ở Global Constraints; hai boolean là true
export function sanitizeSettings(input: unknown, base?: Settings): Settings;
// Với mỗi trường: nếu input có giá trị đúng kiểu và hữu hạn thì kẹp vào khoảng cho phép (làm tròn xuống với trường nguyên);
// sai kiểu, NaN, thiếu → lấy từ base (mặc định DEFAULT_SETTINGS). Trường lạ bị bỏ. input không phải object → base.
```

- [ ] **Step 1: Dựng khung.** Tạo thư mục, `git init`, `npm init -y`, đặt `"type": "module"`. Cài devDependencies `typescript vitest tsx vite @types/node @types/ws` và dependency `ws`, tất cả `--save-exact`. `tsconfig.json`: `strict`, `target ES2022`, `module ESNext`, `moduleResolution bundler`, `lib ["ES2022","DOM"]`. Script: `"test": "vitest run"`, `"typecheck": "tsc --noEmit"`. `.gitignore`: `node_modules`, `dist`, `settings.json`.

- [ ] **Step 2: Viết `src/core/events.ts`** đúng như khối Interfaces.

- [ ] **Step 3: Viết test thất bại:**

```ts
expect(sanitizeSettings({})).toEqual(DEFAULT_SETTINGS);
expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
expect(sanitizeSettings('x')).toEqual(DEFAULT_SETTINGS);
expect(DEFAULT_SETTINGS).toMatchObject({ minCoins: 1, combineWindowMs: 60000, maxQueue: 50, freeKeyword: '!ve', freeIdleMs: 120000, freeChance: 0.1, freeQueueLimit: 3, colorMinCoins: 99, drawSeconds: 45, stageDelayMs: 3000, acceptingGifts: true, allowFreeRequests: true });
expect(sanitizeSettings({ drawSeconds: 0 }).drawSeconds).toBe(5);
expect(sanitizeSettings({ drawSeconds: 9999 }).drawSeconds).toBe(600);
expect(sanitizeSettings({ minCoins: -3 }).minCoins).toBe(1);
expect(sanitizeSettings({ minCoins: 2.9 }).minCoins).toBe(2);
expect(sanitizeSettings({ freeChance: 5 }).freeChance).toBe(1);
expect(sanitizeSettings({ freeChance: '0.5' }).freeChance).toBe(0.1);
expect(sanitizeSettings({ combineWindowMs: NaN }).combineWindowMs).toBe(60000);
expect(sanitizeSettings({ freeKeyword: '  ' }).freeKeyword).toBe('!ve');
expect(sanitizeSettings({ freeKeyword: ' !Draw ' }).freeKeyword).toBe('!Draw');
expect(sanitizeSettings({ freeKeyword: 'a b' }).freeKeyword).toBe('!ve');
expect(sanitizeSettings({ acceptingGifts: 'no' }).acceptingGifts).toBe(true);
expect(sanitizeSettings({ hack: 1 })).not.toHaveProperty('hack');
expect(sanitizeSettings({ drawSeconds: 20 }, { ...DEFAULT_SETTINGS, minCoins: 7 })).toMatchObject({ drawSeconds: 20, minCoins: 7 });
```

- [ ] **Step 4: Chạy** `npm test -- settings` → FAIL (`sanitizeSettings` chưa có).
- [ ] **Step 5: Cài đặt `settings.ts`.**
- [ ] **Step 6: Chạy** `npm test -- settings && npm run typecheck` → PASS.
- [ ] **Step 7: Commit** `feat: scaffold project, live event types, settings` (kèm cả thư mục `docs/`).

---

### Task 2: Hàng chờ ưu tiên `DrawQueue`

**Files:**
- Create: `src/core/queue.ts`
- Test: `tests/core/queue.test.ts`

**Interfaces:**
- Consumes: `LiveUser`.
- Produces:

```ts
export type QueueReason = 'gift' | 'free' | 'manual';
export type QueueEntry = {
  id: string; user: LiveUser; reason: QueueReason;
  coins: number;         // tổng xu đã gộp
  gifts: number;         // số lần tặng đã gộp (0 với free/manual)
  label: string;
  enqueuedAt: number;
  lastGiftAt: number;    // với free/manual bằng enqueuedAt
  pinSeq: number;        // 0 = không ghim; lớn hơn = ghim sau, xếp trước
};
export type NewEntry = { user: LiveUser; reason: QueueReason; coins: number; label: string };
export type AddResult = { result: 'added' | 'merged'; entry: QueueEntry } | { result: 'full' | 'duplicate' };
export class DrawQueue {
  constructor();
  add(e: NewEntry, now: number, opts: { combineWindowMs: number; max: number }): AddResult;
  takeEligible(now: number, stageDelayMs: number): QueueEntry | null;  // lấy và bỏ lượt đầu tiên theo thứ tự có now − lastGiftAt ≥ stageDelayMs
  pushFront(e: QueueEntry, now: number): QueueEntry;                   // đưa lại một lượt cũ lên đầu với id mới, pinSeq mới (dùng cho "vẽ lại")
  remove(id: string): boolean;
  moveToFront(id: string): boolean;   // gán pinSeq mới lớn nhất
  clear(): void;
  list(): readonly QueueEntry[];      // đã sắp theo thứ tự vẽ
  get size(): number;
}
```

Thứ tự: `pinSeq` giảm dần (0 xếp sau mọi lượt ghim), rồi `coins` giảm dần, rồi `enqueuedAt` tăng dần, rồi thứ tự thêm vào.

Quy tắc `add`:
- `reason 'gift'`: xoá mọi lượt `free` đang chờ của cùng `userId`. Nếu có lượt `gift` đang chờ của cùng `userId` với `now − lastGiftAt ≤ combineWindowMs` → `'merged'`: cộng `coins`, `gifts += 1`, `lastGiftAt = now`, `label` lấy của lần mới; giữ `enqueuedAt`, `id`, `pinSeq`. Nếu có nhiều lượt như vậy, gộp vào lượt có `lastGiftAt` lớn nhất. Không thì thêm lượt mới với `gifts 1`.
- `reason 'free'` hoặc `'manual'`: nếu cùng `userId` đã có lượt đang chờ (bất kỳ loại nào) → `'duplicate'`, không đổi gì.
- Thêm lượt mới khi `size ≥ max` → `'full'`. Gộp không bị giới hạn bởi `max`.

- [ ] **Step 1: Viết test thất bại.** Trợ giúp: `u(id)` trả `LiveUser`; `g(id, coins)` trả `NewEntry` loại `gift`; `O = { combineWindowMs: 60000, max: 50 }`.

```ts
test('xu cao vẽ trước, bằng xu thì vào trước vẽ trước', () => { q.add(g('a', 1), 0, O); q.add(g('b', 5), 1, O); q.add(g('c', 1), 2, O); expect(ids()).toEqual(['b', 'a', 'c']); });
test('gộp trong cửa sổ', () => { q.add(g('a', 1), 0, O); const r = q.add(g('a', 2), 30_000, O); expect(r.result).toBe('merged'); expect(q.size).toBe(1); expect(q.list()[0]).toMatchObject({ coins: 3, gifts: 2, lastGiftAt: 30_000, enqueuedAt: 0 }); });
test('cửa sổ tính từ quà gần nhất, không phải quà đầu', () => { q.add(g('a', 1), 0, O); q.add(g('a', 1), 50_000, O); expect(q.add(g('a', 1), 100_000, O).result).toBe('merged'); });
test('đúng biên 60 000 ms vẫn gộp, 60 001 thì không', () => { q.add(g('a', 1), 0, O); expect(q.add(g('a', 1), 60_000, O).result).toBe('merged'); expect(q.add(g('a', 1), 120_001, O).result).toBe('added'); expect(q.size).toBe(2); });
test('combineWindowMs 0 chỉ gộp quà cùng mili giây', () => { const Z = { ...O, combineWindowMs: 0 }; q.add(g('a', 1), 5, Z); expect(q.add(g('a', 1), 6, Z).result).toBe('added'); });
test('gộp làm đổi thứ tự', () => { q.add(g('a', 1), 0, O); q.add(g('b', 5), 0, O); q.add(g('a', 10), 1000, O); expect(ids()).toEqual(['a', 'b']); });
test('quà thay lượt miễn phí của cùng người', () => { q.add(free('a'), 0, O); const r = q.add(g('a', 1), 10, O); expect(r.result).toBe('added'); expect(q.size).toBe(1); expect(q.list()[0].reason).toBe('gift'); });
test('miễn phí/thủ công trùng người → duplicate', () => { q.add(g('a', 1), 0, O); expect(q.add(free('a'), 1, O).result).toBe('duplicate'); q.add(free('b'), 2, O); expect(q.add(manual('b'), 3, O).result).toBe('duplicate'); expect(q.size).toBe(2); });
test('đầy → full; gộp vẫn được khi đầy', () => { const M = { ...O, max: 1 }; q.add(g('a', 1), 0, M); expect(q.add(g('b', 9), 1, M).result).toBe('full'); expect(q.add(g('a', 2), 2, M).result).toBe('merged'); });
test('takeEligible tôn trọng độ trễ và không để ai bị chặn', () => {
  q.add(g('b', 1), 0, O); q.add(g('a', 5), 1000, O);
  expect(q.takeEligible(2000, 3000)).toBeNull();
  expect(q.takeEligible(3000, 3000)!.user.userId).toBe('b');     // a xếp trên nhưng chưa đủ trễ
  expect(q.takeEligible(3999, 3000)).toBeNull();
  expect(q.takeEligible(4000, 3000)!.user.userId).toBe('a');
  expect(q.size).toBe(0);
});
test('stageDelayMs 0 → lấy ngay lượt đầu', () => { q.add(g('a', 1), 7, O); expect(q.takeEligible(7, 0)!.user.userId).toBe('a'); });
test('ghim vượt xu; ghim sau xếp trước', () => { /* a 9 xu, b 1 xu, c 1 xu; moveToFront(b) rồi moveToFront(c) → [c, b, a] */ });
test('pushFront cho id mới và đứng đầu', () => { /* lấy a ra bằng takeEligible, thêm b 99 xu, pushFront(a) → [a, b], id của a khác id cũ */ });
test('remove id lạ → false; clear → size 0; takeEligible trên hàng rỗng → null', ...);
test('id là duy nhất', () => { /* 100 người → 100 id khác nhau */ });
```

- [ ] **Step 2: Chạy** `npm test -- queue` → FAIL.
- [ ] **Step 3: Cài đặt `DrawQueue`** bằng một mảng được sắp lại sau mỗi thay đổi; `id` dạng `q1`, `q2`…
- [ ] **Step 4: Chạy** `npm test -- queue && npm run typecheck` → PASS.
- [ ] **Step 5: Commit** `feat: priority draw queue with gift combining and stage delay`.

---

### Task 3: Luật nhận yêu cầu `decide()`

**Files:**
- Create: `src/core/rules.ts`
- Test: `tests/core/rules.test.ts`

**Interfaces:**
- Consumes: `LiveEvent`, `Settings`, `DEFAULT_SETTINGS`.
- Produces:

```ts
export type RulesContext = {
  queueSize: number;
  lastGiftAt: number | null;   // thời điểm quà hợp lệ gần nhất của bất kỳ ai trong buổi
  sessionStartAt: number;
  roll: number;                // số ngẫu nhiên 0 ≤ roll < 1 đã rút sẵn cho sự kiện này
};
export type Decision =
  | { action: 'enqueue'; reason: 'gift' | 'free'; coins: number; label: string; via?: 'idle' | 'chance' }
  | { action: 'owe' } | { action: 'decline' } | { action: 'ignore' };
export function decide(e: LiveEvent, s: Settings, ctx: RulesContext): Decision;
```

Quà: `coins < minCoins` → `ignore`; `acceptingGifts` tắt → `owe`; còn lại → `enqueue` với `label` `` `${giftName} ×${count}` ``.

Xin miễn phí: `text.trim()` so không phân biệt hoa thường, bằng đúng `freeKeyword` hoặc bắt đầu bằng `freeKeyword` + khoảng trắng; không khớp → `ignore`. Khớp: `allowFreeRequests` tắt → `decline`. `ctx.queueSize ≥ freeQueueLimit` → `decline` (cả hai điều kiện đều chỉ áp dụng khi hàng chờ còn ngắn, để lượt miễn phí không chiếm chỗ của quà). Điều kiện A: `e.at − (ctx.lastGiftAt ?? ctx.sessionStartAt) ≥ freeIdleMs` → `enqueue`, `via 'idle'`. Điều kiện B: `ctx.roll < freeChance` → `enqueue`, `via 'chance'`. Còn lại → `decline`. `label` là phần chữ sau từ khoá đã `trim()`, rỗng thì `'xin vẽ'`; `coins 0`.

- [ ] **Step 1: Viết test thất bại** — mỗi dòng một `test`. Mặc định `ctx = { queueSize: 0, lastGiftAt: null, sessionStartAt: 0, roll: 0.5 }`, sự kiện tại `at: 10_000` trừ khi ghi khác.

| Sự kiện | Settings / ctx khác mặc định | Kết quả |
|---|---|---|
| gift coins 1, `Rose` ×1 | — | `enqueue`, reason `gift`, coins 1, label `'Rose ×1'` |
| gift coins 0 | — | `ignore` |
| gift coins 5 | `minCoins: 10` | `ignore` |
| gift coins 5 | `acceptingGifts: false` | `owe` |
| comment `'!ve con meo cam'` at 120 000 | — (chưa có quà, mở từ 0) | `enqueue`, `via 'idle'`, coins 0, label `'con meo cam'` |
| comment `'!ve'` at 500 000 | queueSize 3 (chưa có quà) | `decline` (đủ thời gian chờ nhưng hàng chờ đã có 3 lượt) |
| comment `'!ve'` at 119 999 | roll 0.5 | `decline` |
| comment `'!ve'` at 200 000 | lastGiftAt 100 000 | `decline` (mới 100 s kể từ quà) |
| comment `'!ve'` at 220 000 | lastGiftAt 100 000 | `enqueue`, `via 'idle'` |
| comment `'!ve'` | roll 0.09, queueSize 2 | `enqueue`, `via 'chance'` |
| comment `'!ve'` | roll 0.1 | `decline` (phải nhỏ hơn hẳn `freeChance`) |
| comment `'!ve'` | roll 0.01, queueSize 3 | `decline` |
| comment `'!ve'` at 500 000 | `allowFreeRequests: false` | `decline` |
| comment `'!ve'` | `freeChance: 0`, roll 0 | `decline` |
| comment `'  !VE  '` at 120 000 | — | `enqueue`, label `'xin vẽ'` |
| comment `'!vexyz'` at 120 000 | — | `ignore` |
| comment `'!draw x'` at 120 000 | `freeKeyword: '!draw'` | `enqueue`, label `'x'` |
| comment `'chào'`, like, join, follow, viewers, status | — | `ignore` |

- [ ] **Step 2: Chạy** `npm test -- rules` → FAIL.
- [ ] **Step 3: Cài đặt `decide`.**
- [ ] **Step 4: Chạy** `npm test -- rules` → PASS.
- [ ] **Step 5: Commit** `feat: admission rules with idle and chance filters`.

---

### Task 4: Số liệu buổi live `reduceStats()`

**Files:**
- Create: `src/core/stats.ts`
- Test: `tests/core/stats.test.ts`

**Interfaces:**
- Consumes: `LiveEvent`, `LiveUser`.
- Produces:

```ts
export type TopGifter = { user: LiveUser; coins: number };
export type SessionStats = {
  viewers: number; coins: number; giftCount: number; gifters: number; newFollowers: number;
  likes: number; comments: number; topGifters: TopGifter[];   // tối đa 3, giảm dần theo coins
  coinsByUser: Record<string, TopGifter>;                      // khoá là userId
};
export const EMPTY_STATS: SessionStats;
export function reduceStats(s: SessionStats, e: LiveEvent): SessionStats;  // thuần, không sửa s
```

- [ ] **Step 1: Viết test thất bại:**

```ts
test('quà cộng xu, lượt quà, người tặng duy nhất', () => {
  const s = [gift('a', 5), gift('b', 1), gift('a', 2)].reduce(reduceStats, EMPTY_STATS);
  expect(s).toMatchObject({ coins: 8, giftCount: 3, gifters: 2 });
  expect(s.topGifters.map(t => [t.user.userId, t.coins])).toEqual([['a', 7], ['b', 1]]);
});
test('top chỉ giữ 3', () => { /* 4 người tặng 1,2,3,4 xu → top là 4,3,2 */ });
test('viewers ghi đè, like cộng dồn, follow và comment đếm', () => { /* viewers 150 rồi 140 → 140; like 10 + 5 → 15 */ });
test('status và join không đổi số liệu', () => { expect(reduceStats(EMPTY_STATS, join('a'))).toEqual(EMPTY_STATS); });
test('không sửa đối tượng đầu vào', () => { const f = Object.freeze({ ...EMPTY_STATS }); expect(() => reduceStats(f, gift('a', 1))).not.toThrow(); });
```

- [ ] **Step 2: Chạy** `npm test -- stats` → FAIL.
- [ ] **Step 3: Cài đặt `reduceStats`.**
- [ ] **Step 4: Chạy** `npm test -- stats` → PASS.
- [ ] **Step 5: Commit** `feat: session stats reducer`.

---

### Task 5: Chữ hiển thị và sinh nét vẽ (một màu và màu)

**Files:**
- Create: `src/core/text.ts`, `src/core/sketch.ts`
- Test: `tests/core/text.test.ts`, `tests/core/sketch.test.ts`

**Interfaces:**
- Produces:

```ts
// text.ts
export function displayName(user: LiveUser, max = 14): string; // nickname.trim(); rỗng → '@' + handle; cắt theo grapheme (Intl.Segmenter) rồi thêm '…'
export function initials(user: LiveUser): string;              // grapheme đầu tiên của displayName, viết hoa; không có gì → '?'

// sketch.ts
export type Point = [number, number];          // toạ độ chuẩn hoá 0..1, gốc trên-trái
export type Stroke = Point[];
export const SKETCH_SIZE = 96;                 // ảnh đầu vào là SKETCH_SIZE × SKETCH_SIZE
export const INK = '#1f3a8a';                  // màu mực của bức một màu
export function toGray(rgba: Uint8ClampedArray): Uint8ClampedArray;  // 0.299R + 0.587G + 0.114B, làm tròn; alpha 0 coi là trắng
export function buildStrokes(gray: Uint8ClampedArray, opts?: { lines?: number }): Stroke[];  // lines mặc định 40
export function strokeColors(rgba: Uint8ClampedArray | null, strokes: Stroke[]): string[];
// một màu '#rrggbb' cho mỗi nét = trung bình RGB của các điểm ảnh tại từng điểm của nét (điểm ảnh alpha 0 bỏ qua),
// rồi nhân mỗi kênh với 0.85 để mực đủ đậm trên giấy. rgba null, hoặc nét không có điểm ảnh hợp lệ → INK.
export function strokesAt(strokes: Stroke[], t: number): { done: Stroke[]; pen: Point | null }; // t kẹp trong 0..1
export function placeholderGray(seed: string): Uint8ClampedArray;  // ảnh thay thế: dải chéo, xác định theo seed
```

Thuật toán `buildStrokes` (nét sóng điều biên, một nét mỗi hàng, đi kiểu zíc-zắc):

```
r = 0.5; step = 1 / lines; amp = step * 0.45; freq = 2π * 24   // 8 điểm mẫu mỗi chu kỳ
for i in 0..lines-1:
  y = (i + 0.5) * step; dy = y - 0.5
  if |dy| >= r: continue
  half = sqrt(r² - dy²); x0 = 0.5 - half; x1 = 0.5 + half
  pts = for x from x0 to x1 step 1/(SKETCH_SIZE*2):
          d = 1 - gray[floor(y*S)*S + floor(x*S)] / 255      // độ tối 0..1, kẹp chỉ số vào [0, S-1]
          [x, y + sin(x * freq) * amp * d]
  if i lẻ: đảo ngược pts
  nếu pts có ≥ 2 điểm: thêm vào kết quả
```

`strokesAt`: tính tổng độ dài mọi nét, lấy `t × tổng`; các nét đã qua hết nằm nguyên trong `done`, nét đang dở bị cắt tại điểm nội suy tuyến tính, `pen` là điểm đó. `t ≤ 0` → `done: []`, `pen` là điểm đầu của nét đầu; `t ≥ 1` → mọi nét, `pen: null`. Mảng nét rỗng → `{ done: [], pen: null }`. Chỉ số của nét trong `done` trùng chỉ số trong `strokes`, nên màu của `done[i]` là `strokeColors(...)[i]`.

- [ ] **Step 1: Viết test thất bại:**

```ts
// text
expect(displayName(u({ nickname: 'Mai' }))).toBe('Mai');
expect(displayName(u({ nickname: 'abcdefghijklmnopq' }))).toBe('abcdefghijklmn…');
expect(displayName(u({ nickname: '👨‍👩‍👧'.repeat(20) }))).toBe('👨‍👩‍👧'.repeat(14) + '…');   // không cắt đôi emoji ghép
expect(displayName(u({ nickname: '   ', handle: 'mai_test' }))).toBe('@mai_test');
expect(initials(u({ nickname: 'đỗ' }))).toBe('Đ');
expect(initials(u({ nickname: '', handle: '' }))).toBe('?');

// sketch
const N = 96 * 96, white = new Uint8ClampedArray(N).fill(255), black = new Uint8ClampedArray(N);
expect(Array.from(toGray(new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0])))).toEqual([76, 255]);
test('mọi điểm nằm trong khung', () => { for (const p of buildStrokes(black).flat()) { expect(p[0]).toBeGreaterThanOrEqual(0); expect(p[0]).toBeLessThanOrEqual(1); expect(p[1]).toBeGreaterThanOrEqual(-0.02); expect(p[1]).toBeLessThanOrEqual(1.02); } });
test('ảnh trắng cho nét thẳng', () => { for (const s of buildStrokes(white)) expect(new Set(s.map(p => p[1])).size).toBe(1); });
test('ảnh đen cho nét gợn', () => { expect(buildStrokes(black).some(s => new Set(s.map(p => p[1])).size > 1)).toBe(true); });
test('zíc-zắc', () => { const s = buildStrokes(white); expect(s[0][0][0]).toBeLessThan(s[0].at(-1)![0]); expect(s[1][0][0]).toBeGreaterThan(s[1].at(-1)![0]); });
test('số nét không vượt lines', () => { expect(buildStrokes(white, { lines: 10 }).length).toBeLessThanOrEqual(10); });
test('strokeColors: ảnh đỏ thuần → mọi nét #d90000', () => { const red = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { red[i * 4] = 255; red[i * 4 + 3] = 255; } const s = buildStrokes(white); const c = strokeColors(red, s); expect(c.length).toBe(s.length); expect(new Set(c)).toEqual(new Set(['#d90000'])); });
test('strokeColors: null hoặc ảnh trong suốt → INK', () => { const s = buildStrokes(white); expect(new Set(strokeColors(null, s))).toEqual(new Set([INK])); expect(new Set(strokeColors(new Uint8ClampedArray(N * 4), s))).toEqual(new Set([INK])); });
test('strokesAt biên', () => {
  const s: Stroke[] = [[[0, 0], [1, 0]], [[1, 1], [0, 1]]];
  expect(strokesAt(s, 0)).toEqual({ done: [], pen: [0, 0] });
  expect(strokesAt(s, 0.25)).toEqual({ done: [[[0, 0], [0.5, 0]]], pen: [0.5, 0] });
  expect(strokesAt(s, 1)).toEqual({ done: s, pen: null });
  expect(strokesAt(s, 7)).toEqual({ done: s, pen: null });
  expect(strokesAt([], 0.5)).toEqual({ done: [], pen: null });
});
test('placeholder xác định và đúng cỡ', () => { expect(placeholderGray('a')).toEqual(placeholderGray('a')); expect(placeholderGray('a').length).toBe(N); expect(buildStrokes(placeholderGray('a')).length).toBeGreaterThan(0); });
```

- [ ] **Step 2: Chạy** `npm test -- text sketch` → FAIL.
- [ ] **Step 3: Cài đặt `text.ts` và `sketch.ts`** theo thuật toán ở trên.
- [ ] **Step 4: Chạy** `npm test -- text sketch` → PASS.
- [ ] **Step 5: Commit** `feat: display text helpers and wave-line sketch generator with colour`.

---

### Task 6: Bộ điều phối `Session`

**Files:**
- Create: `src/core/session.ts`
- Test: `tests/core/session.test.ts`

**Interfaces:**
- Consumes: `DrawQueue`, `QueueEntry` (Task 2); `decide` (Task 3); `reduceStats`, `SessionStats`, `EMPTY_STATS` (Task 4); `Settings`, `DEFAULT_SETTINGS`, `sanitizeSettings` (Task 1).
- Produces:

```ts
export type Drawing = { entry: QueueEntry; progress: number; paused: boolean; ready: boolean; color: boolean };
// progress 0..1; ready = ảnh đã tải xong hoặc đã xác định dùng ảnh thay thế; color = entry.coins ≥ colorMinCoins tại lúc bắt đầu vẽ, sau đó không đổi
export type FeedItem = { id: number; at: number; kind: 'comment' | 'gift' | 'join' | 'follow' | 'system'; user: LiveUser | null; text: string };
export type SessionState = {
  conn: ConnState; roomId: string | null; stats: SessionStats;
  drawn: number; owed: number; declined: number; freeAccepted: number;
  drawing: Drawing | null; lastDrawn: QueueEntry | null;
  queue: readonly QueueEntry[]; feed: FeedItem[];     // feed giữ 200 mục mới nhất
  settings: Settings;
};
export type Command =
  | { type: 'pause' } | { type: 'resume' } | { type: 'skip' } | { type: 'redoLast' }
  | { type: 'clearQueue' } | { type: 'remove'; id: string } | { type: 'moveToFront'; id: string }
  | { type: 'addManual'; handle: string }
  | { type: 'setSettings'; patch: unknown }        // qua sanitizeSettings(patch, settings hiện tại)
  | { type: 'ready'; id: string };                 // máy chủ gửi khi ảnh của lượt `id` đã tải xong hoặc thất bại; id không khớp bức đang vẽ thì bỏ qua
export class Session {
  constructor(opts?: { settings?: Settings; random?: () => number; startAt?: number });
  handle(e: LiveEvent): void;
  command(c: Command, now: number): void;
  tick(now: number): void;
  getState(): SessionState;
  onChange(cb: (s: SessionState) => void): () => void;
}
```

Quy ước hành vi (spec 5.3):
- `handle` gọi `decide` với `roll = random()` (rút đúng một lần cho mỗi bình luận khớp từ khoá), `lastGiftAt` là thời điểm quà gần nhất có `coins ≥ minCoins`.
- `enqueue` → `queue.add(...)` với `combineWindowMs` và `maxQueue` hiện tại; kết quả `'full'` → `owed += 1`; lượt miễn phí được thêm → `freeAccepted += 1`; `'duplicate'` → không đếm gì.
- `tick`: khi không có bức nào đang vẽ, gọi `queue.takeEligible(now, stageDelayMs)`; có lượt thì thành `drawing` với `progress 0`, `ready false`, `paused false`. Tiến độ tăng `(now − lần tick trước) / (drawSeconds × 1000)`, không tăng khi `paused` hoặc `ready` là `false`. Đạt 1 → `drawn += 1`, `lastDrawn = entry`, `drawing = null`, và cùng lần `tick` đó thử lấy lượt kế.
- `tick` gọi các hàm `onChange` khi nó làm đổi trạng thái (bức bắt đầu, tiến độ tăng, bức xong); `tick` không đổi gì thì không gọi.
- Đổi `drawSeconds` giữa chừng giữ nguyên `progress`. Đổi `colorMinCoins` không đổi `color` của bức đang vẽ.
- `redoLast` gọi `queue.pushFront(lastDrawn, now)`; không làm gì nếu `lastDrawn` là `null`.
- `addManual` bỏ `@` đầu và khoảng trắng, chuỗi rỗng thì bỏ qua; tạo `LiveUser` với `userId: 'manual:' + handle`, `avatarUrl: null`.
- Sự kiện `status` cập nhật `conn`, `roomId` và thêm một mục `system` vào feed; không đụng tới hàng chờ hay số liệu.

- [ ] **Step 1: Viết test thất bại.** Trợ giúp `mk(patch?)` tạo `Session` với `stageDelayMs: 0` và `random: () => 0.5` trừ khi ghi khác; `start(s, now)` gọi `tick(now)` rồi gửi `ready` cho bức vừa bắt đầu.

1. Quà 1 xu tại 0 → `queue.length 1`; `tick(0)` → `drawing.entry` là người đó, `ready false`, `queue.length 0`.
2. Chưa `ready`: `tick(30_000)` → `progress 0`. `ready` với id sai → vẫn 0. `ready` đúng id rồi `tick(52_500)` → `progress` ≈ 0.5 (45 s mặc định).
3. `start`, `tick` thêm 45 s → `drawn 1`, `lastDrawn` là lượt đó; hàng chờ có b → cùng lần `tick`, `drawing` là b.
4. Ưu tiên: a 1 xu rồi b 99 xu rồi `tick` → `drawing` là b, `drawing.color true`; bức a sau đó `color false`.
5. `colorMinCoins: 5`; a tặng 3 xu tại 0 và 3 xu tại 10 000 → một lượt 6 xu; khi vẽ `color true`.
6. `setSettings({ colorMinCoins: 1 })` khi đang vẽ bức `color false` → vẫn `false`.
7. Độ trễ: `mk({ stageDelayMs: 3000 })`, quà tại 0 → `tick(2999)` `drawing null`; `tick(3000)` có `drawing`.
8. Không ai bị chặn: `stageDelayMs 3000`; b tặng 1 xu tại 0; a tặng 5 xu tại 0, 2000, 4000, 6000 → `tick(6500)` vẽ b, không phải `null`.
9. `pause` rồi `tick` thêm 60 s → `progress` không đổi; `resume` rồi `tick` thêm 22,5 s → tăng 0.5.
10. `skip` khi đang vẽ a (hàng chờ có b) → `drawn 0`, `lastDrawn null`, lần `tick` kế `drawing` là b và không tạm dừng — kể cả khi a đang tạm dừng lúc bị bỏ qua.
11. `skip` khi không có gì đang vẽ → không lỗi, trạng thái không đổi.
12. `clearQueue` khi đang vẽ a và chờ b, c → `queue []`, `drawing` vẫn là a.
13. a đang được vẽ, a tặng thêm → một lượt mới trong hàng chờ.
14. `mk({ maxQueue: 2 })`, ba người tặng (chưa `tick`) → `queue.length 2`, `owed 1`, `stats.giftCount 3`.
15. `setSettings({ acceptingGifts: false })`, một quà → `owed 1`, `queue []`, `stats.coins` vẫn cộng.
16. Xin miễn phí theo thời gian chờ: `startAt 0`; `!ve` tại 119 999 → `declined 1`; `!ve` của người khác tại 120 000 → vào hàng chờ, `freeAccepted 1`. Sau một quà tại 130 000, `!ve` tại 200 000 → `declined 2`.
17. Xin miễn phí theo tỉ lệ: `random: () => 0.05` → `!ve` tại 1000 được nhận. `random: () => 0.5` → bị từ chối.
18. Cùng một người gửi `!ve` hai lần khi lượt đầu còn chờ → `queue.length 1`, `declined 0`.
19. `status disconnected` rồi `status connected` giữa lúc đang vẽ → `drawing`, `queue`, `stats`, `drawn` giữ nguyên; `conn` là `'connected'`.
20. `redoLast` sau khi a vẽ xong, hàng chờ có b 99 xu → hàng chờ là [a, b]; `redoLast` khi `lastDrawn null` → không đổi.
21. `addManual('  @mai_test ')` → lượt `reason 'manual'`, `user.handle 'mai_test'`; `addManual('@')` → không thêm.
22. `setSettings({ drawSeconds: 0, hack: 1 })` → `settings.drawSeconds 5`, không có `hack`.
23. 250 bình luận → `feed.length 200`, mục cuối là bình luận thứ 250.
24. `onChange` được gọi sau `handle` và `command`; hàm huỷ đăng ký hoạt động.
25. `onChange` được gọi khi `tick` bắt đầu một bức, khi tiến độ tăng, và khi bức xong; `tick` trên phiên rỗng, hoặc khi bức đang tạm dừng, không gọi `onChange`.
26. Hàng chờ đã có 3 lượt quà chưa vẽ, `!ve` tại 500 000 (không có quà trong 120 s cuối) → `declined 1`, hàng chờ vẫn 3.

- [ ] **Step 2: Chạy** `npm test -- session` → FAIL.
- [ ] **Step 3: Cài đặt `Session`.**
- [ ] **Step 4: Chạy** `npm test && npm run typecheck` → PASS toàn bộ.
- [ ] **Step 5: Commit** `feat: session controller`.

---

### Task 7: Nguồn giả lập `SimulatorSource`

**Files:**
- Create: `src/sources/simulator.ts`
- Test: `tests/sources/simulator.test.ts`

**Interfaces:**
- Consumes: `LiveSource`, `LiveEvent`, `LiveUser`.
- Produces:

```ts
export const TEST_USERS: LiveUser[];   // @mai_test, @bao_test, @linh_test; avatarUrl: null
export const TEST_GIFTS: { name: string; coins: number }[];   // [{ name: 'Rose', coins: 1 }, { name: 'Mũ', coins: 99 }]
export class SimulatorSource implements LiveSource {
  constructor(opts?: { intervalMs?: number; now?: () => number; random?: () => number });  // intervalMs mặc định 1500
  start(): Promise<void>;    // phát status 'connected' với roomId 'rehearsal', rồi cứ mỗi intervalMs phát một sự kiện ngẫu nhiên
  stop(): Promise<void>;     // dừng hẹn giờ, phát status 'disconnected'; gọi lại lần hai, hoặc khi chưa start, không phát gì
  onEvent(cb): () => void;
  emitGift(handle: string, giftName: string, coinsEach: number, count: number): void;  // coins = coinsEach × count
  emitComment(handle: string, text: string): void;
  emitLikes(handle: string, count: number): void;
}
```

Các `emit*` hoạt động cả khi chưa `start()`. `handle` rỗng thì dùng `TEST_USERS[0]`; `handle` lạ tạo người dùng mới với `userId: 'sim:' + handle`. Sự kiện định kỳ chọn theo `random()`: 50 % bình luận, 20 % tim, 15 % tham gia, 8 % quà Rose, 2 % quà Mũ, 5 % bình luận `!ve`.

- [ ] **Step 1: Viết test thất bại** với `vi.useFakeTimers()`:

```ts
test('start phát connected rồi sự kiện định kỳ', async () => { await src.start(); expect(events[0]).toMatchObject({ type: 'status', state: 'connected', roomId: 'rehearsal' }); vi.advanceTimersByTime(4500); expect(events.length).toBe(4); });
test('stop dừng phát và idempotent', async () => { await src.start(); await src.stop(); await src.stop(); const n = events.length; vi.advanceTimersByTime(10_000); expect(events.length).toBe(n); expect(events.filter(e => e.type === 'status' && e.state === 'disconnected').length).toBe(1); });
test('stop khi chưa start không phát gì', async () => { await src.stop(); expect(events).toEqual([]); });
test('emitGift nhân xu', () => { src.emitGift('mai_test', 'Rose', 1, 5); expect(events.at(-1)).toMatchObject({ type: 'gift', coins: 5, count: 5, giftName: 'Rose' }); });
test('handle rỗng dùng người thử đầu tiên', () => { src.emitComment('', 'xin chào'); expect((events.at(-1) as any).user.handle).toBe('mai_test'); });
test('huỷ đăng ký', () => { off(); src.emitLikes('a', 10); expect(events.length).toBe(0); });
test('TEST_GIFTS', () => { expect(TEST_GIFTS).toEqual([{ name: 'Rose', coins: 1 }, { name: 'Mũ', coins: 99 }]); });
```

- [ ] **Step 2: Chạy** `npm test -- simulator` → FAIL.
- [ ] **Step 3: Cài đặt `SimulatorSource`.**
- [ ] **Step 4: Chạy** `npm test -- simulator` → PASS.
- [ ] **Step 5: Commit** `feat: simulator live source`.

---

### Task 8: Máy chủ localhost — HTTP, WebSocket, ảnh đại diện, lưu cài đặt

**Files:**
- Create: `src/server/avatar.ts`, `src/server/settings-store.ts`, `src/server/app.ts`, `src/server/main.ts`, `src/client/protocol.ts`, `vite.config.ts`, `src/client/stage/index.html`, `src/client/control/index.html`
- Modify: `package.json` (script `build:client`, `start`)
- Test: `tests/server/avatar.test.ts`, `tests/server/settings-store.test.ts`, `tests/server/app.test.ts`

**Interfaces:**
- Consumes: `Session`, `SessionState`, `Command`, `SimulatorSource`, `TEST_GIFTS`, `LiveSource`, `Settings`, `sanitizeSettings`.
- Produces:

```ts
// src/server/avatar.ts
export type AvatarImage = { contentType: string; body: Buffer };
export function fetchAvatar(url: string | null, deps: { fetch: typeof fetch; cache: Map<string, AvatarImage>; timeoutMs?: number }): Promise<AvatarImage | null>;
// null khi: url null, không phải https, hết giờ (mặc định 8000), HTTP không 2xx, content-type không bắt đầu bằng 'image/', thân > 2 MB.
// Không bao giờ ném lỗi. Kết quả null không được cache.

// src/server/settings-store.ts
export function loadSettings(path: string): Settings;              // file không có, không đọc được, không phải JSON → DEFAULT_SETTINGS; còn lại qua sanitizeSettings
export function saveSettings(path: string, s: Settings): void;     // ghi JSON thụt 2 khoảng; lỗi ghi thì nuốt và console.warn

// src/client/protocol.ts
export type ClientMsg =
  | { type: 'command'; command: Command }
  | { type: 'connect'; mode: 'rehearsal' | 'live'; target?: string }
  | { type: 'disconnect' }
  | { type: 'test'; kind: 'gift' | 'comment' | 'likes'; handle: string; arg: string; count: number };
export type ServerMsg = { type: 'state'; state: SessionState };

// src/server/app.ts
export type LiveFactory = (target: string) => LiveSource | { error: string };
export function createApp(opts: {
  port: number;                       // 0 = cổng ngẫu nhiên (cho test)
  staticDir: string;                  // thư mục dist/client
  settingsPath: string;
  liveFactory: LiveFactory;
  fetch?: typeof fetch; now?: () => number;
}): { listen(): Promise<{ port: number }>; close(): Promise<void>; session: Session };
```

Hành vi máy chủ:
- Bind `127.0.0.1`. Kiểm tra `Host` và `Origin` như Global Constraints; sai → HTTP 403, WebSocket bị từ chối nâng cấp.
- Đường dẫn: `GET /` → `control/index.html`; `GET /stage` → `stage/index.html`; `GET /assets/*` → file tĩnh trong `staticDir` (chặn `..`, đường dẫn ra ngoài `staticDir` → 404); `GET /api/avatar/<entryId>` → ảnh của lượt đang vẽ có `id` đó (lấy `avatarUrl` từ `Session`, không nhận URL từ trình duyệt), không khớp hoặc `fetchAvatar` trả `null` → 404; `GET /ws` → WebSocket. Còn lại → 404. Phương thức khác `GET` → 405.
- Mọi phản hồi HTML có header `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://127.0.0.1:<cổng> ws://localhost:<cổng>`.
- WebSocket: khi nối gửi ngay một `state`. Thông điệp không phải JSON, quá 16 KB, hoặc sai `type` → bỏ qua, không đóng kết nối, không ném lỗi.
- Phát `state`: gom lại, tối đa một lần mỗi 250 ms (lần cuối luôn được gửi).
- `session.tick(now())` mỗi 100 ms.
- Một `SimulatorSource` duy nhất luôn tồn tại: `connect rehearsal` gọi `start()` trên nó; `test` dùng các hàm `emit*` của nó bất kể đang ở chế độ nào. Với `test` loại `gift`, `arg` là tên quà, số xu tra trong `TEST_GIFTS`, tên lạ thì bỏ qua; `count` kẹp vào 1..999. Loại `comment`: `arg` là nội dung, cắt còn 200 ký tự. Loại `likes`: bỏ qua `arg`.
- `connect live`: dừng nguồn đang chạy, gọi `liveFactory(target)`; trả `{ error }` → đưa vào `Session` một sự kiện `status error` với `message` đó; trả nguồn → đăng ký `session.handle` rồi `start()`. `disconnect` dừng nguồn đang chạy (giả lập hoặc thật).
- Tải ảnh trước khi vẽ: mỗi khi `drawing.entry.id` đổi, gọi `fetchAvatar(entry.user.avatarUrl, …)`; khi hoàn tất (có ảnh hay `null`) gửi `session.command({ type: 'ready', id }, now())`.
- Cài đặt: khởi động bằng `loadSettings(settingsPath)`; sau mỗi lệnh `setSettings`, gọi `saveSettings`.
- `main.ts`: cổng lấy từ biến môi trường `PORT` (mặc định 4780), `settingsPath` là `settings.json` ở thư mục gốc dự án; `liveFactory` tạm thời trả `{ error: 'Chưa hỗ trợ' }` (Task 10 thay); in ra `Bảng điều khiển: http://127.0.0.1:<cổng>/` và `Sân khấu: http://127.0.0.1:<cổng>/stage`. Cổng đang bị chiếm → in thông báo tiếng Việt nêu cổng và cách đổi bằng `PORT`, thoát mã 1.
- Vite: `root: 'src/client'`, hai đầu vào `control/index.html` và `stage/index.html`, `build.outDir: '../../dist/client'`, `base: '/'`, tài nguyên ra `assets/`. Script: `"build:client": "vite build"`, `"start": "npm run build:client && tsx src/server/main.ts"`.

- [ ] **Step 1: Viết test thất bại cho `fetchAvatar`** với `fetch` giả: `null` và `http:` → `null`, không gọi `fetch`; 200 `image/png` → `{ contentType: 'image/png', body }`; lần hai lấy từ cache, `fetch` gọi đúng 1 lần; 404 → `null`; `text/html` → `null`; `fetch` ném lỗi → `null`; quá hạn 8000 ms (fake timers, `fetch` không bao giờ trả) → `null`; thân 3 MB → `null`; kết quả `null` không được cache (lần hai gọi `fetch` lại).

- [ ] **Step 2: Viết test thất bại cho `settings-store`** trong thư mục tạm (`fs.mkdtempSync`): file không tồn tại → `DEFAULT_SETTINGS`; nội dung `'{oops'` → `DEFAULT_SETTINGS`; `{"drawSeconds":0,"minCoins":"x"}` → `drawSeconds 5`, `minCoins 1`; `saveSettings` rồi `loadSettings` trả lại đúng đối tượng; `saveSettings` vào đường dẫn không ghi được → không ném lỗi.

- [ ] **Step 3: Viết test thất bại cho `createApp`** (cổng 0, `staticDir` là thư mục tạm có `control/index.html`, `stage/index.html`, `assets/a.js`; dùng `fetch` thật tới `127.0.0.1` và client `ws`):

```ts
test('GET / và /stage trả 200 text/html kèm CSP', ...);
test('GET /assets/a.js → 200; /assets/../../package.json và /assets/%2e%2e/x → 404', ...);
test('POST / → 405; GET /khong-co → 404', ...);
test('Host lạ → 403', ...);                       // gửi header Host: evil.example qua http.request
test('WebSocket với Origin lạ bị từ chối', ...);
test('WebSocket nhận state ngay khi nối', ...);   // state.conn === 'idle'
test('connect rehearsal → state.conn thành connected', ...);
test('test gift Rose ×5 → hàng chờ hoặc bức đang vẽ có lượt 5 xu', ...);
test('test gift tên lạ → không đổi gì', ...);
test('rác qua WebSocket (chuỗi "abc", JSON sai type, 20 KB) → kết nối vẫn mở, vẫn nhận state sau đó', ...);
test('setSettings được lưu', ...);                // gửi command, đợi, đọc settingsPath → drawSeconds mới
test('connect live với liveFactory trả error → state.conn error, feed có thông báo', ...);
test('/api/avatar/<id sai> → 404', ...);
test('/api/avatar/<id bức đang vẽ> với fetch giả trả PNG → 200 image/png', ...);
test('avatarUrl null → bức vẫn chuyển sang ready', ...);
test('100 sự kiện dồn dập → số thông điệp state nhận được trong 1 s ≤ 6', ...);
test('close() giải phóng cổng', ...);
```

- [ ] **Step 4: Chạy** `npm test -- server` → FAIL.
- [ ] **Step 5: Cài đặt** `avatar.ts`, `settings-store.ts`, `protocol.ts`, `app.ts`, `main.ts`, `vite.config.ts`, và hai `index.html` tạm, mỗi trang nạp một script nhỏ mở WebSocket tới `/ws` và in `JSON.stringify(state)` vào thẻ `<pre>`.
- [ ] **Step 6: Chạy** `npm test && npm run typecheck` → PASS.
- [ ] **Step 7: Kiểm tra bằng tay.** `npm start`, mở `http://127.0.0.1:4780/`. Trong console trình duyệt gửi `{type:'connect',mode:'rehearsal'}` qua WebSocket → cả hai trang hiện JSON thay đổi, `conn` là `"connected"`, `drawing.progress` tăng dần. Mở `http://<IP mạng LAN của máy>:4780/` từ máy khác → không vào được.
- [ ] **Step 8: Commit** `feat: localhost server, websocket bridge, avatar proxy, settings store`.

---

### Task 9: Trang sân khấu và trang điều khiển

**Files:**
- Create: `src/client/stage/stage-model.ts`, `src/client/stage/stage.ts`, `src/client/stage/stage.css`, `src/client/control/control-model.ts`, `src/client/control/control.ts`, `src/client/control/control.css`
- Modify: `src/client/stage/index.html`, `src/client/control/index.html`
- Test: `tests/client/stage-model.test.ts`, `tests/client/control-model.test.ts`

**Interfaces:**
- Consumes: `ClientMsg`, `ServerMsg`, `SessionState`, `Command`, `Settings`, `TEST_GIFTS`, `toGray`, `buildStrokes`, `strokeColors`, `strokesAt`, `placeholderGray`, `INK`, `SKETCH_SIZE`, `displayName`, `initials`.
- Produces — hai file `*-model.ts` chỉ chứa hàm thuần, không chạm `window`/`document`; test chỉ import hai file này:

```ts
// stage-model.ts
export function upNext(state: SessionState): { rank: number; name: string; coins: number }[];  // tối đa 3 lượt đầu hàng chờ
export function noticeVisible(state: SessionState): boolean;    // true khi settings.acceptingGifts === false
export function stageCaption(state: SessionState): string;      // không vẽ: 'Đang chờ lượt vẽ…'; chưa ready: 'Đang chuẩn bị…'; còn lại: '@' + handle
export function liveProgress(d: Drawing, receivedAt: number, now: number, drawSeconds: number): number;
// tiến độ để vẽ ở khung hình hiện tại, nội suy từ state gần nhất (nhận lúc receivedAt):
// paused hoặc chưa ready → d.progress; còn lại → min(1, d.progress + (now − receivedAt) / (drawSeconds × 1000)), và phần cộng thêm không vượt 0.5 s quy đổi

// control-model.ts
export function statTiles(s: SessionState): { label: string; value: string }[];
// đúng 10 ô theo thứ tự: Người xem, Xu buổi này, Lượt quà, Người tặng, Fan mới, Tim, Bình luận, Đã vẽ, Đang chờ, Nợ vẽ sau
export function feedLine(f: FeedItem): string;                  // 'HH:MM:SS  Tên @handle: nội dung' ; mục system: 'HH:MM:SS  · nội dung'
export function keyToCommand(key: string, s: SessionState): Command | null;  // 'p' → pause hoặc resume tuỳ drawing.paused; 's' → skip; không có drawing → null
export function queueRow(e: QueueEntry): string;                // quà: '<tên> · <coins> xu' + (gifts > 1 ? ' (gộp ' + gifts + ' lần)' : ''); free: '<tên> · xin vẽ'; manual: '<tên> · tự nhập'
export type SettingField = { key: keyof Settings; label: string; kind: 'number' | 'seconds' | 'percent' | 'boolean' | 'text' };
export const SETTING_FIELDS: SettingField[];                    // đủ 12 khoá của Settings, mỗi khoá đúng một lần
export function toFormValue(key: keyof Settings, s: Settings): string | boolean;   // 'seconds': ms → giây; 'percent': 0..1 → 0..100
export function fromFormValue(key: keyof Settings, raw: string | boolean): Partial<Settings>;  // ngược lại; chuỗi không phải số → {}
```

`kind` của từng khoá: `combineWindowMs`, `freeIdleMs`, `stageDelayMs` là `'seconds'` (lưu mili giây, hiển thị giây); `drawSeconds`, `minCoins`, `maxQueue`, `freeQueueLimit`, `colorMinCoins` là `'number'`; `freeChance` là `'percent'`; `acceptingGifts`, `allowFreeRequests` là `'boolean'`; `freeKeyword` là `'text'`.

**Sân khấu** — canvas 540×960 co giãn theo cửa sổ, thiết kế riêng: nền giấy kem `#f4efe6`; vùng vẽ tròn đường kính 380 px, tâm (270, 420), nét 1,2 px; viền là hai vòng tròn đồng tâm cách nhau 8 px; thanh ray ngang là hình chữ nhật xám đậm cao 14 px chạy theo `y` của bút; đầu bút là hình vuông 26 px màu `#d97706` tại `pen`; chú thích `stageCaption` ở y = 660, font 28 px. Cột "TIẾP THEO" ở góc trên trái; khi `noticeVisible`, dưới cột đó có hộp "Tạm ngưng nhận quà — hàng chờ đang dài, cảm ơn mọi người!". Bức `color true` dùng `strokeColors(rgba, strokes)` cho từng nét và có thêm vòng viền thứ ba màu `#d97706`; bức `color false` dùng `INK`.

Luồng ảnh: khi `drawing.entry.id` đổi và `ready` là `true` → nạp `/api/avatar/<id>` vào `Image`, vẽ lên canvas ẩn 96×96, lấy `rgba`, `toGray`, `buildStrokes`. Nạp lỗi (404) → `placeholderGray(userId)`, `rgba null`, và vẽ `initials` cỡ 120 px mờ 15 % giữa vòng tròn. Kết quả về trễ cho `id` cũ thì bỏ. Nét và màu chỉ tính một lần cho mỗi bức; mỗi khung hình (`requestAnimationFrame`) chỉ gọi `strokesAt` với `t = liveProgress(...)`, nhờ đó nét vẽ mượt dù state chỉ tới 4 lần mỗi giây. WebSocket đứt → tự nối lại sau 2 s, không giới hạn số lần.

**Điều khiển** — giao diện tối, một màu nhấn. Từ trên xuống: (1) ô nhập "Link hoặc tên tài khoản TikTok" + nút Diễn tập / Kết nối thật / Ngắt + nhãn trạng thái theo `conn` + `roomId` + liên kết "Mở sân khấu" (`/stage`, tab mới); (2) công tắc nhanh "Nhận quà" và "Cho xin vẽ miễn phí", nút "Cài đặt" mở bảng cài đặt; (3) 10 ô số liệu, dòng top người tặng, dòng phụ "Xin miễn phí: nhận N · từ chối M"; (4) hai cột: trái là khung sự kiện tự cuộn xuống cuối trừ khi người dùng đang cuộn lên; phải là thẻ "Đang vẽ" (tên, nhãn, huy hiệu "MÀU" khi `color`, thanh tiến độ, Tạm dừng (P), Bỏ qua (S), Vẽ lại lượt trước) và danh sách hàng chờ dùng `queueRow` (mỗi dòng có ↑ và ×; phía trên có "+ Tự nhập" và "Xoá hết"); (5) hàng thử: ô người thử, chọn quà từ `TEST_GIFTS`, số lượng, Tặng thử, Bình luận thử, Thả 10 tim thử.

Bảng cài đặt sinh từ `SETTING_FIELDS`, chia ba nhóm có tiêu đề: "Quà và hàng chờ" (`minCoins`, `combineWindowMs`, `maxQueue`, `acceptingGifts`), "Xin vẽ không quà" (`allowFreeRequests`, `freeKeyword`, `freeIdleMs`, `freeChance`, `freeQueueLimit`), "Vẽ và sân khấu" (`colorMinCoins`, `drawSeconds`, `stageDelayMs`). Đổi một ô → gửi ngay `setSettings` với `fromFormValue`; giá trị hiển thị luôn lấy lại từ `state.settings` (để người dùng thấy giá trị đã bị kẹp). Có nút "Về mặc định" gửi `setSettings` với toàn bộ `DEFAULT_SETTINGS`.

"Xoá hết" hỏi lại bằng `confirm()` khi hàng chờ có từ 1 lượt. Phím tắt bị bỏ qua khi con trỏ đang ở trong một ô nhập. WebSocket đứt → hiện dải "Mất kết nối với máy chủ, đang thử lại…" và tự nối lại sau 2 s.

- [ ] **Step 1: Viết test thất bại:**

```ts
// stage-model
expect(upNext(stateWithQueue(5)).map(x => x.rank)).toEqual([1, 2, 3]);
expect(upNext(stateWithQueue(0))).toEqual([]);
expect(noticeVisible(stateWith({ acceptingGifts: false }))).toBe(true);
expect(stageCaption(idleState)).toBe('Đang chờ lượt vẽ…');
expect(stageCaption(drawingState({ ready: false }))).toBe('Đang chuẩn bị…');
expect(stageCaption(drawingState({ ready: true, handle: 'mai_test' }))).toBe('@mai_test');
const d = (p: Partial<Drawing>) => ({ ...drawingState({ ready: true }).drawing!, progress: 0.2, ...p });
expect(liveProgress(d({}), 1000, 1100, 10)).toBeCloseTo(0.21);            // 100 ms của bức 10 s = 0.01
expect(liveProgress(d({ paused: true }), 1000, 1100, 10)).toBe(0.2);
expect(liveProgress(d({ ready: false }), 1000, 1100, 10)).toBe(0.2);
expect(liveProgress(d({}), 1000, 9000, 10)).toBeCloseTo(0.25);            // trần 0.5 s: máy chủ im lặng thì không tự vẽ tiếp
expect(liveProgress(d({ progress: 0.99 }), 1000, 1400, 10)).toBe(1);

// control-model
expect(statTiles(state).map(t => t.label)).toEqual(['Người xem', 'Xu buổi này', 'Lượt quà', 'Người tặng', 'Fan mới', 'Tim', 'Bình luận', 'Đã vẽ', 'Đang chờ', 'Nợ vẽ sau']);
expect(statTiles(stateWith({ viewers: 150 }))[0].value).toBe('150');
expect(keyToCommand('p', drawingState({ paused: false }))).toEqual({ type: 'pause' });
expect(keyToCommand('P', drawingState({ paused: true }))).toEqual({ type: 'resume' });
expect(keyToCommand('s', drawingState({}))).toEqual({ type: 'skip' });
expect(keyToCommand('s', idleState)).toBeNull();
expect(keyToCommand('x', drawingState({}))).toBeNull();
expect(feedLine({ id: 1, at: Date.UTC(2026, 0, 1, 9, 5, 7), kind: 'system', user: null, text: 'Đã kết nối' })).toMatch(/^\d\d:\d\d:\d\d  · Đã kết nối$/);
expect(queueRow(entry({ reason: 'gift', coins: 6, gifts: 2, nickname: 'Mai' }))).toBe('Mai · 6 xu (gộp 2 lần)');
expect(queueRow(entry({ reason: 'gift', coins: 1, gifts: 1, nickname: 'Mai' }))).toBe('Mai · 1 xu');
expect(queueRow(entry({ reason: 'free', nickname: 'Bảo' }))).toBe('Bảo · xin vẽ');
expect(SETTING_FIELDS.map(f => f.key).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
expect(toFormValue('combineWindowMs', DEFAULT_SETTINGS)).toBe('60');
expect(toFormValue('freeChance', DEFAULT_SETTINGS)).toBe('10');
expect(fromFormValue('combineWindowMs', '90')).toEqual({ combineWindowMs: 90000 });
expect(fromFormValue('freeChance', '25')).toEqual({ freeChance: 0.25 });
expect(fromFormValue('drawSeconds', 'abc')).toEqual({});
expect(fromFormValue('acceptingGifts', false)).toEqual({ acceptingGifts: false });
```

- [ ] **Step 2: Chạy** `npm test -- model` → FAIL.
- [ ] **Step 3: Cài đặt hai file model**, rồi `stage.ts`/`stage.css`, rồi `control.ts`/`control.css`.
- [ ] **Step 4: Chạy** `npm test && npm run typecheck` → PASS.
- [ ] **Step 5: Kiểm tra bằng tay** (`npm start`, mở cả `/` và `/stage`):
  - Diễn tập → số liệu chạy; trong ≤ 15 s sân khấu vẽ dần một chân dung nét sóng, bút di chuyển theo.
  - Tặng thử Rose ×1 từ `bao_test`, rồi Mũ ×1 từ `linh_test` → `linh_test` (99 xu) đứng trên trong hàng chờ; khi tới lượt, bức của `linh_test` có huy hiệu "MÀU".
  - Tặng thử Rose ×1 hai lần liên tiếp từ cùng một người → một dòng "2 xu (gộp 2 lần)".
  - Đặt "Gộp quà trong" = 0 giây → hai lần tặng thành hai dòng.
  - Đặt "Thời gian vẽ" = 5 → bức xong trong khoảng 5 s. Nhập 0 → ô tự về 5.
  - Bình luận thử `!ve` ngay sau một quà → "từ chối" tăng. Đặt "Tỉ lệ ngẫu nhiên" = 100 → `!ve` được nhận.
  - Tắt "Nhận quà" → sân khấu hiện hộp thông báo, "Nợ vẽ sau" tăng khi tặng thử.
  - P, S, ↑, ×, Tự nhập, Xoá hết, Vẽ lại hoạt động. Bình luận thử `<b>x</b>` hiện nguyên văn.
  - Tắt máy chủ → trang điều khiển hiện dải mất kết nối; bật lại → tự nối, cài đặt còn nguyên.
- [ ] **Step 6: Commit** `feat: stage and control pages with settings panel`.

---

### Task 10: Bộ nối TikTok LIVE và nhận link

**Files:**
- Create: `src/sources/tiktok.ts`
- Modify: `src/server/main.ts` (thay `liveFactory`), `package.json`
- Test: `tests/sources/tiktok.test.ts`

**Interfaces:**
- Consumes: `LiveSource`, `LiveEvent`, `LiveFactory`.
- Produces:

```ts
export type RawConnection = { connect(): Promise<{ roomId?: string | number }>; disconnect(): void | Promise<void>; on(event: string, cb: (data: any) => void): void };
export type ParsedTarget = { handle: string } | { error: string };
export function parseTikTokTarget(input: string): ParsedTarget;
export function createTikTokSource(handle: string, factory: (handle: string) => RawConnection, now?: () => number): LiveSource;
```

`parseTikTokTarget` (không gọi mạng):
- `trim()`. Rỗng → `{ error: 'Hãy nhập link hoặc tên tài khoản TikTok' }`.
- Không chứa `/` và không chứa `.` kiểu tên miền (tức không khớp `^[a-z]+://` và không có `/`): bỏ một `@` đầu; phần còn lại phải khớp `^[A-Za-z0-9._]{2,24}$` → `{ handle }`; không khớp → `{ error: 'Tên tài khoản không hợp lệ' }`.
- Còn lại coi là link: thêm `https://` nếu thiếu giao thức, phân tích bằng `new URL` (lỗi → `{ error: 'Link không hợp lệ' }`). Tên miền `vm.tiktok.com` hoặc `vt.tiktok.com` → `{ error: 'Link rút gọn chưa được hỗ trợ. Hãy mở link, rồi dán link dạng tiktok.com/@ten' }`. Tên miền khác `tiktok.com`, `www.tiktok.com`, `m.tiktok.com` → `{ error: 'Đây không phải link TikTok' }`. Giao thức khác `http:`/`https:` → `{ error: 'Link không hợp lệ' }`. Đoạn đường dẫn đầu tiên phải có dạng `@<tên>` với tên khớp biểu thức ở trên → `{ handle }`; không có → `{ error: 'Link không chứa tên tài khoản (@ten)' }`. Các đoạn sau (`/live`, `/video/…`) và tham số truy vấn bị bỏ qua.

Ánh xạ sự kiện, theo README của `tiktok-live-connector@2.5.0` (đọc bằng `npm view tiktok-live-connector@2.5.0 readme` ngày 2026-11-11). Lớp là `TikTokLiveConnection`; tên sự kiện dùng được dưới dạng chuỗi; người dùng nằm trong `data.user`; thông tin quà nằm trong `data.giftDetails`.

| Sự kiện thư viện | `LiveEvent` | Trường dùng | Trạng thái |
|---|---|---|---|
| `'chat'` | `comment` | `data.content` | `.d.ts` 2.5.0 (README ghi `data.comment` — sai với `TikTokLiveConnection`) |
| `'gift'` | `gift` — **bỏ qua khi `data.gift?.type === 1 && !data.repeatEnd`** (`repeatEnd` là số 0/1) | `data.gift?.name`, `data.repeatCount`; `coins = data.gift.diamondCount × repeatCount` | `.d.ts` 2.5.0 (README ghi `giftDetails` — sai) |
| `'like'` | `like` | `data.count` | `.d.ts` 2.5.0 (README ghi `likeCount` — sai) |
| `'member'` | `join` | | README xác nhận |
| `'follow'` | `follow` | | README xác nhận |
| `'roomUser'` | `viewers` | `Number(data.total)` (chuỗi int64; cùng tag proto 3 với `viewerCount` của v2) | `.d.ts` 2.5.0 (README ghi `viewerCount` — sai) |
| `'streamEnd'` | `status ended` | | README xác nhận |
| `'disconnected'` | `status disconnected` | | README xác nhận |
| `'error'` | `status error` | `message` ghép từ `data.info` và `data.exception.message` | `.d.ts` 2.5.0 |

Người dùng (`.d.ts` 2.5.0, kiểu `User` của tiktok-live-proto/v3): `data.user?.id` → `userId` (chuỗi; `''` coi như thiếu), `data.user?.displayId` → `handle`, `data.user?.nickname`. `connect()` trả `Promise` của một đối tượng có `roomId`; `disconnect()` trả `Promise` và gọi được cả khi chưa nối (README xác nhận) — vì vậy `RawConnection.disconnect` có kiểu `() => void | Promise<void>`.

**Hai trường README 2.5.0 không nêu, phải đọc file `.d.ts` ở Step 1 rồi ghi vào đây trước khi viết test:**
- Số xu của một quà: `data.gift.diamondCount` (kiểu `Gift` trong tiktok-live-proto/v3; không có `giftDetails`).
- URL ảnh đại diện: `data.user.avatarThumb.urlList[0]` (dự phòng `avatarMedium`, rồi `avatarLarge`; không có `profilePicture`).

Toàn bộ việc dịch dữ liệu thư viện sang `LiveEvent` nằm trong `src/sources/tiktok.ts` và được test bằng dữ liệu giả có đúng hình dạng 2.5.0; `main.ts` chỉ có một dòng `h => new TikTokLiveConnection(h)`.

Trường thiếu, `null`, sai kiểu: URL ảnh → `avatarUrl null`; số → 0; thiếu `data.user` hoặc `userId` → bỏ qua sự kiện, không lỗi. `userId` có thể là số hoặc bigint → đổi sang chuỗi. `start()` phát `status connecting`, gọi `connect()`, thành công phát `status connected` kèm `roomId` dạng chuỗi; thất bại phát `status error` và **không ném lỗi**. `stop()` gọi `disconnect()` đúng một lần dù được gọi nhiều lần, kể cả khi chưa `start()`. Không tự kết nối lại; người dùng bấm "Kết nối thật" lần nữa.

**Khoá ký:** README ghi không cần đăng nhập hay đăng ký ứng dụng, và `signApiKey` (khoá Euler Stream) là tuỳ chọn. Bản MVP không truyền khoá. Việc ký URL WebSocket do máy chủ của bên thứ ba (Euler Stream) thực hiện, nên họ biết tên tài khoản được nối và có thể giới hạn tần suất. Nếu Step 6 bị từ chối vì thiếu khoá hoặc quá giới hạn thì **dừng lại và báo chủ dự án**; không tự đăng ký hay thêm khoá. Không bao giờ bật `authenticateWs` hay truyền `session`.

- [ ] **Step 1: Cài thư viện và xác minh API.** `npm i tiktok-live-connector --save-exact`. Xác nhận phiên bản cài là 2.5.0; nếu khác, đọc lại README của bản đó và đối chiếu cả bảng. Mở file `.d.ts` của `WebcastGiftMessage` và kiểu `user`, tìm hai trường còn trống (xu một quà, URL ảnh đại diện) và điền vào hai chỗ `__________` **trong file kế hoạch này**. Ghi phiên bản đã cài vào dòng đầu `src/sources/tiktok.ts`.

- [ ] **Step 2: Viết test thất bại:**

```ts
// parseTikTokTarget
const ok = (s: string) => parseTikTokTarget(s);
expect(ok('  @mai_test ')).toEqual({ handle: 'mai_test' });
expect(ok('mai.test_01')).toEqual({ handle: 'mai.test_01' });
expect(ok('https://www.tiktok.com/@mai_test')).toEqual({ handle: 'mai_test' });
expect(ok('https://www.tiktok.com/@mai_test/live')).toEqual({ handle: 'mai_test' });
expect(ok('https://www.tiktok.com/@mai_test/live?lang=vi-VN&x=1#y')).toEqual({ handle: 'mai_test' });
expect(ok('tiktok.com/@mai_test')).toEqual({ handle: 'mai_test' });
expect(ok('https://m.tiktok.com/@mai_test/video/123')).toEqual({ handle: 'mai_test' });
for (const bad of ['', '   ', '@', 'a', 'a b', 'tên_có_dấu', 'x'.repeat(25)]) expect(ok(bad)).toHaveProperty('error');
expect(ok('https://vm.tiktok.com/ZSabc/')).toEqual({ error: expect.stringContaining('rút gọn') });
expect(ok('https://vt.tiktok.com/ZSabc/')).toEqual({ error: expect.stringContaining('rút gọn') });
expect(ok('https://example.com/@mai_test')).toEqual({ error: 'Đây không phải link TikTok' });
expect(ok('https://tiktok.com.evil.example/@mai_test')).toEqual({ error: 'Đây không phải link TikTok' });
expect(ok('https://www.tiktok.com/foryou')).toEqual({ error: expect.stringContaining('@ten') });
expect(ok('javascript://www.tiktok.com/@mai_test')).toHaveProperty('error');

// createTikTokSource, với RawConnection giả (EventEmitter nhỏ)
test('start: connecting rồi connected kèm roomId chuỗi', ...);          // connect() trả { roomId: 123 } → roomId '123'
test('connect() thất bại → status error, start() không ném', ...);
// g(over) dựng dữ liệu đúng hình dạng 2.5.0: { user: {...}, giftDetails: { giftType, giftName, <trường xu> }, repeatCount, repeatEnd }
test('chuỗi quà đang chạy bị bỏ qua', () => { fake.emit('gift', g({ giftType: 1, repeatEnd: false, repeatCount: 3 })); expect(events.filter(e => e.type === 'gift')).toEqual([]); });
test('chuỗi quà kết thúc → một gift, coins = xu một quà × repeatCount', () => { fake.emit('gift', g({ giftType: 1, repeatEnd: true, repeatCount: 5, coinsEach: 1 })); expect(events.at(-1)).toMatchObject({ type: 'gift', coins: 5, count: 5 }); });
test('quà không theo chuỗi (giftType 2) được tính ngay', ...);
test('thiếu ảnh đại diện → avatarUrl null', ...);
test('thiếu data.user, hoặc thiếu userId → bỏ qua, không lỗi', ...);
test('thiếu giftDetails → bỏ qua chuỗi không được, coi là quà 0 xu', ...);
test('xu một quà không phải số → coins 0', ...);
test('userId là số hoặc bigint → chuỗi', ...);
test('roomUser → viewers', ...);  test('streamEnd → status ended', ...);  test('disconnected → status disconnected', ...);
test('stop() hai lần → disconnect() gọi một lần', ...);
test('stop() khi chưa start() → không lỗi', ...);
```

- [ ] **Step 3: Chạy** `npm test -- tiktok` → FAIL.
- [ ] **Step 4: Cài đặt `tiktok.ts`** và thay `liveFactory` trong `main.ts`: `parseTikTokTarget(target)`; có `error` → trả `{ error }`; có `handle` → `createTikTokSource(handle, h => new TikTokLiveConnection(h))`. Không truyền `signApiKey`, `session`, hay `authenticateWs`.
- [ ] **Step 5: Chạy** `npm test && npm run typecheck` → PASS toàn bộ.
- [ ] **Step 6: Kiểm tra bằng tay** với một tài khoản đang live mà chủ dự án có quyền dùng để thử: dán link `https://www.tiktok.com/@<tên>/live` → "Kết nối thật" → nhãn chuyển "Đã kết nối", `roomId` hiện ra, bình luận thật xuất hiện, ảnh đại diện thật được vẽ. Dán link rút gọn → nhãn "Lỗi" kèm hướng dẫn. Nhập tài khoản không live → nhãn "Lỗi", ứng dụng không treo. Nếu bước này thất bại vì phía TikTok hoặc máy chủ ký từ chối, ghi lại thông báo lỗi nguyên văn và báo chủ dự án.
- [ ] **Step 7: Commit** `feat: TikTok LIVE source adapter and link parsing`.
- [ ] **Step 8: Dừng.** Báo chủ dự án rằng Task 1–10 đã xong kèm kết quả `npm test`, và chờ xác nhận. Không làm Task 11.

---

### Task 11: README (do Haiku 5.5 viết, sau khi chủ dự án xác nhận Task 1–10)

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: `package.json` (tên script), `src/core/settings.ts` (tên và mặc định của 12 cài đặt), spec mục 5.3 và 5.4. Không sửa file mã nào.

- [ ] **Step 1: Viết `README.md` bằng tiếng Việt**, đúng các mục theo thứ tự:
  1. **SketchQueue LIVE** — hai câu mô tả ứng dụng làm gì.
  2. **Yêu cầu** — Node ≥ 20, Windows/macOS/Linux, một trình duyệt.
  3. **Chạy** — `npm install`, `npm start`; hai địa chỉ `http://127.0.0.1:4780/` và `http://127.0.0.1:4780/stage`; đổi cổng bằng biến môi trường `PORT`.
  4. **Nối vào phiên live** — các dạng đầu vào được nhận và dạng không được nhận (link rút gọn), lấy đúng từ spec 5.3.
  5. **Đưa sân khấu lên sóng** — thêm Browser Source trong OBS trỏ tới `/stage`, kích thước 540×960.
  6. **Diễn tập** — nút Diễn tập và hàng nút thử.
  7. **Cài đặt** — bảng 12 dòng: tên hiển thị, ý nghĩa, mặc định, khoảng cho phép. Số liệu phải khớp `src/core/settings.ts`; nếu spec và mã khác nhau thì theo mã và ghi một dòng cảnh báo ở cuối README.
  8. **Luật hàng chờ** — ưu tiên theo xu, gộp quà, độ trễ sân khấu, xin vẽ không quà, vẽ màu; mỗi luật một đến hai câu.
  9. **Phím tắt** — P, S.
  10. **Giới hạn và rủi ro** — thư viện TikTok không chính thức (spec 5.4); ứng dụng chỉ nghe trên `127.0.0.1`; các tính năng chưa có (spec 5.2).
  11. **Phát triển** — `npm test`, `npm run typecheck`, sơ đồ thư mục `src/` một dòng mỗi thư mục.
- [ ] **Step 2: Kiểm tra.** Mọi lệnh trong README tồn tại trong `package.json`. Mọi số mặc định khớp `DEFAULT_SETTINGS`. README không nhắc tên ứng dụng gốc hay tài khoản thật nào.
- [ ] **Step 3: Commit** `docs: add README`.
- [ ] **Step 4: Dừng.** Báo chủ dự án đã xong và chờ xác nhận.

---

## Kế hoạch tiếp theo (không thuộc bản này)

Mỗi mục là một kế hoạch riêng, theo spec mục 5.2: điều khiển từ điện thoại qua mạng nội bộ; lưu lịch sử; bảng quà trên sân khấu; thêm kiểu khung; chế độ đông khách; fan quay lại; sân khấu 3D; đóng gói thành một file chạy.
