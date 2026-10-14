# Firebase deploy (IceCreamet)

Project: **icecreamet-85a3c**

## One-time setup (on your PC)

```bash
npm install -g firebase-tools
firebase login
```

Confirm the project:

```bash
firebase use icecreamet-85a3c
```

## Build + deploy Hosting

From the repo root:

```bash
npm install
npm run build
firebase deploy --only hosting
```

After deploy, your site is at:

- https://icecreamet-85a3c.web.app
- https://icecreamet-85a3c.firebaseapp.com

## Notes

- Hosting serves the Vite `dist/` folder (SPA rewrites → `index.html`).
- Game data/auth still go through Base44 unless you migrate them.
- Optional: `npm install firebase` then import `initFirebaseAnalytics` from `lib/firebase.js` in `main.jsx` for Analytics.

## Firebase console

https://console.firebase.google.com/project/icecreamet-85a3c/overview
