import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Play, Plus, SkipBack, SkipForward } from 'lucide-react';
import { useGame } from '@/lib/gameContext';
import { musicPrev, musicNext, musicSeek } from '@/lib/musicController';
import {
  PLAYLIST_COST, PLAYLIST_SLOTS, EXTRA_SONG_COST,
  extractYouTubeId, parsePlaylist, stringifyPlaylist, extraSongsToBuy
} from '@/lib/playlist';

// Lets the player create a custom background-music playlist of YouTube videos.
// Unlocking the playlist costs PLAYLIST_COST tokens; the first 10 songs are
// included, and every song past that costs EXTRA_SONG_COST tokens.
export default function PlaylistManager() {
  const { profile, updateProfile } = useGame();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const unlocked = !!profile?.playlist_unlocked;
  const songs = parsePlaylist(profile?.music_playlist);
  const tokens = profile?.tokens || 0;
  const baseSlots = Math.max(0, PLAYLIST_SLOTS - songs.length);
  const extraCount = Math.max(0, songs.length - PLAYLIST_SLOTS);
  const pendingCost = extraCount > 0 ? extraCount * EXTRA_SONG_COST : 0;
  const canTopUpToplaist = pendingCost > 0;

  // Recompute how much it'd cost to add this new song right now.
  const nextIndex = songs.length;
  const nextIsExtra = nextIndex >= PLAYLIST_SLOTS;
  const addCost = nextIsExtra ? EXTRA_SONG_COST : 0;

  const unlockPlaylist = async () => {
    if (busy || unlocked) return;
    if (tokens < PLAYLIST_COST) { alert(`You need ${PLAYLIST_COST.toLocaleString()} tokens to unlock a music playlist.`); return; }
    setBusy(true);
    try {
      await updateProfile({ playlist_unlocked: true, tokens: tokens - PLAYLIST_COST });
    } catch (e) {
      alert('Failed to unlock playlist: ' + (e.message || 'unknown error'));
    }
    setBusy(false);
  };

  const payForExtras = async () => {
    if (busy || !canTopUpToplaist) return;
    const cost = extraCount * EXTRA_SONG_COST;
    if (tokens < cost) { alert(`You need ${cost.toLocaleString()} tokens to keep ${extraCount} extra song${extraCount > 1 ? 's' : ''}.`); return; }
    setBusy(true);
    try {
      await updateProfile({ tokens: tokens - cost });
      alert(`Paid ${cost.toLocaleString()} tokens for ${extraCount} extra song${extraCount > 1 ? 's' : ''}.`);
    } catch (e) {
      alert('Payment failed: ' + (e.message || 'unknown error'));
    }
    setBusy(false);
  };

  const addSong = async () => {
    if (busy) return;
    const id = extractYouTubeId(url);
    if (!id) { alert('Please paste a valid YouTube URL.'); return; }
    if (songs.includes(id)) { alert('That song is already in your playlist.'); return; }
    if (nextIsExtra) {
      if (tokens < EXTRA_SONG_COST) { alert(`You need ${EXTRA_SONG_COST.toLocaleString()} tokens to add a song past your first ${PLAYLIST_SLOTS}.`); return; }
    }
    setBusy(true);
    const next = [...songs, id];
    const tokensAfter = nextIsExtra ? tokens - EXTRA_SONG_COST : tokens;
    try {
      await updateProfile({ music_playlist: stringifyPlaylist(next), tokens: tokensAfter });
      setUrl('');
    } catch (e) {
      alert('Failed to add song: ' + (e.message || 'unknown error'));
    }
    setBusy(false);
  };

  const removeSong = async (idx) => {
    if (busy) return;
    setBusy(true);
    const next = songs.filter((_, i) => i !== idx);
    try {
      await updateProfile({ music_playlist: stringifyPlaylist(next) });
    } catch (e) {
      alert('Failed to remove song: ' + (e.message || 'unknown error'));
    }
    setBusy(false);
  };

  if (!profile) return null;

  return (
    <div className="bg-panel rounded-2xl border border-white/10 p-4 md:col-span-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🎧</span>
        <h3 className="font-display text-white">Music Playlist</h3>
        {unlocked && <span className="ml-auto text-[10px] uppercase rounded bg-[#a7fcc9]/20 text-[#a7fcc9] px-2 py-0.5">Unlocked</span>}
      </div>

      {!unlocked ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-white/70">
            Create a playlist of YouTube songs for your background music. Every song plays in order, then the next one starts automatically.
            Unlock for <span className="text-[#a7fcc9] font-display">{PLAYLIST_COST.toLocaleString()}</span> tokens (your first {PLAYLIST_SLOTS} songs included).
          </p>
          <Button size="sm" onClick={unlockPlaylist} disabled={busy || tokens < PLAYLIST_COST} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
            {busy ? 'Unlocking...' : `Unlock for ${PLAYLIST_COST.toLocaleString()}`}
          </Button>
        </div>
      ) : (
        <>
          {/* Now playing / skip controls */}
          {songs.length > 0 && (
            <div className="flex items-center gap-2 bg-white/5 rounded-lg px-2 py-2 mb-3">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-[#a7fcc9]" onClick={musicPrev} title="Previous song"><SkipBack size={16} /></Button>
              <div className="flex-1 min-w-0 text-center">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Now Playing</p>
                <p className="text-xs text-white/80 truncate font-display">Change it below — tap any song to play it</p>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-white/70 hover:text-[#a7fcc9]" onClick={musicNext} title="Next song"><SkipForward size={16} /></Button>
            </div>
          )}

          {/* Song list — tap a row to jump to that song */}
          <div className="space-y-1.5 mb-3">
            {songs.length === 0 && (
              <p className="text-xs text-white/50 py-2">No songs yet — add a YouTube URL below.</p>
            )}
            {songs.map((id, i) => (
              <button
                key={id + i}
                onClick={() => musicSeek(i)}
                className="w-full flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-lg px-2 py-1.5 transition-colors text-left"
                title={`Play ${id}`}
              >
                <span className="text-white/40 font-display text-xs w-5">{i + 1}</span>
                <img src={`https://img.youtube.com/vi/${id}/default.jpg`} alt="" className="w-10 h-7 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 truncate">youtu.be/{id}</p>
                  {i >= PLAYLIST_SLOTS && (
                    <span className="text-[9px] text-[#a7fcc9]">Extra slot</span>
                  )}
                </div>
                <Play size={14} className="text-[#a7fcc9] shrink-0" />
                <span onClick={e => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-white/50 hover:text-red-400" onClick={() => removeSong(i)} disabled={busy}><X size={12} /></Button>
                </span>
              </button>
            ))}
          </div>

          {/* Extras payment reminder */}
          {extraCount > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 mb-3 flex items-center justify-between gap-2">
              <p className="text-[11px] text-yellow-300">
                {extraCount} extra song{extraCount > 1 ? 's' : ''} past your {PLAYLIST_SLOTS}: needs {pendingCost.toLocaleString()} tokens.
              </p>
              <Button size="sm" variant="outline" onClick={payForExtras} disabled={busy || tokens < pendingCost} className="border-yellow-400/40 text-yellow-300">
                {busy ? 'Paying...' : `Pay ${pendingCost.toLocaleString()}`}
              </Button>
            </div>
          )}

          {/* Add song */}
          <div>
            <p className="text-xs text-white/50 mb-1">
              Add a song ({songs.length}/{PLAYLIST_SLOTS} free){nextIsExtra ? ` — next costs ${EXTRA_SONG_COST.toLocaleString()} tokens` : ''}
            </p>
            <div className="flex gap-2">
              <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="bg-white/10 border-white/20 text-white placeholder:text-white/40" />
              <Button size="sm" onClick={addSong} disabled={busy || !url.trim() || (nextIsExtra && tokens < EXTRA_SONG_COST)} style={{ backgroundColor: '#a7fcc9', color: 'rgb(var(--user-sidebar))' }}>
                <Plus size={14} className="mr-1" /> Add{nextIsExtra ? ` (${EXTRA_SONG_COST.toLocaleString()})` : ''}
              </Button>
            </div>
            <p className="text-[10px] text-white/40 mt-2">Your balance: {(profile?.tokens || 0).toLocaleString()} tokens</p>
          </div>
        </>
      )}
    </div>
  );
}