// Tiny module-level controller that lets the PlaylistManager (Settings) command
// the BackgroundMusic player. BackgroundMusic registers its live controls here;
// the UI calls prev/next/seek. Kept out of React state so re-renders never
// recreate the actual playback.
let commands = null;

export const setMusicCommands = (c) => { commands = c; };
export const getMusicCommands = () => commands;

// Convenience helpers the UI can call directly (no-op if the player isn't live).
export const musicPrev = () => commands?.prev && commands.prev();
export const musicNext = () => commands?.next && commands.next();
export const musicSeek = (index) => commands?.seek && commands.seek(index);