// POST /api/corpo/extract — text-extraction fallback for the Documents upload pipeline
// (V2 spec §7.2 step 3). The Mac app extracts on-device first (PDFKit / Vision); this route
// is what it calls when that throws.
//
//   input   multipart/form-data  field `file` (PDF ≤ 20 MB, image ≤ 10 MB)
//           — NOTE: Vercel functions cap the request body at ~4.5 MB; anything bigger must use —
//           application/json      { bucket?: 'corpo-documents' (default) | 'corpo-assets' | 'corpo-renders', path }
//                                 → downloaded server-side with the service role (private bucket)
//   200     { text, chars, page_count?, provider, ocr, ocr_pages?, truncated?, reason? }
//             provider: 'pdfjs' (text layer) | 'openai-vision' (OCR) | 'none'
//             reason (only when text is empty): 'no_text_layer_and_no_ocr_provider' | 'no_text_detected'
//   4xx/5xx { error, code }
//
// PDF: text layer via pdfjs-dist (Node, no canvas needed). Scanned PDF (no usable text layer):
// there is no page rasteriser on Vercel (@napi-rs/canvas is not installed), so instead the first
// ≤ 10 pages are sent to OpenAI (gpt-4.1-mini) as a `file` content part — OpenAI rasterises the
// pages itself. Images go to the same model as an image_url. Output capped at 200 000 chars.
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { requireCorpoUser, corpoJson, corpoErrorResponse, CorpoHttpError } from '$lib/server/corpo/auth';
import {
	ValidationError,
	EXTRACT_LIMITS,
	detectExtractKind,
	assertExtractSize,
	validateStorageRef,
	hasUsableTextLayer,
	capText,
	type ExtractKind
} from '$lib/server/corpo/validate';
import { extractPdfTextLayer, trimPdfToFirstPages } from '$lib/server/corpo/pdf';
import { chatCompletion, CORPO_OPENAI_MODEL } from '$lib/server/corpo/openai';

// OCR of 10 dense pages can take > 60 s of generation; Vercel Pro allows up to 300 s.
export const config: Config = { maxDuration: 120 };

const OCR_TIMEOUT_MS = 100_000;
const OCR_MAX_TOKENS = 16_000;

const OCR_PROMPT =
	'Transcribe all text in this document exactly as written. Keep line breaks and reading order, ' +
	'keep tables row by row, do not translate, do not summarise, do not add commentary. ' +
	'The text may be in French and/or English. Separate pages with a line containing only "---".';

interface LoadedFile {
	bytes: Uint8Array;
	contentType: string | null;
	filename: string;
}

async function loadInput(request: Request): Promise<LoadedFile> {
	const ct = (request.headers.get('content-type') ?? '').toLowerCase();

	if (ct.startsWith('multipart/form-data')) {
		let form: FormData;
		try {
			form = await request.formData();
		} catch {
			throw new CorpoHttpError(400, 'Invalid multipart body', 'bad_request');
		}
		const file = form.get('file');
		if (!(file instanceof File)) throw new CorpoHttpError(400, 'multipart field "file" is required', 'bad_request');
		if (file.size > EXTRACT_LIMITS.maxPdfBytes) {
			throw new CorpoHttpError(413, `File too large (max ${EXTRACT_LIMITS.maxPdfBytes / (1024 * 1024)} MB)`, 'payload_too_large');
		}
		return { bytes: new Uint8Array(await file.arrayBuffer()), contentType: file.type || null, filename: file.name || '' };
	}

	let raw: unknown;
	try {
		raw = await request.json();
	} catch {
		throw new CorpoHttpError(400, 'Send multipart/form-data with "file" or JSON {bucket, path}', 'bad_request');
	}
	const ref = validateStorageRef(raw);
	const { data, error } = await supabaseAdmin.storage.from(ref.bucket).download(ref.path);
	if (error || !data) {
		console.warn('[corpo/extract] storage download failed:', ref, error?.message);
		throw new CorpoHttpError(404, 'File not found in storage', 'not_found');
	}
	const bytes = new Uint8Array(await data.arrayBuffer());
	if (bytes.byteLength > EXTRACT_LIMITS.maxPdfBytes) {
		throw new CorpoHttpError(413, `File too large (max ${EXTRACT_LIMITS.maxPdfBytes / (1024 * 1024)} MB)`, 'payload_too_large');
	}
	const filename = ref.path.split('/').pop() ?? '';
	return { bytes, contentType: data.type || null, filename };
}

function mimeForImage(kind: ExtractKind, contentType: string | null, head: Uint8Array): string {
	if (kind !== 'image') return 'application/pdf';
	if (contentType && contentType.startsWith('image/')) return contentType.split(';')[0];
	if (head[0] === 0x89 && head[1] === 0x50) return 'image/png';
	if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
	if (head[0] === 0x47 && head[1] === 0x49) return 'image/gif';
	return 'image/webp';
}

