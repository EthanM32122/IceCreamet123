import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/lib/gameContext';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BeeFlappyGame from '@/components/game/BeeFlappyGame';
import HivelandsChat from '@/components/game/HivelandsChat';
import HivelandsLeaderboards from '@/components/game/HivelandsLeaderboards';
import PullAnimation from '@/components/game/PullAnimation';
import { SELL_PRICES } from '@/lib/constants';
import {
  HIVELANDS_BG, BIOMES, INGREDIENTS, SOUP_BLOOK,
  SOUP_SELL_PRICE, HONEY_PACK_COST, COINS_PER_HONEY,
  PIPES_TO_WIN, INGREDIENT_COIN_REWARD,
  HIVELANDS_PACK_BLOOKS, HIVELANDS_PACK, SPOOKY_POLINIZATION_ID,
  SPOOKY_POLINIZATION_PACK_ENTRY, SPOOKY_POLINIZATION_BOOST_WEIGHT, SEED_BOOST_COST,
  BIOME_BACKGROUNDS,
  biomeById, ingredientsForBiome, parseIngredients, stringifyIngredients, uniqueIngredientCount
} from '@/lib/hivelands';
import { isEventLive } from '@/lib/spookyEvent';

export default function SoupsOfHivelands() {
  const { profile, updateProfile } = useGame();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hivelands, setHivelands] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeBiome, setActiveBiome] = useState(null);
  const [playingBiome, setPlayingBiome] = useState(null);
  const [listings, setListings] = useState([]);
  const [sellPrice, setSellPrice] = useState(SOUP_SELL_PRICE);
  const [busy, setBusy] = useState(false);
  const [convertAmount, setConvertAmount] = useState('');
  const [listingPrice, setListingPrice] = useState(SOUP_SELL_PRICE);
  const [buyingId, setBuyingId] = useState(null);
  const [ownedBlookIds, setOwnedBlookIds] = useState(new Set());

  // Load owned blook ids for the prizes display.
  useEffect(() => {
    if (!profile?.user_id) return;
    base44.entities.PlayerBlook.filter({ user_id: profile.user_id })
      .then(pbs => {
        const list = pbs.items || pbs;
        setOwnedBlookIds(new Set(list.map(pb => pb.blook_id)));
      })
      .catch(() => {});
  }, [profile?.user_id, hivelands?.soups_made]);

  // Load or create the player's Hivelands profile.
  const loadHivelands = useCallback(async () => {
    if (!profile) return;
    try {
      const rows = await base44.entities.HivelandsProfile.filter({ user_id: profile.user_id });
      if (rows.length > 0) {
        setHivelands(rows[0]);
      } else {
        const created = await base44.entities.HivelandsProfile.create({
          user_id: profile.user_id,
          username: profile.username,
          coins: 0, honey: 0, soups_made: 0, soups_sold: 0, total_coins_earned: 0
        });
        setHivelands(created);
      }
    } catch (e) {
      console.error('Failed to load Hivelands profile', e);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { loadHivelands(); }, [loadHivelands]);

  // Load soup bazaar listings.
  const loadListings = useCallback(() => {
    base44.entities.HivelandsSoupListing.filter({ status: 'active' }, '-created_date', 100)
      .then(page => setListings(page.items || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadListings(); }, [loadListings]);

  const ingredients = parseIngredients(hivelands?.ingredients_collected);
  const uniqueCount = uniqueIngredientCount(ingredients);
  const canCraftSoup = INGREDIENTS.every(ing => (ingredients[ing.id] || 0) > 0);
  const coins = hivelands?.coins || 0;
  const honey = hivelands?.honey || 0;
  const soupsMade = hivelands?.soups_made || 0;
  const honeysAvailable = Math.floor(coins / COINS_PER_HONEY);

  // --- Biome / flappy game ---
  const enterBiome = (biome) => {
    setActiveBiome(biome);
    setPlayingBiome(null);
  };

  const startGame = (biome) => {
    setPlayingBiome(biome);
  };

  const handleWin = useCallback(async () => {
    if (!profile || !playingBiome) return;
    // Pick an ingredient from this biome the player hasn't collected yet, or a random one.
    const biomeIngredients = ingredientsForBiome(playingBiome.id);
    const uncollected = biomeIngredients.filter(i => !(ingredients[i.id] > 0));
    const picked = uncollected.length > 0
      ? uncollected[Math.floor(Math.random() * uncollected.length)]
      : biomeIngredients[Math.floor(Math.random() * biomeIngredients.length)];
    if (!picked) return;

    const newIngredients = { ...ingredients, [picked.id]: (ingredients[picked.id] || 0) + 1 };
    const newCoins = coins + INGREDIENT_COIN_REWARD;
    try {
      await base44.entities.HivelandsProfile.update(hivelands.id, {
        ingredients_collected: stringifyIngredients(newIngredients),
        coins: newCoins,
        total_coins_earned: (hivelands.total_coins_earned || 0) + INGREDIENT_COIN_REWARD
      });
      setHivelands(prev => ({ ...prev, ingredients_collected: stringifyIngredients(newIngredients), coins: newCoins, total_coins_earned: (prev.total_coins_earned || 0) + INGREDIENT_COIN_REWARD }));
      toast({
        title: `🐝 ${picked.name} collected!`,
        description: `+${INGREDIENT_COIN_REWARD} coins · You now have ${uniqueIngredientCount(newIngredients)}/${INGREDIENTS.length} unique ingredients.`
      });
    } catch (e) {
      toast({ title: 'Failed to save', description: e?.message, variant: 'destructive' });
    }
    setPlayingBiome(null);
    setActiveBiome(playingBiome);
  }, [profile, playingBiome, ingredients, coins, hivelands, toast]);

  const handleLose = useCallback(() => {
    // Stay on the biome so the player can retry.
  }, []);

  const exitGame = () => {
    setPlayingBiome(null);
  };

  // --- Soup crafting ---
  const craftSoup = async () => {
    if (!canCraftSoup || busy) return;
    setBusy(true);
    try {
      // Consume one of each ingredient.
      const consumed = { ...ingredients };
      INGREDIENTS.forEach(ing => { consumed[ing.id] = Math.max(0, (consumed[ing.id] || 0) - 1); });
      const newSoups = soupsMade + 1;
      await base44.entities.HivelandsProfile.update(hivelands.id, {
        ingredients_collected: stringifyIngredients(consumed),
        soups_made: newSoups
      });
      setHivelands(prev => ({ ...prev, ingredients_collected: stringifyIngredients(consumed), soups_made: newSoups }));
      toast({ title: '🍲 Soup crafted!', description: 'You made a SpaghettiOs soup!' });
    } catch (e) {
      toast({ title: 'Craft failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  // --- Sell soup for coins ---
  const sellSoup = async () => {
    if (soupsMade < 1 || busy) return;
    setBusy(true);
    try {
      const newCoins = coins + SOUP_SELL_PRICE;
      const newSoups = soupsMade - 1;
      await base44.entities.HivelandsProfile.update(hivelands.id, {
        coins: newCoins,
        soups_made: newSoups,
        soups_sold: (hivelands.soups_sold || 0) + 1
      });
      setHivelands(prev => ({ ...prev, coins: newCoins, soups_made: newSoups, soups_sold: (prev.soups_sold || 0) + 1 }));
      toast({ title: `🍲 Soup sold!`, description: `+${SOUP_SELL_PRICE.toLocaleString()} coins` });
    } catch (e) {
      toast({ title: 'Sell failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  // --- List soup on bazaar ---
  const listOnBazaar = async () => {
    if (soupsMade < 1 || busy || listingPrice <= 0) return;
    setBusy(true);
    try {
      await base44.entities.HivelandsSoupListing.create({
        seller_id: profile.user_id,
        seller_username: profile.username,
        soup_blook_id: SOUP_BLOOK.id,
        soup_name: SOUP_BLOOK.name,
        soup_image_url: SOUP_BLOOK.image_url,
        price: listingPrice
      });
      const newSoups = soupsMade - 1;
      await base44.entities.HivelandsProfile.update(hivelands.id, { soups_made: newSoups });
      setHivelands(prev => ({ ...prev, soups_made: newSoups }));
      toast({ title: '🏪 Listed on bazaar!', description: `Your soup is listed for ${listingPrice.toLocaleString()} coins.` });
      loadListings();
    } catch (e) {
      toast({ title: 'Listing failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  // --- Buy soup from bazaar ---
  const buySoup = async (listing) => {
    if (buyingId || busy) return;
    if (coins < listing.price) {
      toast({ title: 'Not enough coins', description: `You need ${listing.price.toLocaleString()} coins.`, variant: 'destructive' });
      return;
    }
    setBuyingId(listing.id);
    setBusy(true);
    try {
      // Deduct coins from buyer.
      const buyerNewCoins = coins - listing.price;
      await base44.entities.HivelandsProfile.update(hivelands.id, { coins: buyerNewCoins });
      setHivelands(prev => ({ ...prev, coins: buyerNewCoins }));

      // Credit seller coins.
      const sellerRows = await base44.entities.HivelandsProfile.filter({ user_id: listing.seller_id });
      if (sellerRows.length > 0) {
        await base44.entities.HivelandsProfile.update(sellerRows[0].id, { coins: (sellerRows[0].coins || 0) + listing.price });
      }

      // Transfer soup to buyer.
      const buyerNewSoups = soupsMade + 1;
      await base44.entities.HivelandsProfile.update(hivelands.id, { soups_made: buyerNewSoups });
      setHivelands(prev => ({ ...prev, soups_made: buyerNewSoups }));

      // Mark listing sold.
      await base44.entities.HivelandsSoupListing.update(listing.id, { status: 'sold' });
      loadListings();
      toast({ title: '🍲 Soup purchased!', description: `You bought a ${listing.soup_name} for ${listing.price.toLocaleString()} coins.` });
    } catch (e) {
      toast({ title: 'Purchase failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(false);
    setBuyingId(null);
  };

  // --- Convert coins to honey ---
  const convertToHoney = async () => {
    const amount = parseInt(convertAmount) || 0;
    if (amount <= 0 || busy) return;
    const cost = amount * COINS_PER_HONEY;
    if (coins < cost) {
      toast({ title: 'Not enough coins', description: `You need ${cost.toLocaleString()} coins for ${amount} honey.`, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const newCoins = coins - cost;
      const newHoney = honey + amount;
      await base44.entities.HivelandsProfile.update(hivelands.id, { coins: newCoins, honey: newHoney });
      setHivelands(prev => ({ ...prev, coins: newCoins, honey: newHoney }));
      setConvertAmount('');
      toast({ title: `🍯 Converted!`, description: `${amount} honey earned. ${COINS_PER_HONEY.toLocaleString()} coins per honey.` });
    } catch (e) {
      toast({ title: 'Conversion failed', description: e?.message, variant: 'destructive' });
    }
    setBusy(false);
  };

  // --- Buy Hivelands Pack ---
  const [buyingPack, setBuyingPack] = useState(false);
  const [pulledBlook, setPulledBlook] = useState(null);
  const [boostWithSeeds, setBoostWithSeeds] = useState(false);
  const buyHivelandsPack = async () => {
    if (honey < HONEY_PACK_COST || buyingPack) return;
    const wantBoost = boostWithSeeds && (profile?.pumpkin_seeds || 0) >= SEED_BOOST_COST;
    setBuyingPack(true);
    try {
      // Deduct honeys (and pumpkin seeds if boosting).
      const newHoney = honey - HONEY_PACK_COST;
      await base44.entities.HivelandsProfile.update(hivelands.id, { honey: newHoney });
      setHivelands(prev => ({ ...prev, honey: newHoney }));
      if (wantBoost) {
        await updateProfile({ pumpkin_seeds: (profile.pumpkin_seeds || 0) - SEED_BOOST_COST });
      }

      // Build the weighted drop pool. Spooky Polinization is only in the pool
      // while the Spooky Month event is live; seed-boosting inflates its weight.
      const pool = [...HIVELANDS_PACK_BLOOKS];
      const weights = {};
      HIVELANDS_PACK_BLOOKS.forEach(b => { weights[b.id] = b.drop_chance || 0; });
      if (isEventLive()) {
        pool.push(SPOOKY_POLINIZATION_PACK_ENTRY);
        weights[SPOOKY_POLINIZATION_ID] = wantBoost
          ? SPOOKY_POLINIZATION_BOOST_WEIGHT
          : SPOOKY_POLINIZATION_PACK_ENTRY.drop_chance;
      }
      const totalChance = pool.reduce((s, b) => s + (weights[b.id] || 0), 0);
      let roll = Math.random() * totalChance;
      let picked = pool[pool.length - 1];
      for (const b of pool) {
        roll -= (weights[b.id] || 0);
        if (roll <= 0) { picked = b; break; }
      }
      const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: picked.id });
      if (existing.length) {
        await base44.entities.PlayerBlook.update(existing[0].id, { quantity: (existing[0].quantity || 0) + 1 });
      } else {
        await base44.entities.PlayerBlook.create({ user_id: profile.user_id, blook_id: picked.id, quantity: 1, game: 'icecreamet' });
      }
      setPulledBlook({ ...picked, isShiny: false });
    } catch (e) {
      toast({ title: 'Pack failed', description: e?.message, variant: 'destructive' });
    }
    setBuyingPack(false);
  };

  // Keep the pulled blook — it's already in the inventory.
  const handleKeep = () => {
    setPulledBlook(null);
    if (profile?.user_id) {
      base44.entities.PlayerBlook.filter({ user_id: profile.user_id })
        .then(pbs => setOwnedBlookIds(new Set((pbs.items || pbs).map(pb => pb.blook_id))))
        .catch(() => {});
    }
  };

  // Sell the pulled blook for tokens (same flow as the main market).
  const handleSell = async (blook) => {
    try {
      const sellPrice = SELL_PRICES[blook.rarity] || 5;
      await updateProfile({ tokens: (profile.tokens || 0) + sellPrice });
      const existing = await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, blook_id: blook.id, game: 'icecreamet' });
      if (existing.length > 0) {
        const rec = existing[0];
        if ((rec.quantity || 0) <= 1 && (rec.shiny_quantity || 0) === 0) {
          await base44.entities.PlayerBlook.delete(rec.id);
        } else {
          await base44.entities.PlayerBlook.update(rec.id, { quantity: Math.max(0, (rec.quantity || 0) - 1) });
        }
      }
      toast({ title: 'Sold!', description: `+${sellPrice.toLocaleString()} tokens` });
    } catch (e) {
      toast({ title: 'Sell failed', description: e?.message, variant: 'destructive' });
    }
    setPulledBlook(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Full-screen flappy game view — honeycomb/biome bg covers the whole viewport.
  if (playingBiome) {
    const gameBg = BIOME_BACKGROUNDS[playingBiome.id] || HIVELANDS_BG;
    return (
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        style={{ backgroundImage: `url(${gameBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
      >
        <div className="min-h-full py-6 px-4 flex items-start justify-center">
          <div className="w-full max-w-lg">
            <BeeFlappyGame
              biome={playingBiome}
              onWin={handleWin}
              onLose={handleLose}
              onExit={exitGame}
            />
          </div>
        </div>
      </div>
    );
  }

  // Use the honeycomb background on the landing page, or the biome's own
  // background while exploring a specific biome.
  const screenBg = activeBiome && BIOME_BACKGROUNDS[activeBiome.id]
    ? BIOME_BACKGROUNDS[activeBiome.id]
    : HIVELANDS_BG;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto" style={{ backgroundImage: `url(${screenBg})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
      {/* Semi-transparent overlay for readability */}
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="font-display text-4xl sm:text-5xl text-amber-300 drop-shadow-lg mb-1">🐝 Soups of Hivelands</h1>
          <p className="text-white/80 text-sm">Fly your bee through biomes, collect ingredients, craft soup, earn honey!</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-amber-400/90 rounded-2xl p-3 text-center border border-amber-300">
            <p className="text-xs text-amber-900/70 uppercase tracking-wide">Coins</p>
            <p className="text-2xl font-display text-amber-900">🪙 {coins.toLocaleString()}</p>
          </div>
          <div className="bg-amber-400/90 rounded-2xl p-3 text-center border border-amber-300">
            <p className="text-xs text-amber-900/70 uppercase tracking-wide">Honey</p>
            <p className="text-2xl font-display text-amber-900">🍯 {honey.toLocaleString()}</p>
          </div>
          <div className="bg-amber-400/90 rounded-2xl p-3 text-center border border-amber-300">
            <p className="text-xs text-amber-900/70 uppercase tracking-wide">Ingredients</p>
            <p className="text-2xl font-display text-amber-900">{uniqueCount}/{INGREDIENTS.length}</p>
          </div>
          <div className="bg-amber-400/90 rounded-2xl p-3 text-center border border-amber-300">
            <p className="text-xs text-amber-900/70 uppercase tracking-wide">Soups</p>
            <p className="text-2xl font-display text-amber-900">🍲 {soupsMade}</p>
          </div>
        </div>

        {/* Active biome view */}
        {activeBiome && (
          <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl text-white">{activeBiome.name}</h2>
              <Button size="sm" variant="outline" onClick={() => setActiveBiome(null)} className="border-white/20 text-white">← Back</Button>
            </div>
            <p className="text-white/70 text-sm mb-3">Ingredients here: {ingredientsForBiome(activeBiome.id).map(i => i.name).join(', ')}</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ingredientsForBiome(activeBiome.id).map(ing => {
                const count = ingredients[ing.id] || 0;
                return (
                  <div key={ing.id} className={`flex items-center gap-2 rounded-lg p-2 border ${count > 0 ? 'bg-amber-400/20 border-amber-400/50' : 'bg-white/5 border-white/10'}`}>
                    <img src={ing.image_url} alt={ing.name} className="w-8 h-8 object-contain" />
                    <span className="text-sm text-white flex-1">{ing.name}</span>
                    {count > 0 && <span className="text-xs text-amber-300 font-display">x{count}</span>}
                  </div>
                );
              })}
            </div>
            <Button onClick={() => startGame(activeBiome)} style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }} className="w-full font-display text-lg py-6">
              🐝 Fly — {PIPES_TO_WIN} pipes to collect
            </Button>
          </div>
        )}

        {/* Biome cards grid */}
        {!activeBiome && (
          <>
            <h2 className="font-display text-xl text-white mb-3">🌍 Expeditions</h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {BIOMES.map(biome => {
                const biomeIngs = ingredientsForBiome(biome.id);
                const collected = biomeIngs.filter(i => (ingredients[i.id] || 0) > 0).length;
                return (
                  <button
                    key={biome.id}
                    onClick={() => enterBiome(biome)}
                    className="relative rounded-2xl overflow-hidden border-2 hover:scale-[1.02] transition-transform text-left group"
                    style={{ borderColor: biome.border }}
                  >
                    <div className="aspect-[4/3] relative">
                      <img src={biome.image_url} alt={biome.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="font-display text-white text-lg drop-shadow">{biome.name}</p>
                        <p className="text-white/70 text-xs">{collected}/{biomeIngs.length} ingredients</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Soup Kitchen */}
            <h2 className="font-display text-xl text-white mb-3">🍲 Soup Kitchen</h2>
            <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-4">
                {INGREDIENTS.map(ing => {
                  const count = ingredients[ing.id] || 0;
                  return (
                    <div key={ing.id} className={`flex flex-col items-center gap-1 rounded-lg p-2 border ${count > 0 ? 'bg-amber-400/20 border-amber-400/50' : 'bg-white/5 border-white/10 opacity-50'}`}>
                      <img src={ing.image_url} alt={ing.name} className="w-10 h-10 object-contain" />
                      <span className="text-[9px] text-white/70 text-center leading-tight">{ing.name}</span>
                      {count > 0 && <span className="text-[10px] text-amber-300 font-display">x{count}</span>}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button onClick={craftSoup} disabled={!canCraftSoup || busy} style={{ backgroundColor: canCraftSoup ? '#fbbf24' : undefined, color: canCraftSoup ? '#1a1a1a' : undefined }} className="font-display w-full sm:w-auto">
                  {busy ? 'Crafting...' : canCraftSoup ? '🍲 Craft Soup!' : `Need all ${INGREDIENTS.length} ingredients (${uniqueCount}/${INGREDIENTS.length})`}
                </Button>
                {soupsMade > 0 && (
                  <>
                    <Button onClick={sellSoup} disabled={busy} variant="outline" className="border-amber-400/40 text-amber-300 font-display w-full sm:w-auto">
                      Sell Soup — {SOUP_SELL_PRICE.toLocaleString()} coins
                    </Button>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input type="number" value={listingPrice} onChange={e => setListingPrice(Math.max(1, parseInt(e.target.value) || 0))} className="w-24 h-9 text-xs bg-black/30 border-white/10 text-white" />
                      <Button onClick={listOnBazaar} disabled={busy} size="sm" variant="outline" className="border-amber-400/40 text-amber-300">List on Bazaar</Button>
                    </div>
                  </>
                )}
              </div>
              <p className="text-[11px] text-white/40 mt-2">Craft a soup by collecting one of each ingredient across all biomes.</p>
            </div>

            {/* My Soup Listings */}
            {listings.filter(l => l.seller_id === profile.user_id).length > 0 && (
              <>
                <h2 className="font-display text-xl text-white mb-3">🍲 My Listings</h2>
                <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {listings.filter(l => l.seller_id === profile.user_id).map(listing => (
                      <div key={listing.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-amber-400/30">
                        <img src={listing.soup_image_url || SOUP_BLOOK.image_url} alt={listing.soup_name} className="w-12 h-12 object-contain" />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-sm text-white truncate">{listing.soup_name}</p>
                          <p className="text-sm font-display text-amber-300">🪙 {listing.price.toLocaleString()}</p>
                        </div>
                        <Button size="sm" variant="outline" disabled={busy}
                          onClick={async () => {
                            if (busy) return;
                            setBusy(true);
                            try {
                              await base44.entities.HivelandsSoupListing.update(listing.id, { status: 'cancelled' });
                              const newSoups = soupsMade + 1;
                              await base44.entities.HivelandsProfile.update(hivelands.id, { soups_made: newSoups });
                              setHivelands(prev => ({ ...prev, soups_made: newSoups }));
                              toast({ title: '🍲 Listing cancelled', description: 'Your soup was returned to you.' });
                              loadListings();
                            } catch (e) {
                              toast({ title: 'Cancel failed', description: e?.message, variant: 'destructive' });
                            }
                            setBusy(false);
                          }}
                          className="border-red-400/40 text-red-300 text-xs">
                          Cancel
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Soup Bazaar */}
            <h2 className="font-display text-xl text-white mb-3">🏪 Soup Bazaar</h2>
            <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
              {listings.length === 0 ? (
                <p className="text-white/60 text-sm text-center py-6">No soups listed yet. Be the first!</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {listings.map(listing => (
                    <div key={listing.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
                      <img src={listing.soup_image_url || SOUP_BLOOK.image_url} alt={listing.soup_name} className="w-12 h-12 object-contain" />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm text-white truncate">{listing.soup_name}</p>
                        <p className="text-[10px] text-white/50">by {listing.seller_username}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-display text-amber-300">🪙 {listing.price.toLocaleString()}</p>
                        {listing.seller_id !== profile.user_id ? (
                          <Button size="sm" onClick={() => buySoup(listing)} disabled={busy || coins < listing.price} className="mt-1 text-xs" style={{ backgroundColor: coins >= listing.price ? '#fbbf24' : undefined, color: coins >= listing.price ? '#1a1a1a' : undefined }}>
                            {buyingId === listing.id ? 'Buying...' : 'Buy'}
                          </Button>
                        ) : (
                          <p className="mt-1 text-[9px] text-white/40">Your listing</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Honey Shop */}
            <h2 className="font-display text-xl text-white mb-3">🍯 Honey Shop</h2>
            <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Convert coins to honey */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="font-display text-sm text-white mb-1">Convert Coins → Honey</p>
                  <p className="text-[10px] text-white/50 mb-3">{COINS_PER_HONEY.toLocaleString()} coins = 1 honey · You can afford {honeysAvailable} honey</p>
                  <div className="flex gap-2">
                    <Input type="number" value={convertAmount} onChange={e => setConvertAmount(e.target.value)} placeholder="Amount" className="h-9 text-sm bg-black/30 border-white/10 text-white" />
                    <Button onClick={convertToHoney} disabled={busy || !convertAmount || parseInt(convertAmount) <= 0} style={{ backgroundColor: '#fbbf24', color: '#1a1a1a' }} size="sm">
                      Convert
                    </Button>
                  </div>
                </div>
                {/* Hivelands Pack */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="font-display text-sm text-white mb-1">Hivelands Pack</p>
                  <p className="text-[10px] text-white/50 mb-3">Cost: {HONEY_PACK_COST} honeys · Contains event blooks{isEventLive() && ' · 🎃 Spooky Polinization is pullable!'}</p>
                  {isEventLive() && (
                    <label className={`flex items-center gap-2 mb-3 ${(profile?.pumpkin_seeds || 0) < SEED_BOOST_COST ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={boostWithSeeds}
                        onChange={e => setBoostWithSeeds(e.target.checked)}
                        disabled={(profile?.pumpkin_seeds || 0) < SEED_BOOST_COST}
                        className="w-4 h-4 accent-amber-400"
                      />
                      <span className="text-[10px] text-white/70">🍀 Boost Spooky Polinization chance ({SEED_BOOST_COST} seeds)</span>
                      <span className="text-[9px] text-white/40">· You have {profile?.pumpkin_seeds || 0} 🎃</span>
                    </label>
                  )}
                  <Button onClick={buyHivelandsPack} disabled={honey < HONEY_PACK_COST || buyingPack} style={{ backgroundColor: honey >= HONEY_PACK_COST ? '#fbbf24' : undefined, color: honey >= HONEY_PACK_COST ? '#1a1a1a' : undefined }} className="w-full font-display">
                    {buyingPack ? 'Opening...' : honey >= HONEY_PACK_COST ? `📦 Open Pack (${HONEY_PACK_COST} honeys${boostWithSeeds && (profile?.pumpkin_seeds || 0) >= SEED_BOOST_COST ? ' + 🎃 boost' : ''})` : `Need ${HONEY_PACK_COST - honey} more honeys`}
                  </Button>
                </div>
              </div>
            </div>

            {/* Prizes */}
            <h2 className="font-display text-xl text-white mb-3">🎁 Hivelands Prizes</h2>
            <div className="bg-black/40 rounded-2xl border border-amber-400/40 p-4 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {HIVELANDS_PACK_BLOOKS.map(b => {
                  const owned = ownedBlookIds.has(b.id);
                  return (
                    <div key={b.id} className={`relative bg-white/5 rounded-xl border p-3 flex flex-col items-center gap-2 ${owned ? 'border-amber-400/50' : 'border-white/10 opacity-70'}`}>
                      <span className={`absolute top-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded-full text-white font-display ${b.rarity === 'legendary' ? 'bg-amber-500' : 'bg-purple-500'}`}>
                        {b.rarity === 'legendary' ? 'Legendary' : 'Unique'}
                      </span>
                      <img src={b.image_url} alt={b.name} className="w-16 h-16 object-contain" />
                      <span className={`text-xs font-display text-center leading-tight rarity-${b.rarity}`}>{b.name}</span>
                      <span className={`text-[10px] font-display ${owned ? 'text-amber-300' : 'text-white/40'}`}>
                        {owned ? '✓ Owned' : 'Not owned'}
                      </span>
                      <span className="text-[9px] text-white/50">{b.drop_chance}% drop</span>
                    </div>
                  );
                })}
                {isEventLive() && (
                  (() => {
                    const spookyId = '6ac177a1fe3816445b8fb63b';
                    const owned = ownedBlookIds.has(spookyId);
                    return (
                      <div className={`relative rounded-xl border p-3 flex flex-col items-center gap-2 overflow-hidden ${owned ? 'border-purple-400/60' : 'border-purple-500/30 opacity-80'}`} style={{ background: 'linear-gradient(135deg, #3d1a6e 0%, #2a0c4f 100%)' }}>
                        <span className="absolute top-1.5 left-1.5 text-[8px] px-1.5 py-0.5 rounded-full font-display text-white" style={{ background: 'linear-gradient(90deg, #3b82f6, #ef4444, #a855f7)' }}>Paradox</span>
                        <span className="absolute top-1.5 right-1.5 text-[8px] px-1.5 py-0.5 rounded-full bg-purple-900/80 text-purple-200 font-display">🎃 Event</span>
                        <img src="https://media.base44.com/images/public/6a618722aa7aa154e6bca6b1/a7f725376_image.png" alt="Spooky Polinization" className="w-16 h-16 object-contain" />
                        <span className="text-xs font-display text-center leading-tight rarity-paradox">Spooky Polinization</span>
                        <span className={`text-[10px] font-display ${owned ? 'text-purple-300' : 'text-white/40'}`}>
                          {owned ? '✓ Owned' : 'Not owned'}
                        </span>
                        <span className="text-[9px] text-purple-300/60">Spooky Month only</span>
                      </div>
                    );
                  })()
                )}
              </div>
              <p className="text-[11px] text-white/40 mt-3 text-center">Earn honey by collecting ingredients and crafting soup, then open Hivelands Packs to win these blooks.</p>
            </div>
          </>
        )}

        {/* Chat + Leaderboards side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl text-white mb-3">💬 Hivelands Chat</h2>
            <HivelandsChat profile={profile} />
          </div>
          <div>
            <h2 className="font-display text-xl text-white mb-3">🏆 Leaderboards</h2>
            <HivelandsLeaderboards currentUserId={profile?.user_id} />
          </div>
        </div>

        {/* Back link */}
        <div className="flex justify-center pb-8">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="border-white/20 text-white bg-black/40">
            ← Back
          </Button>
        </div>
      </div>

      {pulledBlook && (
        <PullAnimation
          blook={pulledBlook}
          pack={HIVELANDS_PACK}
          onClose={handleKeep}
          onSell={handleSell}
        />
      )}
    </div>
  );
}