import { SELL_PRICES } from '@/lib/constants';

// 5% chance a pulled blook is shiny (same blook, 10x sell value, special visual)
export const SHINY_CHANCE = 0.05;
export const SHINY_SELL_MULT = 10;
// Paying with diamonds boosts the shiny chance by 1.9x.
export const DIAMOND_SHINY_MULT = 1.9;

// Every blook from market packs can roll shiny
export const isShinyExcluded = (pack, blook) => false;

// shinyMult multiplies the base shiny chance (e.g. 1.9x when paying with diamonds).
export const rollShiny = (pack, blook, shinyMult = 1) => {
  if (isShinyExcluded(pack, blook)) return false;
  return Math.random() < (SHINY_CHANCE * shinyMult);
};

export const shinySellPrice = (blook) => {
  const base = blook?.sell_price || SELL_PRICES[blook?.rarity] || 5;
  return base * SHINY_SELL_MULT;
};

// Shiny blooks sell for DIAMONDS (not tokens), based on rarity.
export const SHINY_DIAMOND_VALUES = {
  uncommon: 0.5,
  rare: 0.7,
  epic: 0.9,
  legendary: 2,
  chroma: 5,
  mythical: 10,
  iridescent: 50,
  unique: 40,
  icecreamacle: 25,
  elite: 100
};

export const shinyDiamondValue = (blook) => {
  return SHINY_DIAMOND_VALUES[blook?.rarity] || 0;
};

// Shiny visual themes (Plus-only customization). The CSS class is applied to a
// wrapper (body for the whole app, a div for live previews) and styles every
// `.shiny-blook` inside it. `gold` is the default and uses no extra class.
export const SHINY_THEMES = [
  { id: 'gold', name: 'Gold', class: '' },
  { id: 'neon', name: 'Neon', class: 'shiny-theme-neon' },
  { id: 'inverted', name: 'Inverted', class: 'shiny-theme-inverted' },
  { id: 'radioactive', name: 'Radioactive', class: 'shiny-theme-radioactive' },
  { id: 'rainbow', name: 'Rainbow', class: 'shiny-theme-rainbow' },
  { id: 'ice', name: 'Ice', class: 'shiny-theme-ice' },
  { id: 'fire', name: 'Fire', class: 'shiny-theme-fire' },
  { id: 'shadow', name: 'Shadow', class: 'shiny-theme-shadow' },
  { id: 'galaxy', name: 'Galaxy', class: 'shiny-theme-galaxy' },
  { id: 'ocean', name: 'Ocean', class: 'shiny-theme-ocean' },
  { id: 'sunset', name: 'Sunset', class: 'shiny-theme-sunset' },
  { id: 'mint', name: 'Mint', class: 'shiny-theme-mint' },
  { id: 'rose', name: 'Rose', class: 'shiny-theme-rose' },
  { id: 'electric', name: 'Electric', class: 'shiny-theme-electric' },
  { id: 'void', name: 'Void', class: 'shiny-theme-void' },
  { id: 'crystal', name: 'Crystal', class: 'shiny-theme-crystal' },
  { id: 'toxic', name: 'Toxic', class: 'shiny-theme-toxic' },
  { id: 'candy', name: 'Candy', class: 'shiny-theme-candy' },
  { id: 'cosmic', name: 'Cosmic', class: 'shiny-theme-cosmic' },
  { id: 'emerald', name: 'Emerald', class: 'shiny-theme-emerald' },
  { id: 'sapphire', name: 'Sapphire', class: 'shiny-theme-sapphire' },
  { id: 'ruby', name: 'Ruby', class: 'shiny-theme-ruby' },
  { id: 'amber', name: 'Amber', class: 'shiny-theme-amber' },
  { id: 'plasma', name: 'Plasma', class: 'shiny-theme-plasma' },
  { id: 'lavender', name: 'Lavender', class: 'shiny-theme-lavender' }
];

export const shinyThemeClass = (id) => {
  const t = SHINY_THEMES.find(t => t.id === id);
  return t ? t.class : '';
};