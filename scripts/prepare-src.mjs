#!/usr/bin/env node
/**
 * Assembles Vite src/ tree. Restores Chat + safe Market (max 100 packs, no Max button).
 */
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(root, 'src')

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true })
}
function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}
function copy(fromRel, toRel) {
  const from = path.join(root, fromRel)
  const to = path.join(root, toRel)
  if (!fs.existsSync(from)) {
    console.warn(`[prepare-src] skip missing: ${fromRel}`)
    return
  }
  ensureDir(path.dirname(to))
  fs.cpSync(from, to, { recursive: true, force: true })
  console.log(`[prepare-src] ${fromRel} -> ${toRel}`)
}
function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'icecreamet-prepare-src' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          download(res.headers.location).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`))
          return
        }
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
  })
}

function applyLiveMessagePatches(source) {
  let t = source
  const anchor = '  const sendingRef = useRef(false);\n'
  const helper = `
  const appendMessage = (msg) => {
    if (!msg || !msg.id || msg.is_deleted) return;
    if (msg.game && msg.game !== 'icecreamet') return;
    if (msg.channel && msg.channel !== 'global') return;
    const stamped = msg.created_date ? msg : { ...msg, created_date: new Date().toISOString() };
    setMessages(prev => prev.some(m => m.id === stamped.id) ? prev : [...prev, stamped].slice(-100));
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

`
  if (t.includes(anchor) && !t.includes('const appendMessage')) {
    t = t.replace(anchor, anchor + helper)
  }
  const oldCreate = `        if (event.data.is_deleted) return;
        setMessages(prev => prev.some(m => m.id === event.data.id) ? prev : [...prev, event.data].slice(-50));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);`
  if (t.includes(oldCreate)) t = t.replace(oldCreate, `        if (event.data.is_deleted) return;
        appendMessage(event.data);`)
  const oldRet = `    return () => { unsub(); };
  }, []);`
  const newRet = `    const poll = setInterval(async () => {
      try {
        const msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 40);
        if (!Array.isArray(msgs) || !msgs.length) return;
        const incoming = msgs.filter(m => !m.channel || m.channel === 'global');
        setMessages(prev => {
          const existing = new Set(prev.map(m => m.id));
          const toAdd = incoming.filter(m => m.id && !existing.has(m.id));
          if (!toAdd.length) return prev;
          return [...prev, ...[...toAdd].reverse()].slice(-100);
        });
      } catch (e) {}
    }, 3000);
    return () => { try { unsub(); } catch {} clearInterval(poll); };
  }, []);`
  if (t.includes(oldRet)) t = t.replace(oldRet, newRet)
  const oldPost = `    try {
      base44.functions.invoke('discordSendChat', {
        username: profile.username, content: content || '', avatarUrl: profile.avatar_url, imageUrl
      }).catch(() => {});
    } catch (e) {}
    return msg;`
  if (t.includes(oldPost)) {
    t = t.replace(oldPost, `    appendMessage(msg);
