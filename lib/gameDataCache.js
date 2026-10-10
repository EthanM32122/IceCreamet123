import { base44 } from '@/api/base44Client';

// Shared, TTL-cached game data reads.
// Home, Stats, Bazaar, and Blooks each used to re-read all blooks / packs / banners
// on every mount; sharing one cached read cuts aggregate entity-read volume.
const TTL = 120000;
const _cache = {};

async function getCached(key, loader) {
  const entry = _cache[key];
  const now = Date.now();
  if (entry && now - entry.ts < TTL) return entry.data;
  if (entry?.pending) return entry.pending;
  entry && (entry.pending = loader().then(data => {
    _cache[key] = { data, ts: Date.now(), pending: null };
    return data;
  }).catch(e => {
    if (_cache[key]) _cache[key].pending = null;
    throw e;
  }));
  if (!entry) {
    _cache[key] = { data: null, ts: 0, pending: null };
    _cache[key].pending = loader().then(data => {
      _cache[key] = { data, ts: Date.now(), pending: null };
      return data;
    }).catch(e => {
      if (_cache[key]) _cache[key].pending = null;
      throw e;
    });
  }
  return _cache[key].pending;
}

export const getActiveBlooks = (game = 'icecreamet') =>
  getCached(`blooks:${game}`, () => base44.entities.Blook.filter({ is_active: true, game }));

export const getPacks = (game = 'icecreamet') =>
  getCached(`blooks-packs:${game}`, () => base44.entities.Pack.filter({ game }, 'order'));

export const getActiveBanners = () =>
  getCached('banners', () => base44.entities.Banner.filter({ is_active: true }));

export const getBadges = () =>
  getCached('badges', () => base44.entities.Badge.filter({}));

export const getPlayerBadges = () =>
  getCached('player-badges', () => base44.entities.PlayerBadge.filter({}));

export const getClans = () =>
  getCached('clans', () => base44.entities.Clan.filter({}));

export const getClanMembers = () =>
  getCached('clan-members', () => base44.entities.ClanMember.filter({}));

export const getAllBlooks = (game = 'icecreamet') =>
  getCached(`all-blooks:${game}`, () => base44.entities.Blook.filter({ is_deleted: false, game }));

export function invalidateGameData() {
  for (const k of Object.keys(_cache)) delete _cache[k];
}