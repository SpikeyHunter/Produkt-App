import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request }) => {
	let { htmlContent, theme } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
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

		const isBW = theme === 'bw';
		const bgColor = isBW ? '#FFFFFF' : '#2F2F2F';

		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<title>Tech Rider</title>
					<script src="https://cdn.tailwindcss.com"></script>
					<style>
						* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
						html, body { 
							margin: 0; 
							padding: 0; 
							background-color: ${bgColor} !important; 
						}
					</style>
				</head>
				<body>
					${htmlContent}
				</body>
			</html>
		`;

		await page.setContent(fullHtml, { waitUntil: 'networkidle' });

		// Calculate header/footer color based on theme
		const footerTextColor = isBW ? '#000000' : '#FFFFFF';

		const pdfBuffer = await page.pdf({
			format: 'Letter', // 8.5 x 11 inches
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: '<div></div>', // Empty header
			// Auto page numbering footer
			footerTemplate: `
				<div style="font-size: 10px; width: 100%; text-align: right; padding-right: 0.5in; padding-left: 0.5in; color: ${footerTextColor}; font-family: sans-serif;">
					Page <span class="pageNumber"></span> of <span class="totalPages"></span>
				</div>
			`,
			margin: { top: '0.4in', right: '0.4in', bottom: '0.6in', left: '0.4in' }
		});

		// Return directly as an attachment stream
		// Convert Node Buffer to standard Uint8Array for the Web Response
		return new Response(new Uint8Array(pdfBuffer), {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': 'attachment; filename="tech_rider.pdf"'
			}
		});
	} catch (error) {
		console.error('PDF Generation Error:', error);
		return json({ error: 'Failed to generate PDF' }, { status: 500 });
	} finally {
		if (browser) await browser.close();
	}
};
