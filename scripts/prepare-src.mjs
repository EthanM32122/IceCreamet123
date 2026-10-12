#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'
import { applyLiveMessagePatches, applyMarketLagPatches, applyAdminUnbanPatches } from './market-patches.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const src = path.join(root, 'src')

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }) }
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }) }
function copy(fromRel, toRel) {
  const from = path.join(root, fromRel)
  const to = path.join(root, toRel)
  if (!fs.existsSync(from)) { console.warn(`[prepare-src] skip missing: ${fromRel}`); return }
  ensureDir(path.dirname(to))
  fs.cpSync(from, to, { recursive: true, force: true })
  console.log(`[prepare-src] ${fromRel} -> ${toRel}`)
}
function download(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'icecreamet-prepare-src' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        download(res.headers.location).then(resolve, reject); return
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode} for ${url}`)); return }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    }).on('error', reject)
  })
}

async function restoreOriginalChat() {
  const url = 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/2e551976635775dc1ca294dc1d0a8af3d9e0e389/pages/Chat.jsx'
  try {
    console.log('[prepare-src] downloading Chat.jsx ...')
    let source = await download(url)
    source = applyLiveMessagePatches(source)
    fs.writeFileSync(path.join(root, 'pages', 'Chat.jsx'), source, 'utf8')
    console.log('[prepare-src] restored pages/Chat.jsx')
  } catch (e) { console.warn('[prepare-src] Chat restore failed:', e.message) }
}

async function restoreHomeMarket() {
  const url = 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/d5642dc5d241c9a142a20a6f08ff53dc81484e50/pages/Home.jsx'
  try {
    console.log('[prepare-src] downloading Home.jsx ...')
    let source = await download(url)
    source = applyMarketLagPatches(source)
    fs.writeFileSync(path.join(root, 'pages', 'Home.jsx'), source, 'utf8')
    console.log('[prepare-src] restored pages/Home.jsx')
  } catch (e) { console.warn('[prepare-src] Home restore failed:', e.message) }
}

async function restoreAdminPanel() {
  const url = 'https://raw.githubusercontent.com/EthanM32122/IceCreamet123/35e68f3cf03208dad26d35f528897fdb136016af/pages/AdminPanel.jsx'
  try {
    console.log('[prepare-src] downloading AdminPanel.jsx ...')
    let source = await download(url)
    if (!source || source.length < 1000 || source.includes('TOO_LARGE')) throw new Error('bad AdminPanel download')
    source = applyAdminUnbanPatches(source)
    fs.writeFileSync(path.join(root, 'pages', 'AdminPanel.jsx'), source, 'utf8')
    console.log('[prepare-src] restored pages/AdminPanel.jsx')
  } catch (e) { console.warn('[prepare-src] AdminPanel restore failed:', e.message) }
}

rmrf(src)
ensureDir(src)
ensureDir(path.join(src, 'components'))
await restoreOriginalChat()
await restoreHomeMarket()
await restoreAdminPanel()
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
