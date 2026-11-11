import type { Command, SessionState } from '../core/session';

/** Thông điệp trình duyệt → máy chủ qua WebSocket `/ws`. */
export type ClientMsg =
  | { type: 'command'; command: Command }
  | { type: 'connect'; mode: 'rehearsal' | 'live'; target?: string }
  | { type: 'disconnect' }
  | { type: 'test'; kind: 'gift' | 'comment' | 'likes'; handle: string; arg: string; count: number };

/** Thông điệp máy chủ → trình duyệt. */
export type ServerMsg = { type: 'state'; state: SessionState };
