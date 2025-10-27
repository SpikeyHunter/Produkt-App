import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request }) => {
	let { htmlContent, fileName } = await request.json();

	if (!htmlContent) {
		return json({ error: 'Missing HTML content from client' }, { status: 400 });
	}

	let browser = null;
	try {
		console.log('Starting PDF generation...');
		console.log('Filename:', fileName);

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

		// Complete CSS including ALL Tailwind utility classes used
		const fullHtml = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<style>
					* { 
						-webkit-print-color-adjust: exact !important; 
						print-color-adjust: exact !important; 
						box-sizing: border-box; 
						margin: 0; 
						padding: 0; 
					}
					html, body { 
						width: 8.5in; 
						background: #1c1c1e !important; 
						font-family: system-ui, -apple-system, sans-serif;
						font-weight: 700 !important;
					}
					
					/* Make all text bold by default */
					body, p, div, span, td, th, h1, h2, h3, h4, h5, h6 {
						font-weight: 700 !important;
					}
					
					/* Prevent page breaks */
					* {
						page-break-inside: avoid !important;
						break-inside: avoid !important;
					}
					
					/* Hide form elements */
					input, textarea, button {
						display: none !important;
					}
					
					/* Remove overflow and fixed heights */
					.overflow-y-auto {
						overflow: visible !important;
						height: auto !important;
						max-height: none !important;
					}
					
					.h-full {
						height: auto !important;
					}
					
					.flex-1 {
						flex: none !important;
					}
					
					.bg-navbar { background-color: #212121 !important; }
					.bg-gray1 { background-color: #2F2F2F !important; }
					.bg-gray2 { background-color: #BDBDBB !important; }
					.bg-lime { background-color: #E1FF00 !important; }
					.bg-black\\/20 { background-color: rgba(0,0,0,0.2) !important; }
					
					.text-lime { color: #E1FF00 !important; }
					.text-white { color: #F7F7F7 !important; }
					.text-gray2 { color: #BDBDBB !important; }
					.text-gray3 { color: #E4E4E4 !important; }
					.text-black { color: #000000 !important; }
					
					.border-lime { border-color: #E1FF00 !important; }
					.border-gray1 { border-color: #2F2F2F !important; }
					.border-gray2 { border-color: #BDBDBB !important; }
					.border-gray2\\/20 { border-color: rgba(189,189,187,0.2) !important; }
					.border-gray2\\/10 { border-color: rgba(189,189,187,0.1) !important; }
					
					.border { border-width: 1px; border-style: solid; }
					.border-2 { border-width: 2px; border-style: solid; }
					.border-b { border-bottom-width: 1px; border-bottom-style: solid; }
					.border-t { border-top-width: 1px; border-top-style: solid; }
					
					.rounded-xl { border-radius: 0.75rem; }
					.rounded-lg { border-radius: 0.5rem; }
					.rounded { border-radius: 0.25rem; }
					.rounded-full { border-radius: 9999px; }
					
					.p-4 { padding: 1rem; }
					.p-3 { padding: 0.75rem; }
					.p-2 { padding: 0.5rem; }
					.px-4 { padding-left: 1rem; padding-right: 1rem; }
					.px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
					.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
					.py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
					.py-1\\.5 { padding-top: 0.375rem; padding-bottom: 0.375rem; }
					.pr-2 { padding-right: 0.5rem; }
					.pl-2 { padding-left: 0.5rem; }
					
					.mb-1 { margin-bottom: 0.25rem; }
					.mb-2 { margin-bottom: 0.5rem; }
					.mb-3 { margin-bottom: 0.75rem; }
					.mb-4 { margin-bottom: 1rem; }
					.mb-0\\.5 { margin-bottom: 0.125rem; }
					.mt-2 { margin-top: 0.5rem; }
					.ml-1 { margin-left: 0.25rem; }
					.ml-2 { margin-left: 0.5rem; }
					
					.space-y-4 > * + * { margin-top: 1rem; }
					.space-y-3 > * + * { margin-top: 0.75rem; }
					.space-y-2 > * + * { margin-top: 0.5rem; }
					.space-y-0\\.5 > * + * { margin-top: 0.125rem; }
					
					.gap-6 { gap: 1.5rem; }
					.gap-4 { gap: 1rem; }
					.gap-2 { gap: 0.5rem; }
					
					.grid { display: grid; }
					.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
					.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
					
					.flex { display: flex; }
					.flex-col { flex-direction: column; }
					.flex-1 { flex: 1 1 0%; }
					.flex-shrink-0 { flex-shrink: 0; }
					.items-center { align-items: center; }
					.items-start { align-items: flex-start; }
					.justify-between { justify-content: space-between; }
					
					.inline-block { display: inline-block; }
					.overflow-hidden { overflow: hidden; }
					.overflow-x-auto { overflow-x: auto; }
					
					.text-xs { font-size: 0.75rem; line-height: 1rem; }
					.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
					.text-base { font-size: 1rem; line-height: 1.5rem; }
					.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
					.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
					
					.font-medium { font-weight: 500 !important; }
					.font-semibold { font-weight: 600 !important; }
					.font-bold { font-weight: 700 !important; }
					
					/* Override for lighter text where needed */
					.font-normal { font-weight: 400 !important; }
					
					.uppercase { text-transform: uppercase; }
					.italic { font-style: italic; }
					.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
					
					.w-1\\/5 { width: 20%; }
					.w-24 { width: 6rem; }
					.w-full { width: 100%; }
					.max-w-\\[120px\\] { max-width: 120px; }
					
					.h-full { height: 100%; }
					
					.tracking-wider { letter-spacing: 0.05em; }
					
					.text-left { text-align: left; }
					.text-center { text-align: center; }
					
					table { width: 100%; border-collapse: collapse; }
					th, td { text-align: left; font-weight: 700 !important; }
					
					/* Force bold for specific elements */
					.inline-block, span, .text-lime, .text-white, .text-gray2 {
						font-weight: 700 !important;
					}
					
					/* Ensure hotel notes are visible */
					.bg-black\\/20 .text-gray2,
					.bg-black\\\/20 .text-gray2 {
						color: #BDBDBB !important;
						display: block !important;
						visibility: visible !important;
						font-weight: 700 !important;
					}
					
					/* Make sure hotel note containers are visible */
					.mt-2.p-2.bg-black\\/20,
					.mt-2.p-2.bg-black\\\/20 {
						display: block !important;
						visibility: visible !important;
						background-color: rgba(0,0,0,0.2) !important;
						margin-top: 0.5rem !important;
						padding: 0.5rem !important;
						border-radius: 0.25rem !important;
					}
					
					.event-details-container { display: block; visibility: visible; opacity: 1; background-color: #1c1c1e; }
					
					/* Hide scrollbars */
					.custom-scroll { scrollbar-width: none; -ms-overflow-style: none; }
					.custom-scroll::-webkit-scrollbar { display: none; }
				</style>
			</head>
			<body>
				${htmlContent}
			</body>
			</html>
		`;

		await page.setContent(fullHtml, { waitUntil: 'load', timeout: 30000 });
		await page.waitForTimeout(500);

		// FIRST: Read all the form values BEFORE hiding elements
		const notesData = await page.evaluate(() => {
			// Find only the Notes section containers (not hotel notes)
			const notesSections = document.querySelectorAll('.bg-gray1.rounded-lg');
			let notesContainers: Element[] = [];
			
			notesSections.forEach((section) => {
				const heading = section.querySelector('h3');
				if (heading && heading.textContent?.includes('Notes')) {
					const containers = section.querySelectorAll('.bg-black\\/20, .bg-black\\\/20');
					notesContainers = [...notesContainers, ...Array.from(containers)];
				}
			});
			
			const data: any[] = [];
			
			notesContainers.forEach((container) => {
				// Get artist name
				const artistNameEl = container.querySelector('.text-lime.font-bold');
				const artistName = artistNameEl ? artistNameEl.textContent?.trim() : '';

				// Find selected radio button
				let selectedOption = 'None';
				const radios = container.querySelectorAll('input[type="radio"]');
				radios.forEach((radio: any) => {
					if (radio.checked && radio.value) {
						if (radio.value === 'buyout') selectedOption = 'Buyout';
						else if (radio.value === 'dinner') selectedOption = 'Dinner';
					}
				});

				// Get details input value
				const detailsInput = container.querySelector('input[type="text"]') as HTMLInputElement;
				const details = detailsInput?.value?.trim() || '';

				// Get notes textarea value
				const notesTextarea = container.querySelector('textarea') as HTMLTextAreaElement;
				const notes = notesTextarea?.value?.trim() || '';

				data.push({
					artistName,
					selectedOption,
					details,
					notes
				});
			});

			return data;
		});

		console.log('Notes data extracted:', JSON.stringify(notesData));

		// THEN: Remove/hide elements and rebuild with the extracted data
		await page.addScriptTag({
			content: `window.__notesData = ${JSON.stringify(notesData)};`
		});

		await page.evaluate(() => {
			const notesData = (window as any).__notesData;
			
			// Find only the Notes section containers (not hotel notes)
			const notesSections = document.querySelectorAll('.bg-gray1.rounded-lg');
			let notesContainers: Element[] = [];
			
			notesSections.forEach((section) => {
				const heading = section.querySelector('h3');
				if (heading && heading.textContent?.includes('Notes')) {
					const containers = section.querySelectorAll('.bg-black\\/20, .bg-black\\\/20');
					notesContainers = [...notesContainers, ...Array.from(containers)];
				}
			});
			
			notesContainers.forEach((container, index) => {
				const noteData = notesData[index];
				if (!noteData) return;

				// Rebuild the container content with extracted data
				let newHTML = `<div style="margin-bottom: 0.75rem;">`;
				
				// Artist name
				if (noteData.artistName) {
					newHTML += `<h4 style="color: #E1FF00; font-weight: 700; margin-bottom: 0.75rem;">${noteData.artistName}</h4>`;
				}

				// Food option
				if (noteData.selectedOption !== 'None') {
					newHTML += `<div style="margin-bottom: 0.5rem;">
						<span style="color: #E1FF00; font-weight: 700; font-size: 0.75rem;">${noteData.selectedOption}</span>`;
					if (noteData.details) {
						newHTML += `<span style="color: #F7F7F7; margin-left: 0.5rem; font-size: 0.75rem;">- ${noteData.details}</span>`;
					}
					newHTML += `</div>`;
				} else {
					newHTML += `<div style="margin-bottom: 0.5rem;">
						<span style="color: #F7F7F7; font-weight: 700; font-size: 0.75rem;">None</span>
					</div>`;
				}

				// Notes section
				if (noteData.notes) {
					newHTML += `<div style="border-top: 1px solid rgba(189,189,187,0.2); padding-top: 0.75rem; margin-top: 0.75rem;">
						<h5 style="color: #BDBDBB; font-size: 0.75rem; margin-bottom: 0.25rem; font-weight: 700;">Notes</h5>
						<div style="color: #F7F7F7; font-size: 0.75rem; line-height: 1rem; white-space: pre-wrap; font-weight: 700;">${noteData.notes}</div>
					</div>`;
				}

				newHTML += `</div>`;

				// Replace container content
				(container as HTMLElement).innerHTML = newHTML;
			});

			// Hide all remaining input fields and textareas
			const inputs = document.querySelectorAll('input, textarea');
			inputs.forEach((input) => {
				(input as HTMLElement).style.display = 'none';
			});

			// Remove custom-scroll class that might add extra height
			const scrollElements = document.querySelectorAll('.custom-scroll');
			scrollElements.forEach((el) => {
				(el as HTMLElement).style.overflow = 'visible';
				(el as HTMLElement).style.height = 'auto';
			});
		});

		// Get the actual content height after cleanup
		const contentHeight = await page.evaluate(() => {
			const container = document.querySelector('.event-details-container');
			if (!container) return 1000;

			// Force layout recalculation
			const rect = container.getBoundingClientRect();
			
			// Get all children and find the last one with content
			const children = Array.from(container.querySelectorAll('*'));
			let maxBottom = 0;
			
			children.forEach((child) => {
				const childRect = child.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();
				const relativeBottom = childRect.bottom - containerRect.top;
				if (relativeBottom > maxBottom) {
					maxBottom = relativeBottom;
				}
			});

			// Add some padding
			return Math.ceil(maxBottom) + 40;
		});

		console.log('Content height:', contentHeight, 'pixels');

		// Generate PDF as one continuous page with exact height
		const pdfBuffer = await page.pdf({
			width: '8.5in',
			height: `${contentHeight}px`,
			printBackground: true,
			preferCSSPageSize: true,
			margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
		});

		await browser.close();

		console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');

		// Convert Buffer to Uint8Array for SvelteKit Response
		const uint8Array = new Uint8Array(pdfBuffer);

		// Return the PDF directly as a download
		return new Response(uint8Array, {
			headers: {
				'Content-Type': 'application/pdf',
				'Content-Disposition': `attachment; filename="${fileName}.pdf"`
			}
		});
	} catch (error) {
		console.error('PDF Generation Error:', error);
		if (browser) await browser.close();
		return json(
			{
				error:
					error instanceof Error
						? `Failed to generate PDF: ${error.message}`
						: 'Unknown error occurred'
			},
			{ status: 500 }
		);
	}
};