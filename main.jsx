import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import initDevToolsBlock from '@/lib/devToolsBlock'
import AppErrorBoundary from '@/components/AppErrorBoundary'

initDevToolsBlock();

function isDomainErr(val) {
  try {
    const s = typeof val === 'string' ? val : JSON.stringify(val ?? '');
    return /domain is not valid/i.test(s);
  } catch {
    return false;
  }
}

// Never let Base44 domain errors blank the whole page as raw JSON.
window.addEventListener('unhandledrejection', (event) => {
  if (isDomainErr(event?.reason) || isDomainErr(event?.reason?.message) || isDomainErr(event?.reason?.data)) {
    event.preventDefault();
    console.warn('[ICECREAMET] ignored Base44 domain error');
  }
});

window.addEventListener('error', (event) => {
  if (isDomainErr(event?.message) || isDomainErr(event?.error)) {
    event.preventDefault();
    console.warn('[ICECREAMET] ignored Base44 domain error (error event)');
  }
});

// If the document body was replaced with raw JSON (some API failures),
// recover to the React app once.
try {
  const text = (document.body?.innerText || '').trim();
  if (text.startsWith('{') && /domain is not valid/i.test(text)) {
    document.body.innerHTML = '<div id="root"></div>';
  }
} catch {}

const rootEl = document.getElementById('root') || (() => {
  const d = document.createElement('div');
  d.id = 'root';
  document.body.appendChild(d);
  return d;
})();

ReactDOM.createRoot(rootEl).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
)
