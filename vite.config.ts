// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    sveltekit(),
    tailwindcss()
  ],
  optimizeDeps: {
    exclude: ['fsevents', 'lightningcss']
  },
  server: {
    fs: { strict: false },
    hmr: {overlay: false}
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Only chunk client-side code, not SSR/external modules
          if (id.includes('node_modules')) {
            // Check if it's Supabase related
            if (id.includes('@supabase/')) {
              return 'supabase';
            }
            // Check if it's Svelte related
            if (id.includes('svelte')) {
              return 'svelte-vendor';
            }
          }
        }
      }
    }
  }
});