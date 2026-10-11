import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// On Base44-hosted previews the Vite plugin proxies /api → the app.
// On Railway (or any external host) there is no proxy, so an empty
// serverUrl makes every auth/entity call hit the static host and fail.
// Default to the public Base44 API; override with VITE_BASE44_SERVER_URL if needed.
const serverUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BASE44_SERVER_URL) ||
  'https://base44.app';

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl,
  requiresAuth: false,
  appBaseUrl: appBaseUrl || 'https://icecreametisnot.base44.app',
});
