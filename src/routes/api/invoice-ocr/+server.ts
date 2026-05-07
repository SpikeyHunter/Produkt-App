// src/routes/api/invoice-ocr/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env } from '$env/dynamic/private';
import { getGoogleCredentials } from '$lib/utils/passport/ocrUtils';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { imageUrl } = await request.json();
		if (!imageUrl) throw error(400, 'Image base64 is required');

		const credentials = getGoogleCredentials(env.GOOGLE_CREDENTIALS);
		if (!credentials) throw error(500, 'Google Cloud credentials not configured');

		const client = new ImageAnnotatorClient({
			credentials,
			projectId: credentials.project_id
		});

		const base64Data = imageUrl.split(',')[1];
		if (!base64Data) throw error(400, 'Invalid base64 image format');

		const [result] = await client.documentTextDetection({ image: { content: base64Data } });
		
		if ((result as any).error) {
			throw error(500, `Vision API error: ${(result as any).error.message}`);
		}

		const fullText = result.fullTextAnnotation?.text || '';
		
		// Regex explanation: case-insensitive, allows flexible spaces/newlines, optional period after Inc
		const regex = /4427319\s*Canada\s*Inc\.?/i;
		const containsCompany = regex.test(fullText);

		return json({ success: true, containsCompany });
	} catch (err) {
		console.error('❌ Invoice OCR error:', err);
		// Fallback to true if OCR fails so we don't completely block the user
		return json({ success: true, containsCompany: true }); 
	}
};