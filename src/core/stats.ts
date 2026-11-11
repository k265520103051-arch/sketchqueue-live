import type { LiveEvent, LiveUser } from './events';

export type TopGifter = { user: LiveUser; coins: number };

export type SessionStats = {
  viewers: number;
  coins: number;
  giftCount: number;
  gifters: number;
  newFollowers: number;
  likes: number;
  comments: number;
  /** Tối đa 3, giảm dần theo coins. */
  topGifters: TopGifter[];
  /** Khoá là userId. */
  coinsByUser: Record<string, TopGifter>;
};

export const EMPTY_STATS: SessionStats = Object.freeze({
  viewers: 0,
  coins: 0,
  giftCount: 0,
  gifters: 0,
  newFollowers: 0,
  likes: 0,
  comments: 0,
  topGifters: [],
  coinsByUser: {},
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
    case 'gift': {
      const prev = s.coinsByUser[e.user.userId];
      const entry: TopGifter = { user: e.user, coins: (prev?.coins ?? 0) + e.coins };
      const coinsByUser = { ...s.coinsByUser, [e.user.userId]: entry };
      const topGifters = Object.values(coinsByUser)
        .sort((a, b) => b.coins - a.coins)
        .slice(0, 3);
      return {
        ...s,
        coins: s.coins + e.coins,
        giftCount: s.giftCount + 1,
        gifters: prev ? s.gifters : s.gifters + 1,
        coinsByUser,
        topGifters,
      };
    }
    default:
      return s;
  }
}
