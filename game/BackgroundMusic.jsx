import React, { useEffect, useRef } from 'react';
import { useGame } from '@/lib/gameContext';
import { parsePlaylist } from '@/lib/playlist';
import { setMusicCommands } from '@/lib/musicController';

// Background music. Three modes:
//   1) Playlist — if the player unlocked one and it has songs, the YouTube
//      IFrame Player API plays them in order, auto-advancing on ENDED.
//   2) Single custom video — the legacy single-song loop.
//   3) Ambient — generated notes via Web Audio when nothing is set.
//
// The YouTube player is created ONCE and reused across re-renders by calling
// loadVideoById / nextVideo. The old approach mounted an <iframe> React
// element whose src changed on every profile update, which under lag could
// spin up a second playback and layer the song on top of itself. A single
// YT.Player instance with an explicit id-driven load fixes that.
export default function BackgroundMusic() {
  const { profile } = useGame();
  const ctxRef = useRef(null);
  const masterGainRef = useRef(null);
  const intervalRef = useRef(null);
  const playingRef = useRef(false);

  // YouTube IFrame API state
  const ytReadyRef = useRef(false); // YT API script loaded
  const playerRef = useRef(null); // YT.Player instance
  const playerDivRef = useRef(null);
  const idxRef = useRef(0); // current index in the playlist

  const ytId = profile?.custom_music_yt_id;
  const playlist = parsePlaylist(profile?.music_playlist);
  const hasPlaylist = !!profile?.playlist_unlocked && playlist.length > 0;
  const enabled = profile?.music_enabled !== false;

  // --- Ambient fallback (no custom music at all) ---
  useEffect(() => {
    const shouldPlay = enabled && !ytId && !hasPlaylist;
    if (shouldPlay && !playingRef.current) {
      startAmbient();
      playingRef.current = true;
    } else if (!shouldPlay && playingRef.current) {
      stopAmbient();
      playingRef.current = false;
    }
    return () => {
      stopAmbient();
      playingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ytId, hasPlaylist]);

  // --- Load the YouTube IFrame API once ---
  useEffect(() => {
    if (!enabled || (!ytId && !hasPlaylist)) return;
    if (window.YT && window.YT.Player) {
      ytReadyRef.current = true;
      return;
    }
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => {
      ytReadyRef.current = true;
    };
  }, [enabled, ytId, hasPlaylist]);

  // --- Drive the player based on the current profile ---
  useEffect(() => {
    if (!enabled || (!ytId && !hasPlaylist)) {
      // Tear down the player when music is off / no source.
      destroyPlayer();
      return;
    }

    // Wait until the YT API is ready, then build the player.
    if (!ytReadyRef.current || !window.YT?.Player) {
      const wait = setInterval(() => {
        if (ytReadyRef.current && window.YT?.Player) {
          clearInterval(wait);
          ensurePlayer();
        }
      }, 200);
      return () => clearInterval(wait);
    }
    ensurePlayer();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ytId, hasPlaylist, profile?.music_playlist]);

  // Create the hidden player div once. The YT.Player mounts into it.
  function ensurePlayer() {
    if (!playerDivRef.current) {
      const div = document.createElement('div');
      div.id = 'bg-music-yt-player';
      div.style.cssText = 'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;border:none;';
      document.body.appendChild(div);
      playerDivRef.current = div;
    }
    if (playerRef.current) {
      loadCurrent();
      return;
    }
    try {
      playerRef.current = new window.YT.Player('bg-music-yt-player', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1, disablekb: 1, fs: 0 },
        events: {
          onReady: () => loadCurrent(),
          onStateChange: (e) => {
            // ENDED (0) — advance to the next song in the playlist.
            if (e.data === 0) {
              if (hasPlaylist) {
                idxRef.current = (idxRef.current + 1) % playlist.length;
                loadCurrent();
              } else if (ytId) {
                // Single-song loop: restart.
                loadCurrent();
              }
            }
          },
          onError: () => {
            // Skip to next song if the current one fails (e.g. region-blocked).
            if (hasPlaylist) {
              idxRef.current = (idxRef.current + 1) % playlist.length;
              loadCurrent();
            }
          }
        }
      });
    } catch (e) {}
  }

  function loadCurrent() {
    const p = playerRef.current;
    if (!p || typeof p.loadVideoById !== 'function') return;
    if (hasPlaylist && playlist.length > 0) {
      const id = playlist[idxRef.current % playlist.length];
      try { p.loadVideoById({ videoId: id }); } catch (e) {}
    } else if (ytId) {
      try { p.loadVideoById({ videoId: ytId }); } catch (e) {}
    }
  }

  // Manual skip controls exposed to the Settings playlist UI. If there's no
  // playlist, next/prev act as a replay of the single custom song.
  const goPrev = () => {
    if (!playerRef.current) return;
    if (hasPlaylist && playlist.length > 0) {
      idxRef.current = (idxRef.current - 1 + playlist.length) % playlist.length;
      loadCurrent();
    } else if (ytId) {
      loadCurrent();
    }
  };
  const goNext = () => {
    if (!playerRef.current) return;
    if (hasPlaylist && playlist.length > 0) {
      idxRef.current = (idxRef.current + 1) % playlist.length;
      loadCurrent();
    } else if (ytId) {
      loadCurrent();
    }
  };
  const goSeek = (index) => {
    if (!playerRef.current || !hasPlaylist || playlist.length === 0) return;
    idxRef.current = ((index % playlist.length) + playlist.length) % playlist.length;
    loadCurrent();
  };

  // Register these so the PlaylistManager can drive the live player.
  useEffect(() => {
    setMusicCommands({ prev: goPrev, next: goNext, seek: goSeek });
    return () => setMusicCommands(null);
  });

  function destroyPlayer() {
    if (playerRef.current) {
      try { playerRef.current.destroy && playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
    }
    if (playerDivRef.current && playerDivRef.current.parentNode) {
      playerDivRef.current.parentNode.removeChild(playerDivRef.current);
    }
    playerDivRef.current = null;
    idxRef.current = 0;
  }

  // --- Ambient music (unchanged from the original implementation) ---
  const startAmbient = () => {
    try {
      if (!ctxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctxRef.current = new AC();
        masterGainRef.current = ctxRef.current.createGain();
        masterGainRef.current.gain.value = 0.05;
        masterGainRef.current.connect(ctxRef.current.destination);
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
      const playNote = () => {
        const ctx = ctxRef.current;
        if (!ctx || ctx.state === 'closed') return;
        const freq = notes[Math.floor(Math.random() * notes.length)];
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 1800;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.4, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 3);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainRef.current);
        osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
        osc.start(now);
        osc.stop(now + 3);
        if (Math.random() > 0.55) {
          const hOsc = ctx.createOscillator();
          const hGain = ctx.createGain();
          hOsc.type = 'sine';
          hOsc.frequency.value = freq * 1.5;
          hGain.gain.setValueAtTime(0, now + 0.1);
          hGain.gain.linearRampToValueAtTime(0.2, now + 0.7);
          hGain.gain.linearRampToValueAtTime(0, now + 3);
          hOsc.connect(hGain);
          hGain.connect(masterGainRef.current);
          hOsc.onended = () => { hOsc.disconnect(); hGain.disconnect(); };
          hOsc.start(now + 0.1);
          hOsc.stop(now + 3);
        }
      };
      // 1500ms instead of 900ms — halves the rate of Web Audio node creation
      // and GC, which runs continuously on every page for users on the default
      // ambient soundtrack. The notes still overlap pleasantly at this pace.
      intervalRef.current = setInterval(playNote, 1500);
    } catch (e) {}
  };

  const stopAmbient = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (masterGainRef.current && ctxRef.current && ctxRef.current.state !== 'closed') {
      try {
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 0.5);
      } catch (e) {}
    }
  };

  // Clean up the player on unmount.
  useEffect(() => {
    return () => destroyPlayer();
  }, []);

  // Nothing rendered visually — the player div is created in the DOM directly.
  return null;
}