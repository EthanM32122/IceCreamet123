import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    alias: {
      // Source lives at repo root (not under src/). Map @ and common shadcn paths.
      '@': path.resolve(__dirname, '.'),
      '@/components/ui': path.resolve(__dirname, 'ui'),
      '@/components/game': path.resolve(__dirname, 'game'),
      '@/components/minigames': path.resolve(__dirname, 'minigames'),
      '@/components/stats': path.resolve(__dirname, 'stats'),
      '@/components': path.resolve(__dirname, '.'),
    }
  }
});
