# Deploy ICECREAMET to Railway

This repo keeps frontend source at the **root** (`pages/`, `ui/`, `App.jsx`, …).
On every build, `scripts/prepare-src.mjs` copies that into a standard `src/` tree Vite expects, then runs `vite build`. `server.js` serves the `dist/` folder.

## 1. Connect the repo

1. Open [Railway](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select **EthanM32122/IceCreamet123**
3. Use branch **main**

## 2. Environment variables

In the service → **Variables**, add:

| Name | Value |
|------|--------|
| `VITE_BASE44_APP_ID` | your Base44 app id |
| `VITE_BASE44_APP_BASE_URL` | `https://icecreametisnot.base44.app` |

These must be set **before** build (Vite bakes them into the client).

## 3. Build / start (already in `railway.json`)

- **Build:** `npm install --include=dev && npm run build`
  - runs `prepare-src` then `vite build` → creates `dist/`
- **Start:** `node server.js`
- **Healthcheck:** `/`

You do **not** need to change the root directory.

## 4. Redeploy

After every push to `main`, Railway rebuilds automatically.
If a build fails, open the deploy log and look for lines after:

```text
[prepare-src] done
vite v… building for production…
```

## Layout (do not move these by hand)

```text
repo root
├── index.html          # points at /src/main.jsx
├── package.json        # build = prepare-src + vite build
├── vite.config.js      # @ → ./src
├── server.js           # serves dist/
├── railway.json
├── scripts/prepare-src.mjs
├── App.jsx, main.jsx, index.css
├── pages/, lib/, api/, hooks/
├── ui/, game/, minigames/, stats/
└── functions/          # Base44 backend (runs on Base44, not Railway)
```

Generated at build time (gitignored):

```text
src/     # assembled by prepare-src
dist/    # Vite output, served by server.js
```

## Optional: Docker builder

If you prefer Docker, set Railway builder to **Dockerfile** (see `Dockerfile` in the repo).
