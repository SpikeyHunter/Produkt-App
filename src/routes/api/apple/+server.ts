import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Apple might send a GET request just to check if the server is alive
export const GET: RequestHandler = async () => {
    return json({ status: 'ok' }, { status: 200 });
};

// Apple might send an empty POST request to validate the webhook
export const POST: RequestHandler = async () => {
    return json({ status: 'ok' }, { status: 200 });
};