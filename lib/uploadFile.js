import { appParams } from '@/lib/app-params';

/**
 * Reads the current auth token fresh at call time. The `appParams` object
 * is computed once at module load, so its `token` can be stale (null) when
 * a user logs in after the page loaded. The SDK persists the token to
 * localStorage, so we read it from there to stay in sync.
 */
function getAuthToken() {
  try {
    return (
      localStorage.getItem('base44_access_token') ||
      localStorage.getItem('token') ||
      appParams.token ||
      null
    );
  } catch {
    return appParams.token || null;
  }
}

/**
 * Uploads a file to the Base44 storage.
 * Uses fetch directly (instead of base44.integrations.Core.UploadFile)
 * because the SDK sets Content-Type: multipart/form-data without the
 * boundary parameter, which prevents the server from parsing the file.
 * With fetch + FormData, the browser automatically sets the correct
 * Content-Type including the boundary.
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file, file.name);

  const headers = {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`/apps/${appParams.appId}/integration-endpoints/Core/UploadFile`, {
    method: 'POST',
    body: formData,
    headers
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return { file_url: data.file_url || data?.file_url };
}