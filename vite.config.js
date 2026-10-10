import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

/**
 * Frontend source lives at the REPO ROOT (not under src/):
 *   App.jsx, main.jsx, index.css, pages/, lib/, api/, hooks/,
 *   ui/, game/, minigames/, stats/, plus root-level component files.
 *
 * Code imports use Base44-style paths (@/components/ui/..., @/lib/...).
 * Map those to the real folders. Do NOT use @base44/vite-plugin — it
 * hardcodes @/ -> /src/ and breaks this layout on Railway.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/components\/ui(\/.*)?$/, replacement: path.join(root, 'ui') + '$1' },
      { find: /^@\/components\/game(\/.*)?$/, replacement: path.join(root, 'game') + '$1' },
      { find: /^@\/components\/minigames(\/.*)?$/, replacement: path.join(root, 'minigames') + '$1' },
      { find: /^@\/components\/stats(\/.*)?$/, replacement: path.join(root, 'stats') + '$1' },
      // @/components/ProtectedRoute -> /ProtectedRoute (root file)
      { find: /^@\/components\/([^/]+)$/, replacement: path.join(root, '$1') },
      // @/lib/foo, @/pages/Home, @/App.jsx, @/index.css, ...
      { find: /^@\/(.*)$/, replacement: path.join(root, '$1') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
