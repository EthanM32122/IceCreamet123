import { base44 } from '@/api/base44Client';

export const BOT_USERNAME = 'ICECREAMET Bot';
export const BOT_AVATAR_KEY = 'bot_avatar';
// Fallback used until an admin sets a custom picture.
export const DEFAULT_BOT_AVATAR = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/5c6cf25a3_1786830938521-ezgif-89c69b824b200526.gif';

export async function getBotAvatar() {
  try {
    const rows = await base44.entities.GameSettings.filter({ key: BOT_AVATAR_KEY });
    return rows[0]?.value || DEFAULT_BOT_AVATAR;
  } catch (e) {
    return DEFAULT_BOT_AVATAR;
  }
}