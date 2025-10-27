// src/lib/utils/pdfExport.ts

/**
 * Export an HTML element to PDF
 * @param element - The DOM element to export
 * @param filename - The name of the PDF file
 * @param width - Width in inches (default: 8.5)
 */
export async function exportToPDF(
	element: HTMLElement,
	filename: string,
	width: number = 8.5
): Promise<void> {
	// Dynamically import libraries
	const html2canvas = (await import('html2canvas')).default;
	const jsPDF = (await import('jspdf')).default;

	// Create a clone of the element to avoid modifying the original
	const clone = element.cloneNode(true) as HTMLElement;
	
	// Apply PDF-specific styles to the clone
	clone.style.width = `${width}in`;
	clone.style.minHeight = 'auto';
	clone.style.position = 'absolute';
	clone.style.left = '-9999px';
	clone.style.top = '0';
	clone.style.background = '#1c1c1e';
	
	// Append clone to body temporarily
	document.body.appendChild(clone);

	try {
		// Wait for styles to apply
		await new Promise(resolve => setTimeout(resolve, 300));

		// Force convert all oklab colors to rgb by reading computed styles
		const allElements = clone.querySelectorAll('*');
		allElements.forEach((el) => {
			const htmlEl = el as HTMLElement;
			try {
				const computedStyle = window.getComputedStyle(htmlEl);
				
				// Helper to convert color to hex if possible
				const convertColor = (color: string): string => {
					if (!color || color === 'transparent') return color;
					
					// Create a temporary element to convert color
					const temp = document.createElement('div');
					temp.style.color = color;
					document.body.appendChild(temp);
					const computed = window.getComputedStyle(temp).color;
					document.body.removeChild(temp);
					
					// Parse rgb/rgba to hex
					const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
					if (match) {
						const r = parseInt(match[1]).toString(16).padStart(2, '0');
						const g = parseInt(match[2]).toString(16).padStart(2, '0');
						const b = parseInt(match[3]).toString(16).padStart(2, '0');
						return `#${r}${g}${b}`;
					}
					return computed;
				};
				
				// Apply converted colors
				const color = computedStyle.color;
				const bgColor = computedStyle.backgroundColor;
				const borderColor = computedStyle.borderColor;
				
				if (color && color !== 'rgb(0, 0, 0)') {
					htmlEl.style.color = convertColor(color);
				}
				if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
					htmlEl.style.backgroundColor = convertColor(bgColor);
				}
				if (borderColor && borderColor !== 'rgb(0, 0, 0)') {
					htmlEl.style.borderColor = convertColor(borderColor);
				}
			} catch (e) {
				// Skip elements that cause errors
				console.warn('Could not process element:', e);
			}
		});

		// Convert to canvas with high quality
		const canvas = await html2canvas(clone, {
			useCORS: true,
			allowTaint: true,
			logging: false,
			width: clone.scrollWidth,
			height: clone.scrollHeight
		});

		// Calculate PDF dimensions
		const imgWidth = width;
		const imgHeight = (canvas.height * imgWidth) / canvas.width;

		// Create PDF
		const pdf = new jsPDF({
			orientation: 'portrait',
			unit: 'in',
			format: [width, imgHeight]
		});

		// Add image to PDF
		const imgData = canvas.toDataURL('image/png');
		pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);

		// Save PDF
		pdf.save(filename);
	} finally {
		// Clean up: remove clone from DOM
		document.body.removeChild(clone);
	}
}