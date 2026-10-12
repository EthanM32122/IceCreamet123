import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// On Railway the Node server proxies /api -> https://base44.app so the browser
// never talks to Base44 with a Railway Origin (which returns "Domain is not valid").
// Empty serverUrl = same origin. Override with VITE_BASE44_SERVER_URL only if needed.
const envServer =
  typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BASE44_SERVER_URL : undefined;

const serverUrl =
  envServer !== undefined && envServer !== null && String(envServer).length > 0
    ? String(envServer)
    : ''; // same-origin /api proxy

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl,
  requiresAuth: false,
  appBaseUrl: appBaseUrl || 'https://icecreametisnot.base44.app',
});
