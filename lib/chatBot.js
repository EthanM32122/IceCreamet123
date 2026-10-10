import { base44 } from '@/api/base44Client';
import { RIDDLE_REWARDS, pickRiddle, getActiveRiddle, clearRiddle, normalizeAnswer } from '@/lib/riddles';

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('');
}

// Returns a bot response string, or null if input is not a command.
export async function handleBotCommand(rawContent, profile, blooks, packs, canUseBotCommands = true) {
  const content = (rawContent || '').trim();
  if (!content.startsWith('/')) return null;
  const parts = content.slice(1).split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const arg = parts.slice(1).join(' ').trim();

  if (cmd === 'pp') {
    const n = Math.floor(Math.random() * 12) + 1;
    return `${profile.username}'s pp is ${n} long\n8${'='.repeat(n)}D`;
  }

  if (!canUseBotCommands) {
    return '❌ You need the Verified badge to use bot commands. Ask a staff member to verify you!';
  }

  if (cmd === 'quantity') {
    if (!arg) return '📖 Usage: /quantity <blook name>';
    const lower = arg.toLowerCase();
    let blook = blooks.find(b => (b.name || '').toLowerCase() === lower)
      || blooks.find(b => (b.name || '').toLowerCase().startsWith(lower))
      || blooks.find(b => (b.name || '').toLowerCase().includes(lower));
    if (!blook) {
      const poke = await base44.entities.Blook.filter({ is_active: true, game: 'pokemon' }, null, 500).catch(() => []);
      blook = poke.find(b => (b.name || '').toLowerCase() === lower)
        || poke.find(b => (b.name || '').toLowerCase().startsWith(lower))
        || poke.find(b => (b.name || '').toLowerCase().includes(lower));
    }
    if (!blook) return `📖 Blook "${arg}" not found.`;
    const allOwned = await base44.entities.PlayerBlook.filter({ blook_id: blook.id });
    // A single player can have multiple PlayerBlook records for the same blook
    // (grantBlook's retry race creates duplicates), so aggregate per user for
    // accurate global totals, holder count, and top-owner list.
    const perUser = {};
    allOwned.forEach(pb => { perUser[pb.user_id] = (perUser[pb.user_id] || 0) + (pb.quantity || 1); });
    const qty = Object.values(perUser).reduce((s, q) => s + q, 0);
    const holders = Object.keys(perUser).length;
    const players = await base44.entities.PlayerProfile.filter({});
    const pMap = {};
    players.forEach(p => { pMap[p.user_id] = p.username; });
    const sorted = Object.entries(perUser)
      .map(([uid, quantity]) => ({ username: pMap[uid] || 'Unknown', quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    let lines = [`📖 ${blook.name} (${blook.rarity}) — ${qty} held globally by ${holders} player(s)`];
    if (sorted.length > 0) {
      lines.push('🏆 Top owners:');
      sorted.forEach((o, i) => lines.push(`${i + 1}. ${o.username} — ${o.quantity}`));
    }
    return lines.join('\n');
  }

  if (cmd === 'user') {
    if (!arg) return '👤 Usage: /user <username>';
    const players = await base44.entities.PlayerProfile.filter({});
    const target = players.find(p => (p.username || '').toLowerCase() === arg.toLowerCase())
      || players.find(p => (p.username || '').toLowerCase().includes(arg.toLowerCase()));
    if (!target) return `👤 User "${arg}" not found.`;
    return `👤 ${target.username} — Tokens: ${target.tokens || 0} · Level: ${target.level || 1} · Role: ${target.role || 'player'} · Packs: ${target.total_packs_opened || 0}`;
  }

  if (cmd === 'blook') {
    if (!arg) return '🎴 Usage: /blook <blook name>';
    const blook = blooks.find(b => (b.name || '').toLowerCase().includes(arg.toLowerCase()));
    if (!blook) return `🎴 Blook "${arg}" not found.`;
    const pack = packs.find(p => p.id === blook.pack_id);
    return `🎴 ${blook.name} — Rarity: ${blook.rarity} · Pack: ${pack?.name || '—'} · Sell: ${blook.sell_price || 0} tokens · Drop: ${blook.drop_chance || 0}%`;
  }

  if (cmd === 'unscramble') {
    const active = await base44.entities.GameSettings.filter({ key: 'unscramble_answer' });
    if (active.length > 0 && active[0].value) return '🎲 A game is already in progress! Type the unscrambled blook name to win +50 tokens.';
    const pool = blooks.filter(b => b.name && b.name.length > 2);
    if (pool.length === 0) return '🎲 No blooks available.';
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (active.length > 0) {
      await base44.entities.GameSettings.update(active[0].id, { value: chosen.name });
    } else {
      await base44.entities.GameSettings.create({ key: 'unscramble_answer', value: chosen.name, category: 'general' });
    }
    let s = scramble(chosen.name);
    let tries = 0;
    while (s.toLowerCase() === chosen.name.toLowerCase() && tries < 5) { s = scramble(chosen.name); tries++; }
    setTimeout(async () => {
      const stillActive = await getActiveUnscramble();
      if (stillActive && stillActive.toLowerCase() === chosen.name.toLowerCase()) {
        await base44.entities.ChatMessage.create({ content: `⏰ Time's up! The unscrambled blook was "${chosen.name}". Nobody got it this time.`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
        await clearUnscramble();
      }
    }, 60000);
    return `🎲 Unscramble this blook: "${s}" — first to type the correct name wins +50 tokens! (answer reveals in 1 min)`;
  }

  if (cmd === 'riddle') {
    const diffs = ['easy', 'medium', 'hard'];
    const diff = arg && diffs.includes(arg.toLowerCase()) ? arg.toLowerCase() : diffs[Math.floor(Math.random() * diffs.length)];
    const active = await base44.entities.GameSettings.filter({ key: 'riddle_answer' });
    if (active.length > 0 && active[0].value) return '🧩 A riddle is already in progress! Answer it to win tokens.';
    const r = pickRiddle(diff);
    const reward = RIDDLE_REWARDS[diff];
    const payload = JSON.stringify({ answer: r.a, reward });
    if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: payload });
    else await base44.entities.GameSettings.create({ key: 'riddle_answer', value: payload, category: 'general' });
    setTimeout(async () => {
      const stillActive = await getActiveRiddle();
      if (stillActive && stillActive.answer && stillActive.answer.toLowerCase() === r.a.toLowerCase()) {
        await base44.entities.ChatMessage.create({ content: `⏰ Time's up! The riddle answer was "${r.a}". Nobody got it this time.`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
        await clearRiddle();
      }
    }, 60000);
    return `🧩 [${diff.toUpperCase()}] Riddle: "${r.q}" — first to type the correct answer wins +${reward} tokens! (answer reveals in 1 min)`;
  }

  if (cmd === 'gtb') {
    const active = await base44.entities.GameSettings.filter({ key: 'gtb_answer' });
    if (active.length > 0 && active[0].value) return '🔮 A guess-the-blook game is already in progress! Type the blook name to win coins.';
    const pool = blooks.filter(b => b.name && b.image_url && b.game !== 'pokemon');
    if (pool.length === 0) return '🔮 No blooks available.';
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const reward = 100;
    if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: chosen.name });
    else await base44.entities.GameSettings.create({ key: 'gtb_answer', value: chosen.name, category: 'general' });
    await base44.entities.ChatMessage.create({ content: '🔮 Guess this blook! First to type the correct name wins +100 tokens!', image_url: chosen.image_url, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
    setTimeout(async () => {
      const still = await getActiveGtb();
      if (still && still.toLowerCase() === chosen.name.toLowerCase()) {
        await base44.entities.ChatMessage.create({ content: `⏰ Time's up! The blook was "${chosen.name}". Nobody got it this time.`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
        await clearGtb();
      }
    }, 60000);
    return `🔮 A blook image was posted above — guess its name for +${reward} tokens! (answer reveals in 1 min)`;
  }

  if (cmd === 'gtb2') {
    const active = await base44.entities.GameSettings.filter({ key: 'gtb2_answer' });
    if (active.length > 0 && active[0].value) return '🔮 A guess-the-blook (text) game is already in progress! Type the blook name to win coins.';
    const pool = blooks.filter(b => b.name);
    if (pool.length === 0) return '🔮 No blooks available.';
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const pack = packs.find(p => p.id === chosen.pack_id);
    const reward = 100;
    if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: chosen.name });
    else await base44.entities.GameSettings.create({ key: 'gtb2_answer', value: chosen.name, category: 'general' });
    const desc = `🔮 Guess this blook from its description! First to type the correct name wins +${reward} tokens!\nRarity: ${chosen.rarity} · Pack: ${pack?.name || '—'} · Sell price: ${chosen.sell_price || 0} tokens · Drop chance: ${chosen.drop_chance || 0}%`;
    await base44.entities.ChatMessage.create({ content: desc, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
    setTimeout(async () => {
      const still = await getActiveGtb2();
      if (still && still.toLowerCase() === chosen.name.toLowerCase()) {
        await base44.entities.ChatMessage.create({ content: `⏰ Time's up! The blook was "${chosen.name}". Nobody got it this time.`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
        await clearGtb2();
      }
    }, 60000);
    return `🔮 A blook description was posted above — guess its name for +${reward} tokens! (answer reveals in 1 min)`;
  }

  if (cmd === 'gtp') {
    const active = await base44.entities.GameSettings.filter({ key: 'gtp_answer' });
    if (active.length > 0 && active[0].value) return '⚡ A guess-the-Pokemon game is already in progress! Type the Pokemon name to win tokens.';
    const reward = 100;
    const id = Math.floor(Math.random() * 1025) + 1;
    let poke;
    try {
      const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      poke = await res.json();
    } catch {
      return '⚡ Could not reach the Pokemon API. Try again later.';
    }
    const name = poke.name;
    const image = poke.sprites?.other?.['official-artwork']?.front_default || poke.sprites?.front_default;
    if (!image) return '⚡ Could not load Pokemon sprite. Try again.';
    if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: name });
    else await base44.entities.GameSettings.create({ key: 'gtp_answer', value: name, category: 'general' });
    await base44.entities.ChatMessage.create({ content: `⚡ Guess this Pokemon! First to type the correct name wins +${reward} tokens!`, image_url: image, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
    setTimeout(async () => {
      const still = await getActiveGtp();
      if (still && still.toLowerCase() === name.toLowerCase()) {
        await base44.entities.ChatMessage.create({ content: `⏰ Time's up! The Pokemon was "${name}". Nobody got it this time.`, username: 'ICECREAMET Bot', is_system: true, user_role: 'admin' });
        await clearGtp();
      }
    }, 60000);
    return `⚡ A Pokemon image was posted above — guess its name for +${reward} tokens! (answer reveals in 1 min)`;
  }

  const isStaff = profile && ['moderator', 'admin', 'co-owner', 'owner'].includes(profile.role);
  const canMute = profile && ['helper', 'moderator', 'admin', 'co-owner', 'executive-manager', 'owner', 'biggie'].includes(profile.role);
  if (isStaff) {
    if (cmd === 'give') {
      const m = arg.match(/^(\S+)\s+(\d+)$/);
      if (!m) return '💰 Usage: /give <username> <tokens>';
      const players = await base44.entities.PlayerProfile.filter({});
      const target = players.find(p => (p.username || '').toLowerCase() === m[1].toLowerCase());
      if (!target) return `💰 User "${m[1]}" not found.`;
      const amt = parseInt(m[2]);
      const newTokens = Math.min(50000000, (target.tokens || 0) + amt);
      await base44.entities.PlayerProfile.update(target.id, { tokens: newTokens });
      return `💰 Gave ${amt} tokens to ${target.username} (now ${newTokens}).`;
    }
    if (cmd === 'unban') {
      if (!arg) return `⚠️ Usage: /unban <username>`;
      const players = await base44.entities.PlayerProfile.filter({});
      const target = players.find(p => (p.username || '').toLowerCase() === arg.toLowerCase());
      if (!target) return `⚠️ User "${arg}" not found.`;
      await base44.entities.PlayerProfile.update(target.id, { is_banned: false });
      return `⚠️ ${target.username} unbanned.`;
    }
    if (cmd === 'ban') {
      const m = arg.match(/^(\S+)\s+(.+)$/);
      if (!m) return `⚠️ Usage: /ban <username> <reason>`;
      const players = await base44.entities.PlayerProfile.filter({});
      const target = players.find(p => (p.username || '').toLowerCase() === m[1].toLowerCase());
      if (!target) return `⚠️ User "${m[1]}" not found.`;
      const reason = m[2].trim();
      if (profile.role === 'owner') {
        await base44.entities.PlayerProfile.update(target.id, { is_banned: true });
        return `⚠️ ${target.username} banned.`;
      }
      await base44.entities.BanRequest.create({
        target_user_id: target.user_id, target_username: target.username,
        requester_id: profile.user_id, requester_username: profile.username,
        reason, proof: '', status: 'pending'
      });
      return `⚠️ Ban request for ${target.username} submitted. The owner will review it.`;
    }
    if (cmd === 'setrole') {
      const m = arg.match(/^(\S+)\s+(player|moderator|admin|co-owner|owner)$/);
      if (!m) return '👑 Usage: /setrole <username> <role>';
      const players = await base44.entities.PlayerProfile.filter({});
      const target = players.find(p => (p.username || '').toLowerCase() === m[1].toLowerCase());
      if (!target) return `👑 User "${m[1]}" not found.`;
      await base44.entities.PlayerProfile.update(target.id, { role: m[2] });
      return `👑 Set ${target.username}'s role to ${m[2]}.`;
    }
  }

  if (canMute && (cmd === 'mute' || cmd === 'unmute')) {
    if (!arg) return `⚠️ Usage: /${cmd} <username>`;
    const players = await base44.entities.PlayerProfile.filter({});
    const target = players.find(p => (p.username || '').toLowerCase() === arg.toLowerCase());
    if (!target) return `⚠️ User "${arg}" not found.`;
    const data = cmd === 'mute' ? { is_muted: true, mute_until: new Date(Date.now() + 3600000).toISOString() } : { is_muted: false, mute_until: null };
    await base44.entities.PlayerProfile.update(target.id, data);
    return `⚠️ ${target.username} ${cmd === 'mute' ? 'muted (1h)' : 'unmuted'}.`;
  }

  return `❓ Unknown command: /${cmd}. Available: /pp, /quantity, /user, /blook, /unscramble, /riddle, /gtb, /gtb2, /gtp${isStaff ? ', /give, /ban, /unban, /mute, /unmute, /setrole' : canMute ? ', /mute, /unmute' : ''}`;
}

// One-call fetch of all active chat-game answers. Replaces the five separate
// GameSettings.filter calls Chat used to fire on every single message, which
// was the main cause of API rate-limit errors during active chat.
export async function getActiveGames() {
  const rows = await base44.entities.GameSettings.filter({ category: 'general' });
  const map = {};
  rows.forEach(r => { map[r.key] = r.value; });
  let riddle = null;
  try { if (map['riddle_answer']) riddle = JSON.parse(map['riddle_answer']); } catch {}
  return {
    unscramble: map['unscramble_answer'] || null,
    riddle,
    gtb: map['gtb_answer'] || null,
    gtb2: map['gtb2_answer'] || null,
    gtp: map['gtp_answer'] || null,
  };
}

export async function getActiveUnscramble() {
  const active = await base44.entities.GameSettings.filter({ key: 'unscramble_answer' });
  return active[0]?.value || null;
}

export async function clearUnscramble() {
  const active = await base44.entities.GameSettings.filter({ key: 'unscramble_answer' });
  if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: '' });
}

export async function getActiveGtb() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtb_answer' });
  return active[0]?.value || null;
}

export async function clearGtb() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtb_answer' });
  if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: '' });
}

export async function getActiveGtb2() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtb2_answer' });
  return active[0]?.value || null;
}

export async function clearGtb2() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtb2_answer' });
  if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: '' });
}

export async function getActiveGtp() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtp_answer' });
  return active[0]?.value || null;
}

export async function clearGtp() {
  const active = await base44.entities.GameSettings.filter({ key: 'gtp_answer' });
  if (active.length > 0) await base44.entities.GameSettings.update(active[0].id, { value: '' });
}