// Playlist helpers for background music playlists.
// A playlist is a JSON array of YouTube video IDs. It's stored as a string on
// the player profile so it survives entity round-trips.

export const PLAYLIST_COST = 1000000; // 1,000,000 tokens to unlock the playlist
export const PLAYLIST_SLOTS = 10; // first 10 songs included
export const EXTRA_SONG_COST = 100000; // 100,000 tokens per song past the first 10

// Extract the 11-char YouTube video ID from any common YouTube URL form.
export const extractYouTubeId = (url) => {
  const m = String(url || '').match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
};

export const parsePlaylist = (raw) => {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(id => typeof id === 'string' && /^[\w-]{11}$/.test(id));
  } catch (e) {
    return [];
  }
};

export const stringifyPlaylist = (ids) => JSON.stringify(ids);

// The number of extra songs beyond the free 10 that still need paying for.
export const extraSongsToBuy = (playlist, unlocked) => {
  if (!unlocked) return playlist.length;
  return Math.max(0, playlist.length - PLAYLIST_SLOTS);
};