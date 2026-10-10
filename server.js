// Minimal static-file server for the ICECREAMET frontend (SPA).
// Used when deploying the built app to Railway. The app's data, auth,
// and backend functions still run on Base44's hosted backend — the SDK
// (src/api/base44Client) calls Base44's cloud API over HTTPS, so this
// static build only needs to serve the compiled Vite output.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DIST = path.join(__dirname, 'dist');
const INDEX = path.join(DIST, 'index.html');

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
  '.map': 'application/json'
};

const indexHtml = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf-8') : '<h1>Build the app first (npm run build)</h1>';

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const filePath = path.join(DIST, urlPath);

  // Prevent path traversal outside dist.
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback: any unknown route serves index.html so client-side
      // routing (react-router) can handle it.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end(indexHtml);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ICECREAMET frontend serving on :${PORT}`));