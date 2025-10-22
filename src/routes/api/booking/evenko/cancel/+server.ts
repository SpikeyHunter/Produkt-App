// src/routes/api/booking/evenko/cancel/+server.ts

import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

let isCancelled = false;

export const POST: RequestHandler = async () => {
	isCancelled = true;
	console.log('🛑 Evenko scraping cancellation requested');
	return json({
		success: true,
		message: 'Cancellation requested'
	});
};

// SvelteKit allows private exports prefixed with '_'
export function _resetCancellation() {
	isCancelled = false;
}

export function _isCancelled() {
	return isCancelled;
}

