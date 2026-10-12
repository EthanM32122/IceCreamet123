#!/usr/bin/env node
/**
 * Assembles a standard Base44/Vite `src/` tree from this repo's root layout.
 *
 * Repo stores frontend at the root:
 *   main.jsx, App.jsx, index.css, pages/, lib/, api/, hooks/,
 *   ui/, game/, minigames/, stats/, and root-level component files.
 *
 * Vite + @ imports expect:
 *   src/main.jsx, src/App.jsx, src/components/ui/, src/lib/, ...
 *
 * Run before `vite build` so Railway does not need path-alias hacks.
 */
import fs from 'node:fs'
import path from 'node:path'
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

// Clean previous assemble (keep node_modules/dist alone)
rmrf(src)
ensureDir(src)
ensureDir(path.join(src, 'components'))

// Entry + styles
copy('main.jsx', 'src/main.jsx')
copy('App.jsx', 'src/App.jsx')
copy('index.css', 'src/index.css')

// Core folders
copy('api', 'src/api')
copy('lib', 'src/lib')
copy('pages', 'src/pages')
copy('hooks', 'src/hooks')
copy('utils', 'src/utils')

// Components: ui + game modules under components/
copy('ui', 'src/components/ui')
copy('game', 'src/components/game')
copy('minigames', 'src/components/minigames')
copy('stats', 'src/components/stats')

// Root-level component files imported as @/components/Name
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

// Files already under components/ (e.g. AppErrorBoundary.jsx)
const componentsDir = path.join(root, 'components')
if (fs.existsSync(componentsDir)) {
  for (const name of fs.readdirSync(componentsDir)) {
    // Skip nested dirs already handled above (ui/game/...) if present here
    const full = path.join(componentsDir, name)
    const st = fs.statSync(full)
    if (st.isFile()) {
      copy(path.join('components', name), path.join('src/components', name))
    }
  }
}

console.log('[prepare-src] done')
