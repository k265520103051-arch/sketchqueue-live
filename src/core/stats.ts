import type { LiveEvent } from './events';

export type SessionStats = {
  viewers: number;
  coins: number;
  giftCount: number;
  /** Số người tặng; Session tự đếm bằng Set userId, reduceStats không đụng tới. */
  gifters: number;
  newFollowers: number;
  likes: number;
  comments: number;
};

export const EMPTY_STATS: SessionStats = Object.freeze({
  viewers: 0,
  coins: 0,
  giftCount: 0,
  gifters: 0,
  newFollowers: 0,
  likes: 0,
  comments: 0,
}) as SessionStats;

export function reduceStats(s: SessionStats, e: LiveEvent): SessionStats {
  switch (e.type) {
    case 'viewers':
      return { ...s, viewers: e.count };
    case 'like':
      return { ...s, likes: s.likes + e.count };
    case 'follow':
      return { ...s, newFollowers: s.newFollowers + 1 };
    case 'comment':
      return { ...s, comments: s.comments + 1 };
    case 'gift':
      return { ...s, coins: s.coins + e.coins, giftCount: s.giftCount + 1 };
    default:
      return s;
  }
}
