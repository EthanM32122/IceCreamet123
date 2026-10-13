#!/usr/bin/env node
/**
 * Build-time: restore Chat/Home/AdminPanel/Bazaar and patch TradeRoom.
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { applyMarketPatches } from './market-patches.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(root, 'src')

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }) }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }
function copy(fromRel, toRel) {
  const from = path.join(root, fromRel)
  const to = path.join(root, toRel)
  if (!fs.existsSync(from)) { console.warn('[prepare-src] skip', fromRel); return }
  ensureDir(path.dirname(to))
  fs.cpSync(from, to, { recursive: true, force: true })
  console.log('[prepare-src]', fromRel, '->', toRel)
}
function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'icecreamet-prepare-src' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve, reject); return
      }
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

function applyLiveMessagePatches(t) {
  const anchor = '  const sendingRef = useRef(false);\n'
  const helper = `\n  const appendMessage = (msg) => {\n    if (!msg || !msg.id || msg.is_deleted) return;\n    if (msg.game && msg.game !== 'icecreamet') return;\n    if (msg.channel && msg.channel !== 'global') return;\n    const stamped = msg.created_date ? msg : { ...msg, created_date: new Date().toISOString() };\n    setMessages(prev => prev.some(m => m.id === stamped.id) ? prev : [...prev, stamped].slice(-100));\n    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);\n  };\n\n`
  if (t.includes(anchor) && !t.includes('const appendMessage')) t = t.replace(anchor, anchor + helper)
  t = t.replace(
    `        if (event.data.is_deleted) return;\n        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data].slice(-50));\n        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);`,
    `        if (event.data.is_deleted) return;\n        appendMessage(event.data);`
  )
  const oldRet = `    return () => { unsub(); };\n  }, []);`
  const newRet = `    const poll = setInterval(async () => {\n      try {\n        const msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 40);\n        if (!Array.isArray(msgs) || !msgs.length) return;\n        const incoming = msgs.filter(m => !m.channel || m.channel === 'global');\n        setMessages(prev => {\n          const existing = new Set(prev.map(m => m.id));\n          const toAdd = incoming.filter(m => m.id && !existing.has(m.id));\n          if (!toAdd.length) return prev;\n          return [...prev, ...[...toAdd].reverse()].slice(-100);\n        });\n      } catch (e) {}\n    }, 3000);\n    return () => { try { unsub(); } catch {} clearInterval(poll); };\n  }, []);`
  if (t.includes(oldRet)) t = t.replace(oldRet, newRet)
  return t
}

function applyAdminUnbanPatches(t) {
  const oldToggle = `  const toggleBan = async (player) => {
    const canUnbanProtected = isProtected(player) && player.is_banned && ROLE_HIERARCHY[adminProfile.role] >= ROLE_HIERARCHY.admin;
    if (!canModerate(adminProfile, player) && !canUnbanProtected) return;
    if (player.is_banned) {
      try { await adminUpdateProfile(adminProfile, player, { is_banned: false, ban_reason: '', banned_by: '' }); } catch (e) { alert('Failed: ' + (e.message || 'admin service unavailable')); }
      loadPlayers();
      return;
    }
    if (isProtected(player)) return;
    setBanDialogPlayer(player);
    setBanReason('');
    setBanProof('');
  };`
  const newToggle = `  const toggleBan = async (player) => {
    const rank = ROLE_HIERARCHY[adminProfile.role] || 0;
    if (player.is_banned) {
      if (rank < ROLE_HIERARCHY.moderator) { alert('Only moderators+ can unban.'); return; }
      try {
        const res = await adminUpdateProfile(adminProfile, player, { is_banned: false, ban_reason: '', banned_by: '' });
        setPlayers(prev => prev.map(p => p.id === player.id || p.user_id === player.user_id ? { ...p, is_banned: false, ban_reason: '', banned_by: '' } : p));
        alert(res?.message || ('Unbanned ' + (player.username || 'user')));
      } catch (e) { alert('Unban failed: ' + (e.message || 'permission or network error')); }
      loadPlayers();
      return;
    }
    if (!canModerate(adminProfile, player)) { alert('You cannot ban this user.'); return; }
    if (isProtected(player)) return;
    setBanDialogPlayer(player); setBanReason(''); setBanProof('');
  };`
  if (t.includes(oldToggle)) t = t.replace(oldToggle, newToggle)
  t = t.replace(
    `{(canModerate(adminProfile, player) || (isProtected(player) && player.is_banned && isOwner)) && (`,
    `{((player.is_banned && (ROLE_HIERARCHY[adminProfile.role] || 0) >= ROLE_HIERARCHY.moderator) || canModerate(adminProfile, player)) && (`
  )
  return t
}

function applyBazaarPatches(t) {
  if (!t.includes("economyActions")) {
    t = t.replace(
      "import { BAZAAR_RESTRICTED_BLOOK_IDS } from '@/lib/hivelands';",
      "import { BAZAAR_RESTRICTED_BLOOK_IDS } from '@/lib/hivelands';\nimport { bazaarList, bazaarBuy, bazaarCancel } from '@/lib/economyActions';"
    )
  }
  t = t.replace(
    /const buyListing = async \(listing\) => \{[\s\S]*?loadData\(\);\s*\};/,
    `const buyListing = async (listing) => {
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(listing.blook_id)) return;
    if (!profile || profile.tokens < listing.price) return;
    if (listing.seller_id === profile.user_id) return;
    try {
      const data = await bazaarBuy(listing.id);
      if (data?.profile) await updateProfile(data.profile);
      else await updateProfile({ tokens: profile.tokens - listing.price });
    } catch (e) {
      alert(e?.message || 'Purchase failed — try again');
      return;
    }
    setMyBlooks(await base44.entities.PlayerBlook.filter({ user_id: profile.user_id, game: 'icecreamet' }));
    loadData();
  };`
  )
  t = t.replace(
    /const cancelListing = async \(listing\) => \{[\s\S]*?loadData\(\);\s*\};/,
    `const cancelListing = async (listing) => {
    try { await bazaarCancel(listing.id); } catch (e) { alert(e?.message || 'Cancel failed'); return; }
    loadData();
  };`
  )
  t = t.replace(
    /const confirmList = async \(\) => \{[\s\S]*?setListDialog\(null\);[\s\S]*?loadData\(\);\s*\};/,
    `const confirmList = async () => {
    if (!listDialog || !listPrice) return;
    if (BAZAAR_RESTRICTED_BLOOK_IDS.has(listDialog.blook_id)) return;
    const price = parseInt(listPrice) || 0;
    if (price <= 0) return;
    try { await bazaarList({ blook_id: listDialog.blook_id, price, isShiny: !!listDialog.isShiny }); }
    catch (e) { alert(e?.message || 'Failed to list item'); return; }
    setListDialog(null); setListPrice(''); loadData();
  };`
  )
  return t
}

function applyTradeRoomPatches(t) {
  if (!t.includes('clientSettleLiveTrade')) {
    t = t.replace(
      "import { getActiveBlooks } from '@/lib/gameDataCache';",
      "import { getActiveBlooks } from '@/lib/gameDataCache';\nimport { clientSettleLiveTrade } from '@/lib/tradeClient';"
    )
  }
  if (t.includes("await base44.functions.invoke('executeTrade'")) {
    t = t.replace(
      "await base44.functions.invoke('executeTrade', { room_id: r.id });",
      `try {
        const inv = base44.functions.invoke('executeTrade', { room_id: r.id });
        inv.catch(() => {});
        await Promise.race([inv, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))]);
      } catch (_) {
        await clientSettleLiveTrade(fresh, profile, updateProfile);
      }`
    )
  }
  return t
}

async function restore(name, url, patchFn) {
  try {
    console.log('[prepare-src] downloading', name, '...')
    let source = await download(url)
    if (patchFn) source = patchFn(source)
    fs.writeFileSync(path.join(root, 'pages', name), source, 'utf8')
    console.log('[prepare-src] restored', name)
  } catch (e) {
    console.warn('[prepare-src]', name, 'failed:', e.message)
  }
}

rmrf(src)
ensureDir(src)
ensureDir(path.join(src, 'components'))

await restore('Chat.jsx', 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/2e551976635775dc1ca294dc1d0a8af3d9e0e389/pages/Chat.jsx', applyLiveMessagePatches)
await restore('Home.jsx', 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/d5642dc5d241c9a142a20a6f08ff53dc81484e50/pages/Home.jsx', applyMarketPatches)
await restore('AdminPanel.jsx', 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/35e68f3cf03208dad26d35f528897fdb136016af/pages/AdminPanel.jsx', applyAdminUnbanPatches)
await restore('Bazaar.jsx', 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/afe935d2/pages/Bazaar.jsx', applyBazaarPatches)

{
  const p = path.join(root, 'pages', 'TradeRoom.jsx')
  if (fs.existsSync(p)) {
    let t = fs.readFileSync(p, 'utf8')
    t = applyTradeRoomPatches(t)
    fs.writeFileSync(p, t, 'utf8')
    console.log('[prepare-src] patched pages/TradeRoom.jsx')
  }
}

copy('main.jsx', 'src/main.jsx')
copy('App.jsx', 'src/App.jsx')
copy('index.css', 'src/index.css')
copy('api', 'src/api')
copy('lib', 'src/lib')
copy('pages', 'src/pages')
copy('hooks', 'src/hooks')
copy('utils', 'src/utils')
copy('ui', 'src/components/ui')
copy('game', 'src/components/game')
copy('minigames', 'src/components/minigames')
copy('stats', 'src/components/stats')
for (const file of ['AuthLayout.jsx','BlookJumpers.jsx','GoogleIcon.jsx','ProtectedRoute.jsx','ScrollToTop.jsx','UpdateChecker.jsx','UserNotRegisteredError.jsx']) {
  copy(file, path.join('src/components', file))
}
const componentsDir = path.join(root, 'components')
if (fs.existsSync(componentsDir)) {
  for (const name of fs.readdirSync(componentsDir)) {
    const full = path.join(componentsDir, name)
    if (fs.statSync(full).isFile()) copy(path.join('components', name), path.join('src/components', name))
  }
}
console.log('[prepare-src] done')