` + oldPost)
  }
  const oldBot = "await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet' });"
  const newBot = "const botMsg = await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet', channel: 'global' });\n    appendMessage(botMsg);"
  if (t.includes(oldBot)) t = t.replace(oldBot, newBot)
  return t
}

/** Safe market: max 100 packs, no Max button, charge tokens once only. */
function applyMarketLagPatches(source) {
  let t = source

  if (!t.includes('MAX_PACKS_PER_OPEN')) {
    t = t.replace(
      '  const [bulkCount, setBulkCount] = useState(10);',
      '  const [bulkCount, setBulkCount] = useState(10);\n  const MAX_PACKS_PER_OPEN = 100; // hard safe cap'
    )
  } else {
    t = t.replace(/const MAX_PACKS_PER_OPEN = \d+;[^\n]*/, 'const MAX_PACKS_PER_OPEN = 100; // hard safe cap')
  }

  // Multi-pack buys use bulk; never queue millions of single opens
  t = t.replace(
    /const startPurchase = \(pack, qty\) => \{\s*if \(!pack \|\| qty < 1\) return;\s*queueRef\.current = \{ pack, remaining: qty \};\s*setPurchaseQueue\(queueRef\.current\);\s*openPack\(pack\);\s*\};/,
    `const startPurchase = (pack, qty) => {
    if (!pack || qty < 1) return;
    const n = Math.min(Math.max(1, Math.floor(qty)), MAX_PACKS_PER_OPEN);
    if (n > 1) { openBulk(pack, n); return; }
    queueRef.current = { pack, remaining: 1 };
    setPurchaseQueue(queueRef.current);
    openPack(pack);
  };`
  )

  t = t.replace(
    /const handlePackClick = \(pack\) => \{[\s\S]*?if \(instantRef\.current \|\| autoRef\.current\) \{ openPack\(pack\); \}\s*else \{ setConfirmPack\(pack\); \}\s*\};/,
    `const handlePackClick = (pack) => {
    if (instantRef.current || autoRef.current) { openPack(pack); }
    else { setPurchasePack(pack); }
  };`
  )

  const oldOpenHead = `  const openBulk = async (pack, count) => {
    if (!bulkEnabled) return;
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenUnitCost = Math.round(pack.cost * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const totalCost = unitCost * count;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : (profileRef.current.tokens || 0);
    if (!profile || bulkBusy || balance < totalCost) return;`

  const newOpenHead = `  const openBulk = async (pack, count) => {
    const useDiamonds = diamondModeRef.current;
    const plusActive = !!profileRef.current.plus_permanent || (profileRef.current.plus_until && new Date(profileRef.current.plus_until) > new Date());
    const tokenUnitCost = Math.round(Number(pack.cost) * (plusActive ? 0.9 : 1));
    const unitCost = useDiamonds ? DIAMOND_PACK_COST : tokenUnitCost;
    const balance = useDiamonds ? (profileRef.current.diamonds || 0) : Math.floor(Number(profileRef.current.tokens) || 0);
    // Never open more than 100; never charge for more than we open
    count = Math.min(Math.max(1, Math.floor(count || 1)), MAX_PACKS_PER_OPEN);
    const maxAffordable = unitCost > 0 ? Math.floor(balance / unitCost) : 0;
    count = Math.min(count, maxAffordable);
    if (count < 1) return;
    const totalCost = unitCost * count;
    if (!profile || bulkBusy || balance < totalCost) return;`

  if (t.includes(oldOpenHead)) t = t.replace(oldOpenHead, newOpenHead)

  // Fix double charge: save balance - totalCost once (not after optimistic already deducted)
  const oldDeduct = `    if (useDiamonds) profilePatch.diamonds = Math.round(((profileRef.current.diamonds || 0) - totalCost) * 100) / 100;
    else profilePatch.tokens = profileRef.current.tokens - totalCost;`
  const newDeduct = `    if (useDiamonds) profilePatch.diamonds = Math.max(0, Math.round((balance - totalCost) * 100) / 100);
    else profilePatch.tokens = Math.max(0, balance - totalCost);`
  if (t.includes(oldDeduct)) t = t.replace(oldDeduct, newDeduct)

  const oldOpt = `    const optimisticProfile = { ...profileRef.current, [currencyField]: Math.round(((profileRef.current[currencyField] || 0) - totalCost) * 100) / 100 };`
  const newOpt = `    const newBal = useDiamonds ? Math.max(0, Math.round((balance - totalCost) * 100) / 100) : Math.max(0, balance - totalCost);
    const optimisticProfile = { ...profileRef.current, [currencyField]: newBal };`
  if (t.includes(oldOpt)) t = t.replace(oldOpt, newOpt)

  // Bulk bar: x10 / x25 / x100 only — no Max
  const oldBulk = `            <Input type="number" value={bulkCount} onChange={e => setBulkCount(Math.max(1, Math.min(1000000, parseInt(e.target.value) || 1)))} className="w-20 bg-white/10 border-white/20 text-white text-center" />
            <Button size="sm" variant="outline" onClick={() => setBulkCount(10)} className="border-white/20 text-white">x10</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCount(25)} className="border-white/20 text-white">x25</Button>`
  const newBulk = `            <Input type="number" min={1} max={100} value={bulkCount} onChange={e => setBulkCount(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))} className="w-20 bg-white/10 border-white/20 text-white text-center" />
            <Button size="sm" variant="outline" onClick={() => setBulkCount(10)} className="border-white/20 text-white">x10</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCount(25)} className="border-white/20 text-white">x25</Button>
            <Button size="sm" variant="outline" onClick={() => setBulkCount(100)} className="border-white/20 text-white">x100</Button>`
  if (t.includes(oldBulk)) t = t.replace(oldBulk, newBulk)

  return t
}

async function restoreOriginalChat() {
  const url =
    'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/2e551976635775dc1ca294dc1d0a8af3d9e0e389/pages/Chat.jsx'
  try {
    console.log('[prepare-src] downloading original Chat.jsx ...')
    let source = await download(url)
    source = applyLiveMessagePatches(source)
    fs.writeFileSync(path.join(root, 'pages', 'Chat.jsx'), source, 'utf8')
    console.log('[prepare-src] restored pages/Chat.jsx')
  } catch (e) {
    console.warn('[prepare-src] could not restore Chat:', e.message)
  }
}

async function restoreHomeMarket() {
  const homePath = path.join(root, 'pages', 'Home.jsx')
  const url =
    'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/d5642dc5d241c9a142a20a6f08ff53dc81484e50/pages/Home.jsx'
  try {
    console.log('[prepare-src] downloading Home.jsx (safe bulk max 100) ...')
    let source = await download(url)
    source = applyMarketLagPatches(source)
    fs.writeFileSync(homePath, source, 'utf8')
    console.log('[prepare-src] restored pages/Home.jsx')
  } catch (e) {
    console.warn('[prepare-src] could not restore Home:', e.message)
  }
}

rmrf(src)
ensureDir(src)
ensureDir(path.join(src, 'components'))

await restoreOriginalChat()
await restoreHomeMarket()

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

const rootComponents = [
  'AuthLayout.jsx',
  'BlookJumpers.jsx',
  'GoogleIcon.jsx',
  'ProtectedRoute.jsx',
  'ScrollToTop.jsx',
  'UpdateChecker.jsx',
  'UserNotRegisteredError.jsx',
]
for (const file of rootComponents) {
  copy(file, path.join('src/components', file))
}

const componentsDir = path.join(root, 'components')
if (fs.existsSync(componentsDir)) {
  for (const name of fs.readdirSync(componentsDir)) {
    const full = path.join(componentsDir, name)
    if (fs.statSync(full).isFile()) {
      copy(path.join('components', name), path.join('src/components', name))
    }
  }
}

console.log('[prepare-src] done')
