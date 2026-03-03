// src/routes/api/deezer/search/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch, setHeaders }) => {
	const query = url.searchParams.get('q');
	// Grab the limit from the URL, default to 6 if not provided
	const limit = url.searchParams.get('limit') || '6'; 

	if (!query) {
		return json({ data: [] });
	}

	// 🚀 THE UPGRADE: Tell the browser to cache this specific response for 1 hour.
	// This skips the SvelteKit backend entirely if the user searches the exact same term later.
	setHeaders({
		'Cache-Control': 'public, max-age=3600'
	});

	try {
		// Pass the limit parameter to Deezer
		const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=${limit}`);

		if (!response.ok) {
			throw new Error(`Deezer API responded with status: ${response.status}`);
		}

		const data = await response.json();
		return json(data);

	} catch (error) {
		console.error('Error fetching from Deezer API:', error);
		return json({ data: [], error: 'Failed to fetch artists' }, { status: 500 });
	}
};