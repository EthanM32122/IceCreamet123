import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

// base44 vite-plugin hardcodes @/ -> <root>/src/.
// This repo keeps source at the root (ui/, game/, pages/, lib/, ...),
// so we force-correct the alias AFTER base44 runs (enforce: 'post').
function rootAliasPlugin() {
  const aliases = [
    { find: '@/components/ui', replacement: path.join(root, 'ui') },
    { find: '@/components/game', replacement: path.join(root, 'game') },
    { find: '@/components/minigames', replacement: path.join(root, 'minigames') },
    { find: '@/components/stats', replacement: path.join(root, 'stats') },
    // @/components/Foo -> ./Foo.jsx (root-level component files)
    { find: /^@\/components\/([^/]+)$/, replacement: path.join(root, '$1') },
    { find: '@/components/', replacement: root + path.sep },
    // Everything else: @/lib, @/pages, @/api, @/hooks, @/App.jsx, ...
    { find: '@', replacement: root },
  ]

  const apply = (config) => {
    config.resolve = config.resolve || {}
    // Replace whatever base44 set so @ never points at missing /src
    config.resolve.alias = aliases
  }

  return {
    name: 'icecreamet-root-alias',
    enforce: 'post',
    config: apply,
    configResolved(config) {
      // configResolved receives a resolved config; mutate alias again in case
      // base44 wrote it during its own configResolved.
      config.resolve.alias = aliases
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    rootAliasPlugin(),
  ],
});
