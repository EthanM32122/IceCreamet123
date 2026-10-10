import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
  resolve: {
    // Array form: more-specific finds MUST come before the generic '@' alias.
    // Imports use @/components/ui/* but files live in ./ui/* (same for game/minigames/stats).
    // Root-level component files (ProtectedRoute, ScrollToTop, ...) are imported as
    // @/components/Name and resolve via the @/components/ -> root mapping.
    alias: [
      { find: '@/components/ui', replacement: path.join(root, 'ui') },
      { find: '@/components/game', replacement: path.join(root, 'game') },
      { find: '@/components/minigames', replacement: path.join(root, 'minigames') },
      { find: '@/components/stats', replacement: path.join(root, 'stats') },
      { find: '@/components/', replacement: root + path.sep },
      { find: '@', replacement: root },
    ],
  },
});
