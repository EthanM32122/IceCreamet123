// Soups of Hivelands event — shared data and helpers.

// Background texture (honeycomb) and header image.
export const HIVELANDS_BG = 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/c5a102d7c_Screenshot2026-10-0390322AM.png';

// Ingredient blooks — each tied to a specific biome. Collecting one means
// clearing 100 pipes in the bee flappy game for that biome.
export const INGREDIENTS = [
  { id: '6ab654414716e929863a2de5', name: 'Bacon And Eggs', image_url: 'https://cloaket.softfault.cc/api/content/blooks/Bacon%20and%20Eggs.webp?v=1', biome: 'shadefields' },
  { id: '6ab933d53c9b3bc6fab549ca', name: 'MANGO', image_url: 'https://blacket-media.s3.us-east-2.amazonaws.com/content/blooks/Mango.png', biome: 'verdant' },
  { id: '6ab5a5a193993e6c3fe18b74', name: 'Mooncake', image_url: 'https://cdn.phototourl.com/member/2026-09-24-8763e80f-b40c-465c-893f-9ed8afbb5a8f.png', biome: 'radiant' },
  { id: '6ab65a90da3a29753dd76a46', name: 'Ham', image_url: 'https://cdn.phototourl.com/member/2026-09-25-8581fc44-4754-4d4c-af57-0e866bcdb94a.png', biome: 'shadefields' },
  { id: '6a97f26a7b99260f353f548f', name: 'Muffin', image_url: 'https://blacket-media.s3.us-east-2.amazonaws.com/content/blooks/Muffin.png', biome: 'buzzbloom' },
  { id: '6a7420bb6e152ee402197374', name: 'Waffles', image_url: 'https://blacket.xotic.org/content/blooks/Waffle.webp', biome: 'buzzbloom' },
  { id: '6a97f1a01a20a6263258c025', name: 'Bagel', image_url: 'https://blacket-media.s3.us-east-2.amazonaws.com/content/blooks/Bagel.png', biome: 'verdant' },
  { id: '6a9467acda501f83548a00ec', name: 'Pancakes', image_url: 'https://blacket.xotic.org/content/blooks/Pancakes.webp', biome: 'radiant' }
];

// The "soup" blook you craft by combining all 8 ingredients.
export const SOUP_BLOOK = {
  id: '6ab65b46dfd7cd9a58f7b7e9',
  name: 'SpaghettiOs',
  image_url: 'https://cdn.phototourl.com/member/2026-09-25-5c16bc8b-1d1a-4e2e-b770-5c70a3ae3b1a.png'
};

