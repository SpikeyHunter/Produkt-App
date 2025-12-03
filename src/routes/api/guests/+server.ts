import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This is a "Dummy" endpoint since you requested NO Data Collection.
// It will simply log the attempt to the server console and return success.

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		
		// Log that someone tried to connect (visible in Vercel/Server logs)
		console.log('Connection Attempt (No DB Save):', {
			ssid: body.ssid || 'Unknown',
			timestamp: new Date().toISOString()
		});

		// Return success immediately so the frontend can proceed
		return json({ success: true, status: 'skipped_db' });
		
	} catch (error) {
		console.error('Server error:', error);
		// Even if it fails, return success so the user gets WiFi
		return json({ success: true });
	}
};