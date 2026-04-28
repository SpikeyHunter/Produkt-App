// src/routes/api/w89-ocr/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env } from '$env/dynamic/private';
import { getGoogleCredentials } from '$lib/utils/passport/ocrUtils';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { imageUrl } = await request.json();

		if (!imageUrl) {
			throw error(400, 'Image base64 is required');
		}

		console.log('🔍 Starting Google Vision OCR for W8/W9 detection...');

		const credentials = getGoogleCredentials(env.GOOGLE_CREDENTIALS);
		if (!credentials) {
			throw error(500, 'Google Cloud credentials not configured');
		}

		const client = new ImageAnnotatorClient({
			credentials,
			projectId: credentials.project_id
		});

		let imageInput: any;

		if (imageUrl.startsWith('data:image/')) {
			const base64Data = imageUrl.split(',')[1];
			if (!base64Data) throw error(400, 'Invalid base64 image format');
			imageInput = { image: { content: base64Data } };
		} else {
			throw error(400, 'Only base64 data URIs are supported for this endpoint.');
		}

		const response = await client.textDetection(imageInput);
		const result: any = response;

		if (result.error) {
			throw error(500, `Vision API error: ${result.error.message}`);
		}

		const detections = result.textAnnotations;
		if (!detections || detections.length === 0) {
			return json({ success: true, type: null, message: 'No text detected.' });
		}

		const fullText = detections.description?.toUpperCase() || '';
		let detectedType = null;

		// Check for common W-8 and W-9 formatting
		if (fullText.includes('W-8') || fullText.includes('W8')) {
			detectedType = 'W8';
		} else if (fullText.includes('W-9') || fullText.includes('W9')) {
			detectedType = 'W9';
		}

		console.log(`✅ OCR W8/W9 detection complete. Result: ${detectedType}`);

		return json({
			success: true,
			type: detectedType
		});
	} catch (err) {
		console.error('❌ W8/9 OCR error:', err);
		throw error(500, 'Failed to process image for W8/W9 detection.');
	}
};