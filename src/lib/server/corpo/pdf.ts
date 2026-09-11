// PDF helpers for /api/corpo/extract.
//
//  • extractPdfTextLayer — pdfjs-dist (legacy build) in Node, text layer only, worker run
//    in-process. No canvas is needed for getTextContent(); page rendering would need
//    @napi-rs/canvas, which is not installed, so this module never rasterises.
//  • trimPdfToFirstPages — pdf-lib copy of the first N pages, used to bound OCR cost before
//    handing a scanned PDF to OpenAI as a `file` content part (OpenAI rasterises the pages).
export interface PdfTextLayer {
	text: string;
	pageCount: number;
}

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
	if (!pdfjsPromise) {
		pdfjsPromise = (async () => {
			// Load the worker module in-process FIRST: it registers globalThis.pdfjsWorker, which
			// pdfjs's main-thread path uses instead of import(workerSrc). A static specifier is required
			// so both Vite (externalise) and @vercel/nft (trace into the function bundle) see the file —
			// a createRequire().resolve() lookup was verified NOT to be traced by nft.
			await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
			const mod = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule;
			return mod;
		})();
	}
	return pdfjsPromise;
}

interface TextItemLike {
	str: string;
	hasEOL?: boolean;
	transform: number[];
}

/** Rebuilds lines from positioned text items (pdfjs gives fragments, not lines). */
function itemsToLines(items: ReadonlyArray<unknown>): string {
	const lines: string[] = [];
	let line = '';
	let lastY: number | null = null;
	for (const raw of items) {
		const it = raw as Partial<TextItemLike>;
		if (typeof it.str !== 'string' || !Array.isArray(it.transform)) continue;
		const y = Math.round(it.transform[5] ?? 0);
		if (lastY !== null && Math.abs(y - lastY) > 2 && line) {
			lines.push(line);
			line = '';
		}
		if (line && it.str && !line.endsWith(' ') && !it.str.startsWith(' ')) line += ' ';
		line += it.str;
		if (it.hasEOL) {
			lines.push(line);
			line = '';
			lastY = null;
			continue;
		}
		lastY = y;
	}
	if (line) lines.push(line);
	return lines
		.map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
		.join('\n')
		.replace(/\n{3,}/g, '\n\n');
}

export async function extractPdfTextLayer(bytes: Uint8Array, maxChars: number): Promise<PdfTextLayer> {
	const pdfjs = await loadPdfJs();
	// pdfjs TRANSFERS the buffer to its (in-process) worker, which detaches the caller's
	// Uint8Array. Pass a copy so the route can still reuse `bytes` for OCR / trimming.
	const task = pdfjs.getDocument({
		data: bytes.slice(),
		disableFontFace: true,
		isEvalSupported: false,
		useSystemFonts: false,
		verbosity: 0
	});
	const doc = await task.promise;
	try {
		const pageCount = doc.numPages;
		let out = '';
		for (let i = 1; i <= pageCount; i++) {
			const page = await doc.getPage(i);
			try {
				const content = await page.getTextContent();
				const pageText = itemsToLines(content.items);
				out += (i > 1 ? '\n\f\n' : '') + pageText;
			} finally {
				page.cleanup();
			}
			if (out.length >= maxChars) {
				out = out.slice(0, maxChars);
				break;
			}
		}
		return { text: out, pageCount };
	} finally {
		await doc.destroy().catch(() => undefined);
	}
}

/** Returns a PDF containing only the first `maxPages` pages (or the input untouched if shorter). */
export async function trimPdfToFirstPages(bytes: Uint8Array, maxPages: number): Promise<{ bytes: Uint8Array; pages: number }> {
	const { PDFDocument } = await import('pdf-lib');
	const src = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
	const total = src.getPageCount();
	if (total <= maxPages) return { bytes, pages: total };
	const out = await PDFDocument.create();
	const indices = Array.from({ length: maxPages }, (_, i) => i);
	const pages = await out.copyPages(src, indices);
	for (const p of pages) out.addPage(p);
	const saved = await out.save({ useObjectStreams: true });
	return { bytes: saved, pages: maxPages };
}
