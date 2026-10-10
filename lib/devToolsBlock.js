// Blocks common ways players open browser DevTools / inspect elements on
// ICECREAMET. This is a deterrent, not real security — a determined user can
// always bypass it — but it stops the casual Ctrl+Shift+I / right-click route.
export default function initDevToolsBlock() {
  // Block the inspect shortcut combinations (Ctrl/⌘ + Shift + I/J/C, Ctrl/⌘+U, F12).
  const blockKeys = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod && e.key !== 'F12') return;
    const k = (e.key || '').toLowerCase();
    if (e.key === 'F12' || (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||
        (mod && k === 'u')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };
  document.addEventListener('keydown', blockKeys, true);

  // Right-click is intentionally allowed — players can use the context menu.
  // Inspect is still blocked via the keyboard shortcuts above so casual
  // DevTools access (Ctrl+Shift+I/J/C, F12, Ctrl+U) stays disabled.

  // Discourage viewing page source via drag-select of the URL bar target isn't
  // possible, so also block Ctrl+S (save page) and Ctrl+P (print) quietly.
  const blockSavePrint = (e) => {
    if (e.ctrlKey || e.metaKey) {
      const k = (e.key || '').toLowerCase();
      if (k === 's' || k === 'p') {
        e.preventDefault();
      }
    }
  };
  document.addEventListener('keydown', blockSavePrint, true);
}