function cleanOcr(text: string): string {
	return text
		.replace(/^```[a-z]*\n?/i, '')
		.replace(/\n?```$/i, '')
		.replace(/\r\n/g, '\n')
		.trim();
}

async function ocrImage(bytes: Uint8Array, mime: string): Promise<string> {
	const dataUrl = `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
	const result = await chatCompletion({
		context: 'corpo/extract:image',
		timeoutMs: OCR_TIMEOUT_MS,
		maxTokens: OCR_MAX_TOKENS,
		temperature: 0,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: OCR_PROMPT },
					{ type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
				]
			}
		]
	});
	return cleanOcr(result.content);
}

async function ocrPdf(bytes: Uint8Array, filename: string): Promise<string> {
	const dataUrl = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`;
	const result = await chatCompletion({
		context: 'corpo/extract:pdf',
		timeoutMs: OCR_TIMEOUT_MS,
		maxTokens: OCR_MAX_TOKENS,
		temperature: 0,
		messages: [
			{
				role: 'user',
				content: [
					{ type: 'text', text: OCR_PROMPT },
					// Chat Completions accepts PDFs as a `file` part; OpenAI extracts text + renders pages.
					{ type: 'file', file: { filename: filename || 'document.pdf', file_data: dataUrl } }
				]
			}
		]
	});
	return cleanOcr(result.content);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		await requireCorpoUser(request);

		const input = await loadInput(request);
		const head = input.bytes.subarray(0, 16);

		let kind: ExtractKind;
		try {
			kind = detectExtractKind(input.contentType, head, input.filename);
			assertExtractSize(kind, input.bytes.byteLength);
		} catch (e) {
			if (e instanceof ValidationError) throw new CorpoHttpError(e.status, e.message, e.code);
			throw e;
		}

		const hasOcrProvider = Boolean(env.OPENAI_API_KEY);

		if (kind === 'image') {
			if (!hasOcrProvider) {
				return corpoJson(200, { text: '', chars: 0, provider: 'none', ocr: false, reason: 'no_text_layer_and_no_ocr_provider' });
			}
			const text = capText(await ocrImage(input.bytes, mimeForImage(kind, input.contentType, head)));
			return corpoJson(200, {
				text,
				chars: text.length,
				provider: 'openai-vision',
				model: CORPO_OPENAI_MODEL,
				ocr: true,
				...(text.length === 0 ? { reason: 'no_text_detected' } : {})
			});
		}

		// PDF: text layer first.
		let layer: { text: string; pageCount: number };
		try {
			layer = await extractPdfTextLayer(input.bytes, EXTRACT_LIMITS.maxOutputChars);
		} catch (err) {
			const e = err as { name?: string; message?: string };
			console.warn('[corpo/extract] pdfjs failed:', e?.name, e?.message);
			if (/password/i.test(e?.message ?? '') || e?.name === 'PasswordException') {
				throw new CorpoHttpError(400, 'PDF is password-protected', 'bad_request');
			}
			throw new CorpoHttpError(400, 'Could not parse PDF', 'bad_request');
		}

		if (hasUsableTextLayer(layer.text, layer.pageCount)) {
			const text = capText(layer.text.trim());
			return corpoJson(200, {
				text,
				chars: text.length,
				page_count: layer.pageCount,
				provider: 'pdfjs',
				ocr: false,
				truncated: layer.text.length > text.length
			});
		}

		// Scanned PDF → OCR via OpenAI file input, first ≤ 10 pages.
		if (!hasOcrProvider) {
			return corpoJson(200, {
				text: '',
				chars: 0,
				page_count: layer.pageCount,
				provider: 'none',
				ocr: false,
				reason: 'no_text_layer_and_no_ocr_provider'
			});
		}

		let ocrInput = { bytes: input.bytes, pages: layer.pageCount };
		if (layer.pageCount > EXTRACT_LIMITS.maxOcrPages) {
			try {
				ocrInput = await trimPdfToFirstPages(input.bytes, EXTRACT_LIMITS.maxOcrPages);
			} catch (err) {
				console.warn('[corpo/extract] pdf-lib trim failed, sending whole PDF:', (err as Error)?.message);
			}
		}

		const text = capText(await ocrPdf(ocrInput.bytes, input.filename));
		return corpoJson(200, {
			text,
			chars: text.length,
			page_count: layer.pageCount,
			provider: 'openai-vision',
			model: CORPO_OPENAI_MODEL,
			ocr: true,
			ocr_pages: ocrInput.pages,
			truncated: ocrInput.pages < layer.pageCount,
			...(text.length === 0 ? { reason: 'no_text_detected' } : {})
		});
	} catch (err) {
		return corpoErrorResponse(err, 'corpo/extract');
	}
};
