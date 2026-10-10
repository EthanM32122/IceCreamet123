import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

/**
 * This repo stores frontend source at the ROOT (not under src/):
 *   App.jsx, main.jsx, index.css, pages/, lib/, api/, hooks/,
 *   ui/, game/, minigames/, stats/, and root-level components.
 *
 * Imports use @/components/ui/* and @/components/game/* paths that
 * Base44's editor expects, so we map those folders explicitly.
 *
 * The @base44/vite-plugin is intentionally NOT used here: it hardcodes
 * @/ -> /src/ which does not exist in this snapshot and breaks Railway builds.
 * Auth/data still go through @base44/sdk in api/base44Client.js.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@/components/ui', replacement: path.join(root, 'ui') },
      { find: '@/components/game', replacement: path.join(root, 'game') },
      { find: '@/components/minigames', replacement: path.join(root, 'minigames') },
      { find: '@/components/stats', replacement: path.join(root, 'stats') },
      // @/components/ProtectedRoute -> ./ProtectedRoute.jsx etc.
      { find: '@/components/', replacement: root + path.sep },
      { find: '@', replacement: root },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
