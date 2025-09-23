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
    fs: { strict: false }
  }
});
