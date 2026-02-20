import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

// The new Supabase URL you provided
const LOGO_URL = 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO2.png';

export const POST: RequestHandler = async ({ request }) => {
	let { htmlContent, fileName } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
		// 1. Fetch the logo from Supabase and convert it to Base64
		let dataUri = '';
		try {
			const response = await fetch(LOGO_URL);
			if (response.ok) {
				const imageBuffer = await response.arrayBuffer();
				const base64Image = Buffer.from(imageBuffer).toString('base64');
				const mimeType = response.headers.get('content-type') || 'image/png';
				dataUri = `data:${mimeType};base64,${base64Image}`;
			} else {
				console.warn('Failed to fetch logo from Supabase, status:', response.status);
			}
		} catch (e) {
			console.error('Error fetching logo:', e);
		}

		// Replace the placeholder in your Svelte template with the actual Base64 image
		if (dataUri) {
			htmlContent = htmlContent.replace(/src="LOGO_PLACEHOLDER"/g, `src="${dataUri}"`);
		}

		// 2. Launch browser depending on environment
		if (dev) {
			const { chromium } = await import('playwright');
			browser = await chromium.launch({ headless: true });
		} else {
			const chromiumPkg = (await import('@sparticuz/chromium')).default;
			const { chromium: playwright } = await import('playwright-core');
			browser = await playwright.launch({
				args: chromiumPkg.args,
				executablePath: await chromiumPkg.executablePath()
			});
		}

		const page = await browser.newPage();
		
		await page.setViewportSize({ width: 816, height: 1056 }); // 8.5x11 inches at 96dpi

		// 3. Inject Google Fonts (Inter) and force it as the font family
		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Set Times</title>
					<link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,800;1,400;1,700&display=swap" rel="stylesheet">
					<style>
						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
						}
						html, body {
							margin: 0;
							padding: 0;
							background-color: white !important;
							/* Force Inter font everywhere */
							font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif !important;
						}
					</style>
				</head>
				<body>
					${htmlContent}
				</body>
			</html>
		`;

		// Wait until network is idle to ensure Google Fonts finishes loading before printing
		await page.setContent(fullHtml, { waitUntil: 'networkidle' });

		const pdfBuffer = await page.pdf({
			width: '8.5in',
			height: '11in',
			printBackground: true,
			margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
			displayHeaderFooter: false
		});
		
		return new Response(new Uint8Array(pdfBuffer), {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${fileName}.pdf"`
			}
		});

	} catch (error) {
		console.error('PDF Generation Error:', error);
		if (error instanceof Error) {
			return json({ error: `Failed to generate PDF. Server error: ${error.message}` }, { status: 500 });
		}
		return json({ error: 'An unknown error occurred during PDF generation.' }, { status: 500 });
	} finally {
		if (browser) await browser.close();
	}
};