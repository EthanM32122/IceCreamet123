// Fallback if prepare-src cannot download the original Chat.
// On Railway/build, scripts/prepare-src.mjs overwrites this file with the
// full original UI + live message patches before vite build.
export { default } from './ChatView';
