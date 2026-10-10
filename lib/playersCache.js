import { base44 } from '@/api/base44Client';

// Shared, TTL-cached "all players" list.
// Stats, Chat, and Leaderboard each used to do a full PlayerProfile.filter({}) on
// every mount; sharing one cached read cuts aggregate entity-read volume sharply.
let _cache = { data: null, ts: 0, pending: null };
const TTL = 60000;

export async function getAllPlayers() {
  const now = Date.now();
  if (_cache.data && now - _cache.ts < TTL) return _cache.data;
  if (_cache.pending) return _cache.pending;
  _cache.pending = base44.entities.PlayerProfile.filter({}).then((data) => {
    _cache.data = data;
    _cache.ts = Date.now();
    _cache.pending = null;
    return data;
  }).catch((e) => {
    _cache.pending = null;
    throw e;
  });
  return _cache.pending;
}

export function invalidatePlayers() {
  _cache.data = null;
  _cache.ts = 0;
}