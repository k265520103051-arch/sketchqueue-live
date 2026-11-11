export type LiveUser = { userId: string; handle: string; nickname: string; avatarUrl: string | null };

export type ConnState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'ended' | 'error';

export type LiveEvent =
  | { type: 'comment'; user: LiveUser; text: string; at: number }
  // coins = tổng xu của cả chuỗi quà
  | { type: 'gift'; user: LiveUser; giftName: string; coins: number; count: number; at: number }
  | { type: 'like'; user: LiveUser; count: number; at: number }
  | { type: 'join'; user: LiveUser; at: number }
  | { type: 'follow'; user: LiveUser; at: number }
  | { type: 'viewers'; count: number; at: number }
  | { type: 'status'; state: ConnState; roomId?: string; message?: string; at: number };

export interface LiveSource {
  start(): Promise<void>;
  /** Gọi nhiều lần không lỗi. */
  stop(): Promise<void>;
  /** Trả về hàm huỷ đăng ký. */
  onEvent(cb: (e: LiveEvent) => void): () => void;
}
