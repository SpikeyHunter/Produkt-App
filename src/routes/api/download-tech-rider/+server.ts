import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const htmlContent = body.htmlContent;
	const theme = body.theme;
	const secondaryLogoUrl = body.secondary_logo_url || body.secondaryLogoUrl;

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

		let base64Logo = '';
		if (secondaryLogoUrl) {
			try {
				const logoRes = await fetch(secondaryLogoUrl);
				if (logoRes.ok) {
					const arrayBuffer = await logoRes.arrayBuffer();
					const buffer = Buffer.from(arrayBuffer);
					const contentType = logoRes.headers.get('content-type') || 'image/png';
					base64Logo = `data:${contentType};base64,${buffer.toString('base64')}`;
				}
			} catch (err) {
				console.error('Failed to fetch logo for base64 conversion:', err);
			}
		}

		const page = await browser.newPage();
		
		const isBW = theme === 'bw';
		const bgColor = isBW ? '#FFFFFF' : '#212121';

		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<title>Tech Rider</title>
					<script src="https://cdn.tailwindcss.com"></script>
					<style>
						@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap');
						@page { 
							margin: 0; 
						}
						* { 
							-webkit-print-color-adjust: exact !important; 
							print-color-adjust: exact !important; 
						}
						html, body { 
							margin: 0 !important; 
							padding: 0 !important; 
							background-color: ${bgColor} !important; 
							font-family: 'Inter', sans-serif !important;
						}
						#content-wrapper {
							padding-top: 10px;
							padding-bottom: 10px;
						}
					</style>
				</head>
				<body>
					<div id="content-wrapper">
						${htmlContent}
					</div>
				</body>
			</html>
		`;

		await page.setContent(fullHtml, { waitUntil: 'networkidle' });

		const pageNumberColor = isBW ? '#000000' : '#E1FF00'; 
		
		// Updated logic: Normal in BW mode (''), Inverted in Color mode
		const logoFilter = isBW ? '' : 'filter: invert(1) grayscale(100%);';
		
		const headerTemplate = `
			<div style="width: 100%; height: 100%; background-color: ${bgColor}; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>
		`;

		const footerTemplate = `
			<div style="width: 100%; height: 100%; background-color: ${bgColor}; padding: 0 0.5in 0.35in 0.5in; box-sizing: border-box; display: flex; justify-content: space-between; align-items: flex-end; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
				<div style="flex: 1;"></div>
				<div style="flex: 1; text-align: center; color: ${pageNumberColor}; text-transform: uppercase; letter-spacing: 1px;">
					<span class="pageNumber"></span> OF <span class="totalPages"></span>
				</div>
				<div style="flex: 1; display: flex; justify-content: flex-end; align-items: flex-end;">
					${base64Logo ? `<img src="${base64Logo}" style="max-height: 60px; max-width: 180px; object-fit: contain; ${logoFilter}" />` : ''}
				</div>
			</div>
		`;

		const pdfBuffer = await page.pdf({
			format: 'Letter',
			printBackground: true,
			displayHeaderFooter: true,
			headerTemplate: headerTemplate,
			footerTemplate: footerTemplate,
			margin: { top: '0.5in', right: '0in', bottom: '1.2in', left: '0in' } 
		});

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