// Integration test of the PDF helpers against a real PDF shipped in static/ (no network).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPdfTextLayer, trimPdfToFirstPages } from './pdf';
import { hasUsableTextLayer } from './validate';

const letter = new Uint8Array(readFileSync(new URL('../../../../static/pdf/Invitation Letter.pdf', import.meta.url)));

describe('extractPdfTextLayer (pdfjs in-process worker)', () => {
	it('reads the text layer of a real PDF', async () => {
		const out = await extractPdfTextLayer(letter, 200_000);
		expect(out.pageCount).toBe(1);
		expect(out.text).toContain('4427319 Canada INC.');
		expect(out.text.split('\n').length).toBeGreaterThan(5);
		expect(hasUsableTextLayer(out.text, out.pageCount)).toBe(true);
	});

	it('caps output at maxChars', async () => {
		const out = await extractPdfTextLayer(letter, 100);
		expect(out.text.length).toBeLessThanOrEqual(100);
	});
});

describe('trimPdfToFirstPages (pdf-lib)', () => {
	it('returns the input untouched when short enough', async () => {
		const out = await trimPdfToFirstPages(letter, 10);
		expect(out.pages).toBe(1);
		expect(out.bytes).toBe(letter);
	});

	it('produces a valid PDF with only the first N pages', async () => {
		const { PDFDocument } = await import('pdf-lib');
		const doc = await PDFDocument.create();
		for (let i = 0; i < 12; i++) doc.addPage([200, 200]);
		const twelve = await doc.save();
		const out = await trimPdfToFirstPages(twelve, 10);
		expect(out.pages).toBe(10);
		const reread = await PDFDocument.load(out.bytes);
		expect(reread.getPageCount()).toBe(10);
	});
});
