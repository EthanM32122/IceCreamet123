#!/usr/bin/env node
/**
 * Assembles a standard Base44/Vite `src/` tree from this repo's root layout.
 * Also restores the full original Chat UI (from a known-good commit) and
 * applies only the live-message patches (appendMessage + safe 3s poll).
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
  const newCreate = `        if (event.data.is_deleted) return;
        appendMessage(event.data);`
  if (t.includes(oldCreate)) t = t.replace(oldCreate, newCreate)

  const oldRet = `    return () => { unsub(); };
  }, []);`
  const newRet = `    const poll = setInterval(async () => {
      try {
        const msgs = await base44.entities.ChatMessage.filter({ is_deleted: false, game: 'icecreamet' }, '-created_date', 40);
        if (!Array.isArray(msgs) || !msgs.length) return;
        const incoming = msgs.filter(m => !m.channel || m.channel === 'global');
        setMessages(prev => {
          // ONLY add — never re-sort/drop existing messages (idle was wiping chat)
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
  const newPost = `    appendMessage(msg);
    try {
      base44.functions.invoke('discordSendChat', {
        username: profile.username, content: content || '', avatarUrl: profile.avatar_url, imageUrl
      }).catch(() => {});
    } catch (e) {}
    return msg;`
  if (t.includes(oldPost)) t = t.replace(oldPost, newPost)

  const oldBot = "await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet' });"
  const newBot = "const botMsg = await base44.entities.ChatMessage.create({ content, username: 'ICECREAMET Bot', avatar_url: botAvatar, is_system: true, user_role: 'admin', game: 'icecreamet', channel: 'global' });\n    appendMessage(botMsg);"
  if (t.includes(oldBot)) t = t.replace(oldBot, newBot)

  return t
}

async function restoreOriginalChat() {
  const url =
    'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/2e551976635775dc1ca294dc1d0a8af3d9e0e389/pages/Chat.jsx'
  try {
    console.log('[prepare-src] downloading original Chat.jsx ...')
    let source = await download(url)
    source = applyLiveMessagePatches(source)
    const out = path.join(root, 'pages', 'Chat.jsx')
    fs.writeFileSync(out, source, 'utf8')
    console.log('[prepare-src] restored pages/Chat.jsx (original UI + live messages)')
  } catch (e) {
    console.warn('[prepare-src] could not restore original Chat:', e.message)
    console.warn('[prepare-src] keeping existing pages/Chat.jsx')
  }
}

rmrf(src)
ensureDir(src)
ensureDir(path.join(src, 'components'))

await restoreOriginalChat()

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
