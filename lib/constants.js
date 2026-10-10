export const RARITY_ORDER = ['uncommon', 'rare', 'epic', 'legendary', 'chroma', 'supreme', 'mythical', 'iridescent', 'unique', 'icecreamacle', 'paradox', 'elite'];

export const RARITY_COLORS = {
  uncommon: '#4ade80',
  rare: '#60a5fa',
  epic: '#a855f7',
  legendary: '#f59e0b',
  mythical: '#f472b6',
  chroma: '#00ccFF',
  supreme: '#ef4444',
  iridescent: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3, #54a0ff)',
  unique: 'linear-gradient(90deg, #0099cc, #00ff99)',
  icecreamacle: 'linear-gradient(90deg, #a7fcc9, #5ee7c0, #34d399, #2bb673)',
  paradox: 'linear-gradient(90deg, #3b82f6, #ef4444, #a855f7)',
  elite: 'linear-gradient(90deg, #ff0000, #ff5500, #ff0033)'
};

export const RARITY_BG = {
  uncommon: 'bg-green-400/20',
  rare: 'bg-blue-400/20',
  epic: 'bg-purple-400/20',
  legendary: 'bg-amber-400/20',
  mythical: 'bg-pink-400/20',
  chroma: 'bg-cyan-400/20',
  supreme: 'bg-red-400/20',
  iridescent: 'bg-pink-400/20',
  unique: 'bg-cyan-400/20',
  icecreamacle: 'bg-emerald-300/20',
  paradox: 'bg-indigo-400/20',
  elite: 'bg-red-500/20'
};

export const SELL_PRICES = {
  uncommon: 5,
  rare: 20,
  epic: 75,
  legendary: 200,
  chroma: 300,
  supreme: 350,
  mythical: 750,
  iridescent: 5000,
  unique: 400,
  icecreamacle: 10000,
  paradox: 25000,
  elite: 100000
};

export const BLOOK_SCORE_POINTS = {
  uncommon: 5,
  rare: 20,
  epic: 50,
  legendary: 100,
  chroma: 200,
  supreme: 300,
  mythical: 500,
  icecreamacle: 600,
  unique: 400,
  iridescent: 1000,
  paradox: 5000,
  elite: 10000
};

export const RARITY_DROP_RATES = {
  uncommon: 19.5,
  rare: 10,
  epic: 2.5,
  legendary: 0.7,
  chroma: 0.04,
  supreme: 0.02,
  mythical: 0.005,
  iridescent: 0.001,
  unique: 0.0008,
  icecreamacle: 0.0025,
  paradox: 0.005,
  elite: 0.005
};

export const ROLE_HIERARCHY = {
  player: 0,
  helper: 1,
  moderator: 2,
  biggie: 2,
  admin: 3,
  'co-owner': 4,
  'executive-manager': 5,
  owner: 6
};

export const ROLE_COLORS = {
  player: '#a7fcc9',
  helper: '#ec4899',
  moderator: '#60a5fa',
  biggie: '#FFD700',
  admin: '#f59e0b',
  'co-owner': '#ef4444',
  'executive-manager': '#6366f1',
  owner: '#a855f7'
};

export const ROLE_BADGES = {
  player: '🎮',
  helper: '🤝',
  moderator: '🛡️',
  biggie: '🍔',
  admin: '⚡',
  'co-owner': '👑',
  'executive-manager': '📊',
  owner: '💎'
};

// Badge IDs for auto-grant logic
export const STAFF_BADGE_ID = '6a70369a2bb39efd4ca5de46';
export const ADVERTISER_BADGE_ID = '6a893eccb03217bf489b79eb';
export const I90_BADGE_ID = '6ac82627b0b132fa77779acf';
export const COOLKIDS_BADGE_ID = '6ac82627b0b132fa77779ad0';
export const HELPER_BADGE_ID = '6ac82627b0b132fa77779ad1';
export const ACTIVE_BADGE_ID = '6ac82627b0b132fa77779ad2';
export const EXECUTIVE_MANAGER_BADGE_ID = '6ac82627b0b132fa77779ad3';

export const VERIFIED_BADGE_ID = '6a7fbf768ac060a75bdaf573';
export const PLUS_BADGE_ID = '6a8a50a35d48898fb1742efa';
export const BANNED_WORDS = ['nigger', 'nigga', 'nig', 'igga'];

export const ICECREAMETUBER_BADGE_ID = '6a70dac37496cf605b134953';
export const ARTIST_BADGE_ID = '6a6880d96a634bd0eba502c0';

// Award trophy blooks — granted automatically when requirements are met
export const TROPHY_BLOOKS = {
  blook: '6a8d1186f4b81699fe601446',          // own every blook
  verified: '6a8d1186f4b81699fe601447',        // own the Verified badge
  icecreametuber: '6a8d1186f4b81699fe601448',  // own the Icecreametuber badge
  artist: '6a8d1186f4b81699fe601449'           // own the Artist badge
};

// Pokelet collection reward — granted when a user owns 90% of all Pokelet blooks
export const MEGA_CHARIZARD_BLOOK_ID = '6a975fa62887ab237770be04';

// Pokelet ultimate collection reward — granted when a user owns 100% of all Pokelet blooks
export const MEGA_DARKRAI_BLOOK_ID = '6a98dcd9ef111773cddef7a0';

// Diamond economy
export const DIAMOND_PACK_COST = 15;        // diamonds per pack when paying with diamonds
export const DIAMOND_PACK_LUCK = 2;         // additive luck multiplier when paying with diamonds
export const COINS_PER_DIAMOND = 10000;     // convert coins -> diamonds
export const DIAMOND_CAP = 25000000;        // anti-cheat cap (same idea as the token cap)

// VIP users who receive a copy of every card pulled during bulk opens
export const VIP_BULK_RECEIVERS = [
  '6a99b529fd54567710eb02d5', // minion
  '6a96d0c802fe3d941536ffe2', // Phantom_Grip
];

export const PLACEHOLDER_BLOOK_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/0d5e6b887_image.png';
export const ERROR_BLOOK_IMG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/5ef35a7cd_image.png';