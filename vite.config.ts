import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import { fileURLToPath } from 'node:url'
import { modulesPlugin } from './vite/modules-plugin'
import { shikiPlugin } from './vite/shiki-plugin'

export default defineConfig({
  plugins: [
    modulesPlugin(),
    shikiPlugin(),
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm], rehypePlugins: [rehypeSlug] }) },
    react(),
    tailwind(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
      '@kit': fileURLToPath(new URL('./src/kit', import.meta.url)),
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
    },
  },
  build: {
    // Bundle discipline is the app's thesis; make a regression visible in the log.
    chunkSizeWarningLimit: 100,
    rollupOptions: {
      output: {
        /**
         * ONE CHUNK PER CONTENT MODULE, named for it.
         *
         * Without this, every module's `sim`/`claims`/`items`/`body` becomes a
         * separate hashed chunk and the per-module budget silently measures the
         * SUM across all built modules instead of one. A budget that measures the
         * wrong thing is worse than no budget.
         */
        manualChunks(id) {
          const m = id.match(/[/\\]content[/\\][a-z]+[/\\]([a-z0-9-]+)[/\\]/)
          return m ? `m-${m[1]}` : undefined
        },
      },
    },
  },
})
