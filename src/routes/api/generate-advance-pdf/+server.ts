import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const LOGO_URL = 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png';

export const POST: RequestHandler = async ({ request }) => {
	let { htmlContent, artistName, eventDate } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
		// Fetch and embed the logo as base64
		const response = await fetch(LOGO_URL);
		if (!response.ok) throw new Error(`Failed to fetch logo from ${LOGO_URL}`);
		
		const imageBuffer = await response.arrayBuffer();
		const base64Image = Buffer.from(imageBuffer).toString('base64');
		const mimeType = response.headers.get('content-type') || 'image/png';
		const dataUri = `data:${mimeType};base64,${base64Image}`;

		// Replace the placeholder with the actual data URI
		htmlContent = htmlContent.replace(/src="LOGO_PLACEHOLDER"/g, `src="${dataUri}"`);

		browser = await chromium.launch({
			args: ['--no-sandbox', '--disable-setuid-sandbox']
		});
		const page = await browser.newPage();
		
		// Set viewport to match PDF dimensions
		await page.setViewportSize({
			width: 816, // 8.5 inches * 96 DPI
			height: 1056 // 11 inches * 96 DPI
		});

		// Enhanced HTML with better CSS for PDF rendering
		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Advance Sheet</title>
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
										tentatif: '#FCD34D',
										proposed: '#FDBA74',
										problem: '#FCA5A5',
										info: '#c4b5fd',
										question: '#93c5fd',
										black: '#000000',
										white: '#F7F7F7'
									},
									borderWidth: {
										'3': '3px',
										'15': '15px'
									}
								}
							}
						}
					</script>
					<style>
						/* --- FONT EMBEDDING (NOW BOLD) --- */
						/*
							IMPORTANT: You must now use the Base64 string from the
							"Inter-Bold.woff2" font file (weight 700).
						*/
						@font-face {
							font-family: 'Inter';
							font-style: normal;
							font-weight: 700; /* Bold weight */
							src: url(data:font/woff2;base64,PASTE_YOUR_BASE64_ENCODED_BOLD_FONT_STRING_HERE) format('woff2');
						}

						* {
							-webkit-print-color-adjust: exact !important;
							print-color-adjust: exact !important;
							color-adjust: exact !important;
						}
						
						html, body {
							margin: 0;
							padding: 0;
							width: 8.5in;
							background-color: #2F2F2F !important;
							font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif !important;
							font-weight: 700 !important; /* Set default to Bold weight */
						}
						
						/* Force background colors */
						.bg-navbar { background-color: #212121 !important; }
						.bg-gray1 { background-color: #2F2F2F !important; }
						.bg-gray2 { background-color: #BDBDBB !important; }
						.bg-lime { background-color: #E1FF00 !important; }
						
						/* Text colors */
						.text-lime { color: #E1FF00 !important; }
						.text-white { color: #F7F7F7 !important; }
						.text-gray2 { color: #BDBDBB !important; }
						.text-gray3 { color: #E4E4E4 !important; }
						.text-black { color: #000000 !important; }
						.text-confirmed { color: #86EFAC !important; }
						.text-tentatif { color: #FCD34D !important; }
						.text-proposed { color: #FDBA74 !important; }
						.text-problem { color: #FCA5A5 !important; }
						.text-info { color: #c4b5fd !important; }
						.text-question { color: #93c5fd !important; }
						
						/* Border colors */
						.border-lime { border-color: #E1FF00 !important; }
						.border-confirmed { border-color: #86EFAC !important; }
						.border-tentatif { border-color: #FCD34D !important; }
						.border-proposed { border-color: #FDBA74 !important; }
						.border-problem { border-color: #FCA5A5 !important; }
						.border-info { border-color: #c4b5fd !important; }
						.border-question { border-color: #93c5fd !important; }
						
						/* --- FIXED BORDER RULE (NOW 1% OPACITY) --- */
						.border-r-black {
							border-right-color: rgba(0, 0, 0, 0.01) !important;
						}

						/* Border widths */
						.border-l-3 {
							border-left-width: 3px !important;
							border-left-style: solid !important;
						}
						
						.border-r-15 {
							border-right-width: 15px !important;
							border-right-style: solid !important;
						}
						
						/* Font weights */
						.font-normal { font-weight: 400 !important; }
						.font-medium { font-weight: 500 !important; }
						.font-bold { font-weight: 700 !important; }
						
						/* Default text to bold weight */
						p, div, span, td, th {
							font-weight: 700;
						}
						
						img.logo-img {
							height: 68px !important;
							width: auto !important;
							display: block !important;
							object-fit: contain !important;
						}
						
						#sheet-to-print {
							display: block !important;
							visibility: visible !important;
							opacity: 1 !important;
							background-color: #2F2F2F !important;
						}
						
						.bg-navbar\\/60, .bg-navbar\\\/60 { background-color: rgba(33, 33, 33, 0.6) !important; }
						.bg-black\\/30, .bg-black\\\/30 { background-color: rgba(0, 0, 0, 0.3) !important; }
						.bg-black\\/15, .bg-black\\\/15, .\\!bg-black\\/15, .\\!bg-black\\\/15 { background-color: rgba(0, 0, 0, 0.15) !important; }
						
						@media print {
							.bg-black\\/15, .\\!bg-black\\/15 {
								background-color: #1a1a1a !important;
							}
						}
					</style>
				</head>
				<body>
					${htmlContent}
				</body>
			</html>
		`;

		await page.setContent(fullHtml, { waitUntil: 'networkidle' });
		
		await page.addStyleTag({
			content: `
				* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
				body { background-color: #2F2F2F !important; font-weight: 700 !important; }
			`
		});

		const contentHeight = await page.evaluate(() => {
			const element = document.querySelector('#sheet-to-print');
			return element ? element.scrollHeight : document.body.scrollHeight;
		});

		const pdfBuffer = await page.pdf({
			width: '8.5in',
			height: `${contentHeight}px`,
			printBackground: true,
			preferCSSPageSize: false,
			margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
			displayHeaderFooter: false,
			scale: 1
		});
		
		const filename = `Advance_${artistName.replace(/ /g, '_')}_${eventDate}.pdf`;
		const { data, error: uploadError } = await supabase.storage
			.from('documents')
			.upload(`final_advance/${filename}`, pdfBuffer, {
				contentType: 'application/pdf',
				upsert: true
			});

		if (uploadError) throw uploadError;

		return json({ success: true, path: data.path }, { status: 200 });

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