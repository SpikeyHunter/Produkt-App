import adapter from '@sveltejs/adapter-vercel'; // (or adapter-auto depending on your setup)
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),

	kit: {
		adapter: adapter(),
		
		// THE NEW SVELTEKIT WAY TO ALLOW EXTERNAL POSTS:
		csrf: {
			trustedOrigins: ['*']
		}
	}
};

export default config;