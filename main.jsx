import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import initDevToolsBlock from '@/lib/devToolsBlock'
import AppErrorBoundary from '@/components/AppErrorBoundary'

initDevToolsBlock();

// If Base44 (or anything else) throws before React paints, replace body with a
// friendly screen instead of a black page full of JSON.
window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event?.reason?.message || event?.reason || '');
  if (/domain is not valid/i.test(msg)) {
    event.preventDefault();
    console.warn('[ICECREAMET] ignored Base44 domain error:', msg);
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
)
