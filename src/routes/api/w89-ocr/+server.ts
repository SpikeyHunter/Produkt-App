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
			console.log(`📦 Received base64 image: ${base64Data.length} chars (~${Math.round(base64Data.length * 0.75 / 1024)} KB decoded)`);
			imageInput = { image: { content: base64Data } };
		} else {
			throw error(400, 'Only base64 data URIs are supported for this endpoint.');
		}

		// 🔑 documentTextDetection is tuned for dense, structured forms — gives
		// better accuracy on tax forms than the generic textDetection.
		// Note: response is a tuple [result, ...rawResponse], not the result directly.
		const [result] = await client.documentTextDetection(imageInput);

		if ((result as any).error) {
			throw error(500, `Vision API error: ${(result as any).error.message}`);
		}

		// Log image size for debugging — if the request is reaching but text is empty,
		// the client-side image rendering is the suspect, not the network.
		console.log(`📥 Vision API received image. textAnnotations: ${result.textAnnotations?.length || 0}, has fullText: ${!!result.fullTextAnnotation}`);

		const detections = result.textAnnotations;
		if (!detections || detections.length === 0) {
			console.log('⚠️ Vision returned 0 text annotations — image is likely blank or unreadable.');
			return json({ success: true, type: null, message: 'No text detected.' });
		}

		const fullText = (result.fullTextAnnotation?.text || detections[0]?.description || '').toUpperCase();
		let detectedType: 'W8' | 'W9' | null = null;

		// 🎯 PRIORITY 1: Top-left corner detection.
		// Vision returns the full-page text at index 0, followed by individual
		// word annotations with bounding boxes. The form ID ("W-9", "W-8BEN", etc.)
		// is always printed in the top-left corner of IRS forms — well above the
		// FATCA / foreign-person cross-references that appear lower on the page.
		const annotations = result.textAnnotations as any[];
		const pageBox = annotations[0]?.boundingPoly?.vertices;
		if (pageBox && pageBox.length === 4 && annotations.length > 1) {
			const pageWidth = Math.max(...pageBox.map((v: any) => v.x || 0));
			const pageHeight = Math.max(...pageBox.map((v: any) => v.y || 0));

			// Top-left region: leftmost ~25% horizontally, topmost ~15% vertically.
			const xCutoff = pageWidth * 0.25;
			const yCutoff = pageHeight * 0.15;

			// Walk individual word annotations (skip index 0 — that's the full text).
			const topLeftWords: string[] = [];
			for (let i = 1; i < annotations.length; i++) {
				const ann = annotations[i];
				const verts = ann?.boundingPoly?.vertices;
				if (!verts || verts.length === 0) continue;
				const minX = Math.min(...verts.map((v: any) => v.x || 0));
				const minY = Math.min(...verts.map((v: any) => v.y || 0));
				if (minX <= xCutoff && minY <= yCutoff) {
					topLeftWords.push((ann.description || '').toUpperCase());
				}
			}
			const topLeftText = topLeftWords.join(' ');
			console.log(`🎯 Top-left region text: "${topLeftText}"`);

			// Vision often splits "W-9" into separate "W", "-", "9" tokens — so
			// collapse hyphens/spaces before matching.
			const collapsed = topLeftText.replace(/[-\s]/g, '');
			if (collapsed.includes('W9')) {
				detectedType = 'W9';
				console.log('✅ Top-left match: W9');
			} else if (collapsed.includes('W8')) {
				detectedType = 'W8';
				console.log('✅ Top-left match: W8');
			}
		}

		// 📊 PRIORITY 2: Weighted whole-page scoring as fallback.
		// Only runs if the corner scan came up empty (e.g. heavily skewed scan,
		// unusual layout, or low-quality OCR).
		if (!detectedType) {
			console.log('⚠️ Top-left detection inconclusive — falling back to full-page scoring.');

			const formW8Count = (fullText.match(/FORM\s*W[-\s]?8/g) || []).length;
			const formW9Count = (fullText.match(/FORM\s*W[-\s]?9/g) || []).length;
			const bareW8Count = (fullText.match(/W[-\s]?8\b/g) || []).length;
			const bareW9Count = (fullText.match(/W[-\s]?9\b/g) || []).length;

			// Weighted score: a "Form W-X" mention is worth 5 bare mentions.
			const w8Score = formW8Count * 5 + bareW8Count;
			const w9Score = formW9Count * 5 + bareW9Count;

			console.log(
				`📊 OCR scores — W8: ${w8Score} (form:${formW8Count}, bare:${bareW8Count}), W9: ${w9Score} (form:${formW9Count}, bare:${bareW9Count})`
			);

			if (w8Score === 0 && w9Score === 0) {
				detectedType = null;
			} else if (w9Score > w8Score) {
				detectedType = 'W9';
			} else if (w8Score > w9Score) {
				detectedType = 'W8';
			} else {
				// Tie — fall back to whichever appears earlier in the document,
				// since the form's own title appears at the top of page 1.
				const firstW8 = fullText.search(/FORM\s*W[-\s]?8|W[-\s]?8\b/);
				const firstW9 = fullText.search(/FORM\s*W[-\s]?9|W[-\s]?9\b/);
				if (firstW9 >= 0 && (firstW8 < 0 || firstW9 < firstW8)) {
					detectedType = 'W9';
				} else {
					detectedType = 'W8';
				}
			}
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