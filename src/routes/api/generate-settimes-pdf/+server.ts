import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

// The logo from your static folder, assuming it's accessible via your public URL
// If you want to use the local static path natively, you would read the file system using 'fs',
// but fetching via your app's URL is the easiest way to get it as a buffer.
// Note: Make sure to replace this with your actual production logo URL or read locally via fs in SvelteKit.
const LOGO_URL =
	'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png';

export const POST: RequestHandler = async ({ request, url }) => {
	let { htmlContent, fileName } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
		// Fetch and embed the logo as base64
		// (Using the same logic from your Advance reference)
		let dataUri = '';
		try {
			const logoToFetch = dev ? `${url.origin}/images/ProduktXX_LOGO2.png` : LOGO_URL;
			const response = await fetch(logoToFetch);
			if (response.ok) {
				const imageBuffer = await response.arrayBuffer();
				const base64Image = Buffer.from(imageBuffer).toString('base64');
				const mimeType = response.headers.get('content-type') || 'image/png';
				dataUri = `data:${mimeType};base64,${base64Image}`;
			}
		} catch (e) {
			console.warn('Could not fetch logo for PDF, proceeding without it.');
		}

		if (dataUri) {
			htmlContent = htmlContent.replace(/src="LOGO_PLACEHOLDER"/g, `src="${dataUri}"`);
		}

		// Use different browser setup for dev vs production
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

		await page.setViewportSize({ width: 816, height: 1056 });

		const fullHtml = `
	<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Set Times</title>
			<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
			<style>
				* {
					-webkit-print-color-adjust: exact !important;
					print-color-adjust: exact !important;
				}
				html, body {
					margin: 0;
					padding: 0;
					background-color: white !important;
					/* Force Inter */
					font-family: 'Inter', Helvetica, Arial, sans-serif !important;
				}
			</style>
		</head>
		<body>
			${htmlContent}
		</body>
	</html>
`;

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
			return json(
				{ error: `Failed to generate PDF. Server error: ${error.message}` },
				{ status: 500 }
			);
		}
		return json({ error: 'An unknown error occurred during PDF generation.' }, { status: 500 });
	} finally {
		if (browser) await browser.close();
	}
};
