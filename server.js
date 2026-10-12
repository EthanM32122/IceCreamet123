// Static SPA server + Base44 API proxy for Railway.
// Browser calls same-origin /api/*; we forward to Base44 so Origin is not the
// Railway domain (which Base44 rejects with "Domain is not valid").
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const INDEX = path.join(DIST, 'index.html');

// Upstream Base44 API (override with BASE44_API_ORIGIN if needed)
const API_ORIGIN = (process.env.BASE44_API_ORIGIN || 'https://base44.app').replace(/\/$/, '');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
};

const indexHtml = fs.existsSync(INDEX)
  ? fs.readFileSync(INDEX, 'utf-8')
  : '<h1>Build the app first (npm run build)</h1>';

function proxyApi(req, res) {
  const targetUrl = API_ORIGIN + (req.url || '/api');
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ message: 'Bad proxy target' }));
  }

  const headers = { ...req.headers };
  // Do not forward the Railway host — Base44 validates domain against app config
  delete headers.host;
  delete headers.origin;
  delete headers.referer;
  headers.host = parsed.host;
  // Prefer the official app domain so Base44 accepts the request
  headers.origin = process.env.VITE_BASE44_APP_BASE_URL || 'https://icecreametisnot.base44.app';
  headers.referer = headers.origin + '/';

  const opts = {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: req.method,
    headers,
  };

  const upstream = https.request(opts, (up) => {
    const outHeaders = { ...up.headers };
    // Allow browser to read the proxied response
    outHeaders['access-control-allow-origin'] = req.headers.origin || '*';
    outHeaders['access-control-allow-credentials'] = 'true';
    res.writeHead(up.statusCode || 502, outHeaders);
    up.pipe(res);
  });

  upstream.on('error', (err) => {
    console.error('[api-proxy]', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Upstream Base44 unreachable', detail: err.message }));
    }
  });

  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const rawUrl = req.url || '/';

  // CORS preflight for /api
  if (rawUrl.startsWith('/api') && req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (rawUrl.startsWith('/api')) {
    return proxyApi(req, res);
  }

  let urlPath = decodeURIComponent(rawUrl.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(DIST, urlPath);

  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(indexHtml);
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    });
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`ICECREAMET serving on :${PORT} (API proxy -> ${API_ORIGIN})`)
);