// Hivelands Pack contents — real Blook IDs. Basic Bee is legendary (50%);
// the rest are unique and share the remaining 50% evenly.
export const HIVELANDS_PACK_ID = '6ac16ad4076befcf48d45858';
export const HIVELANDS_PACK_BLOOKS = [
  { id: '6ac16b40076befcf48d4586f', name: 'Basic Bee', rarity: 'legendary', drop_chance: 50, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/9a6410328_image.png' },
  { id: '6ac16b40076befcf48d45870', name: 'Anglerburger', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/3b892b864_image.png' },
  { id: '6ac16b40076befcf48d45871', name: 'Bee Drawing', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/d131e4ba8_image.png' },
  { id: '6ac16b40076befcf48d45872', name: 'Mount Slime', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/8e3cddaf5_image.png' },
  { id: '6ac16b40076befcf48d45873', name: 'Polinization', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/2be83215d_image.png' },
  { id: '6ac16b40076befcf48d45874', name: 'Icecreamet Polinization', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/737ae24b5_image.png' },
  { id: '6ac16b48076befcf48d4587e', name: 'Queen Of Hivelands', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ec87a9f6f_image.png' },
  { id: '6ac16b40076befcf48d45875', name: 'Rainbeew', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/84f39b4f0_image.png' },
  { id: '6ac16b40076befcf48d45876', name: 'Rainbow Hive', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/fa19be5d9_image.png' },
  { id: '6ac16b40076befcf48d45877', name: 'Soup Hall', rarity: 'unique', drop_chance: 5, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/3c3dfe4e7_image.png' },
  { id: '6ac16b40076befcf48d45878', name: 'Hive', rarity: 'unique', drop_chance: 10, image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ec87a9f6f_image.png' }
];

export const SPOOKY_POLINIZATION_ID = '6ac177a1fe3816445b8fb63b';
// Blooks restricted from bazaar trading — only the Spooky Month paradox event
// blook remains restricted. Hivelands, Summer, Golden, and PAC3 blooks are
// now listable on the bazaar.
export const BAZAAR_RESTRICTED_BLOOK_IDS = new Set([SPOOKY_POLINIZATION_ID]);

// Hivelands Pack metadata (used for the pack-opening animation).
export const HIVELANDS_PACK = {
  id: HIVELANDS_PACK_ID,
  name: 'Hivelands Pack',
  image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/ec87a9f6f_image.png',
  background_url: HIVELANDS_BG
};

// Spooky Polinization — a paradox blook that can be pulled from the Hivelands
// Pack during the Spooky Month event. Base drop weight is tiny; spending pumpkin
// seeds at open time boosts the weight dramatically.
export const SPOOKY_POLINIZATION_PACK_ENTRY = {
  id: SPOOKY_POLINIZATION_ID,
  name: 'Spooky Polinization',
  rarity: 'paradox',
  drop_chance: 0.1,          // base weight (~0.095% of the pack)
  image_url: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/a7f725376_image.png'
};
export const SPOOKY_POLINIZATION_BOOST_WEIGHT = 12; // weight while seed-boosted (~11%)
export const SEED_BOOST_COST = 10;                  // pumpkin seeds per boost

export const SOUP_SELL_PRICE = 10000; // coins per soup sold
export const HONEY_PACK_COST = 25;    // honeys per Hivelands Pack
export const COINS_PER_HONEY = 1000;  // 1 honey = 1000 event coins
export const PIPES_TO_WIN = 100;      // pipes to clear a biome and get the ingredient
export const INGREDIENT_COIN_REWARD = 250; // coins earned per ingredient collected

// Biome-specific background images (full-screen, one per biome).
export const BIOME_BACKGROUNDS = {
  shadefields: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/4809fdeb8_image.png',
  verdant: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/91570971a_image.png',
  buzzbloom: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/e53d19903_image.png',
  radiant: 'https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/c42481541_image.png'
};

// Biomes shown on the event landing page.
export const BIOMES = [
  {
    id: 'shadefields',
    name: 'Shadefields Valley',
    image_url: BIOME_BACKGROUNDS.shadefields,
    color: '#4b5563',
    border: '#1f2937'
  },
  {
    id: 'verdant',
    name: 'Verdant Woods',
    image_url: BIOME_BACKGROUNDS.verdant,
    color: '#16a34a',
    border: '#15803d'
  },
  {
    id: 'buzzbloom',
    name: 'Buzzbloom Fields',
    image_url: BIOME_BACKGROUNDS.buzzbloom,
    color: '#facc15',
    border: '#ca8a04'
  },
  {
    id: 'radiant',
    name: 'Radiant Grove',
    image_url: BIOME_BACKGROUNDS.radiant,
    color: '#d946ef',
    border: '#a21caf'
  }
];

export function biomeById(id) {
  return BIOMES.find(b => b.id === id);
}

export function ingredientsForBiome(biomeId) {
  return INGREDIENTS.filter(i => i.biome === biomeId);
}

export function ingredientById(id) {
  return INGREDIENTS.find(i => i.id === id);
}

// Parse the ingredients_collected JSON string into a map of { ingredientId: count }.
export function parseIngredients(str) {
  try {
    const obj = JSON.parse(str || '{}');
    return obj || {};
  } catch {
    return {};
  }
}

export function stringifyIngredients(map) {
  return JSON.stringify(map);
}

// Count unique ingredients owned (each distinct id counts once).
export function uniqueIngredientCount(map) {
  return Object.keys(map).filter(k => (map[k] || 0) > 0).length;
}