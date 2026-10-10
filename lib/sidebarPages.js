import { base44 } from '@/api/base44Client';

export const SIDEBAR_PAGES = [
  { path: '/stats', label: 'Stats' },
  { path: '/chat', label: 'Chat' },
  { path: '/market', label: 'Market' },
  { path: '/blooks', label: 'Blooks' },
  { path: '/craft', label: 'Craft' },
  { path: '/leaderboard', label: 'Leaderboard' },
  { path: '/bazaar', label: 'Bazaar' },
  { path: '/clans', label: 'Clans' },
  { path: '/trade', label: 'Trade' },
  { path: '/auctions', label: 'Auction House' },
  { path: '/minigames', label: 'Minigames' },
  { path: '/hivelands', label: 'Hivelands' },
  { path: '/mines', label: 'Mines' },
  { path: '/invites', label: 'Invites' },
  { path: '/settings', label: 'Settings' },
];

export const getHiddenPages = async () => {
  try {
    const rows = await base44.entities.GameSettings.filter({ key: 'hidden_sidebar_pages' });
    if (rows.length === 0) return [];
    return JSON.parse(rows[0].value || '[]');
  } catch {
    return [];
  }
};

export const setHiddenPages = async (pages) => {
  const value = JSON.stringify(pages);
  const rows = await base44.entities.GameSettings.filter({ key: 'hidden_sidebar_pages' });
  if (rows.length === 0) {
    await base44.entities.GameSettings.create({ key: 'hidden_sidebar_pages', value, category: 'general' });
  } else {
    await base44.entities.GameSettings.update(rows[0].id, { value });
  }
};