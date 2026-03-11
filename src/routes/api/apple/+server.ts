import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	return json({ ok: true, service: 'apple-messages' });
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown = null;

	try {
		const contentType = request.headers.get('content-type') || '';

		if (contentType.includes('application/json')) {
			body = await request.json();
		} else {
			body = await request.text();
		}
	} catch (error) {
		console.error('Failed to parse request body', error);
	}

	console.log('Apple request received:', body);

	return json({ ok: true });
};