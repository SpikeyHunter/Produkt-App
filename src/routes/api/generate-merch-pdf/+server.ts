import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

const LOGO_URL = 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png';

export const POST: RequestHandler = async ({ request }) => {
	let { htmlContent, eventName } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
		const response = await fetch(LOGO_URL);
		if (!response.ok) throw new Error(`Failed to fetch logo from ${LOGO_URL}`);
		
		const imageBuffer = await response.arrayBuffer();
		const base64Image = Buffer.from(imageBuffer).toString('base64');
		const mimeType = response.headers.get('content-type') || 'image/png';
		const dataUri = `data:${mimeType};base64,${base64Image}`;

		// Safely swap out the blank image placeholder
		htmlContent = htmlContent.replace(/src="about:blank"\s*data-pdf-logo="true"/g, `src="${dataUri}"`);

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
		
		await page.setViewportSize({ width: 1056, height: 816 });

		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Merch Settlement</title>
					<script src="https://cdn.tailwindcss.com"></script>
					<script>
						tailwind.config = {
							theme: {
								extend: {
									colors: {
										lime: '#E1FF00',
										gray1: '#2F2F2F',
										gray2: '#BDBDBB',
										gray3: '#E4E4E4',
										navbar: '#212121',
										confirmed: '#86EFAC',
										problem: '#FCA5A5',
										black: '#000000',
										white: '#F7F7F7'
									}
								}
							}
						}
					</script>
					<style>
						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
							color-adjust: exact !important;
							font-weight: bold !important;
						}
						html, body {
							margin: 0;
							padding: 0;
							width: 11in;
							background-color: #151515 !important;
							font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
						}
						.bg-navbar { background-color: #212121 !important; }
						.bg-gray1 { background-color: #2F2F2F !important; }
						.bg-gray2 { background-color: #BDBDBB !important; }
						.bg-lime { background-color: #E1FF00 !important; }
						.text-lime { color: #E1FF00 !important; }
						.text-white { color: #F7F7F7 !important; }
						.text-gray2 { color: #BDBDBB !important; }
						.text-gray3 { color: #E4E4E4 !important; }
						.text-confirmed { color: #86EFAC !important; }
						.text-problem { color: #FCA5A5 !important; }
						
						#sheet-to-print { background-color: #151515 !important; display: block !important; }
					</style>
				</head>
				<body>
					${htmlContent}
				</body>
			</html>
		`;

		await page.setContent(fullHtml, { waitUntil: 'networkidle' });
		
		const contentHeight = await page.evaluate(() => {
			const element = document.querySelector('#sheet-to-print');
			return element ? element.scrollHeight : document.body.scrollHeight;
		});

		const pdfBuffer = await page.pdf({
			width: '11in',
			height: `${contentHeight}px`,
			printBackground: true,
			preferCSSPageSize: false,
			margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
			displayHeaderFooter: false
		});
		
		return new Response(new Uint8Array(pdfBuffer), {
			status: 200,
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="Merch_Settlement_${(eventName || 'Event').replace(/ /g, '_')}.pdf"`
			}
		});

	} catch (error) {
		console.error('PDF Generation Error:', error);
		return json({ error: 'Failed to generate PDF' }, { status: 500 });
	} finally {
		if (browser) await browser.close();
	}
};