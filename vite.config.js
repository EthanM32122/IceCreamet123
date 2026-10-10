import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

/**
 * base44 vite-plugin hardcodes `@/` -> `<root>/src/`.
 * This repo keeps frontend source at the repo root:
 *   ui/, game/, minigames/, stats/, pages/, lib/, api/, hooks/,
 *   and a few root-level components imported as @/components/Name.
 *
 * A resolveId plugin with enforce:'pre' intercepts @ imports before the
 * broken /src alias can fail the build.
 */
function rootAliasPlugin() {
  const tryFile = (base) => {
    for (const ext of ['', '.jsx', '.js', '.tsx', '.ts', '/index.jsx', '/index.js']) {
      const candidate = base + ext
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
    }
    return null
  }

  const mapId = (id) => {
    if (!id.startsWith('@/')) return null

    // @/components/ui/foo  -> ui/foo
    if (id.startsWith('@/components/ui/')) {
      return tryFile(path.join(root, 'ui', id.slice('@/components/ui/'.length)))
    }
    if (id.startsWith('@/components/game/')) {
      return tryFile(path.join(root, 'game', id.slice('@/components/game/'.length)))
    }
    if (id.startsWith('@/components/minigames/')) {
      return tryFile(path.join(root, 'minigames', id.slice('@/components/minigames/'.length)))
    }
    if (id.startsWith('@/components/stats/')) {
      return tryFile(path.join(root, 'stats', id.slice('@/components/stats/'.length)))
    }
    // @/components/Foo (single segment) -> ./Foo at repo root
    if (id.startsWith('@/components/')) {
      const rest = id.slice('@/components/'.length)
      if (!rest.includes('/')) {
        return tryFile(path.join(root, rest))
      }
    }
    // @/lib, @/pages, @/api, @/hooks, @/App.jsx, @/index.css, ...
    return tryFile(path.join(root, id.slice(2)))
  }

  return {
    name: 'icecreamet-root-alias',
    enforce: 'pre',
    resolveId(id) {
      return mapId(id)
    },
  }
}

export default defineConfig({
  plugins: [
    rootAliasPlugin(),
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
});
