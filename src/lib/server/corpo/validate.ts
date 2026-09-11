// Pure validators for /api/corpo/* bodies — no I/O, no $env, so they are unit-testable.
// Each returns a normalised value or throws a ValidationError({message, code}).

export type ValidationCode = 'bad_request' | 'payload_too_large' | 'unsupported_media_type';

export class ValidationError extends Error {
	readonly code: ValidationCode;
	readonly status: number;
	constructor(message: string, code: ValidationCode = 'bad_request') {
		super(message);
		this.name = 'ValidationError';
		this.code = code;
		this.status = code === 'payload_too_large' ? 413 : code === 'unsupported_media_type' ? 415 : 400;
	}
}

// ── Limits (exported so routes, tests and docs share one source) ───────────────────────────
export const EMAIL_LIMITS = {
	maxRecipients: 30, // to + cc + bcc combined
	maxSubjectChars: 200,
	maxHtmlBytes: 500 * 1024,
	maxTextBytes: 500 * 1024,
	// Decoded, all attachments combined. 6 MB decoded ≈ 8.2 MB base64 in the MIME + 0.5 MB HTML
	// stays under SES v1 SendRawEmail's 10 MB raw-message limit (the API send-message-email uses).
	maxAttachmentBytes: 6 * 1024 * 1024,
	maxAttachments: 10,
	maxFilenameChars: 120
} as const;

/** Attachment types the Tech Mail flow needs: PDF, PNG, JPG, ICS. */
export const ALLOWED_ATTACHMENT_TYPES: Readonly<Record<string, readonly string[]>> = {
	'application/pdf': ['pdf'],
	'image/png': ['png'],
	'image/jpeg': ['jpg', 'jpeg'],
	'text/calendar': ['ics']
};

export const EXTRACT_LIMITS = {
	maxPdfBytes: 20 * 1024 * 1024,
	maxImageBytes: 10 * 1024 * 1024,
	maxOutputChars: 200_000,
	maxOcrPages: 10,
	/** Below this many text-layer chars per page the PDF is treated as scanned. */
	minTextCharsPerPage: 25
} as const;

export const CLASSIFY_LIMITS = { maxExcerptChars: 4_000, maxFilenameChars: 255 } as const;

export const DOC_TYPES = [
	'contract',
	'invoice',
	'quote',
	'plan',
	'rider',
	'menu',
	'insurance',
	'permit',
	'photo',
	'email',
	'run_of_show',
	'other'
] as const;
export type DocType = (typeof DOC_TYPES)[number];

// ── Email ──────────────────────────────────────────────────────────────────────────────────

// Plausible, not RFC-complete: one @, no spaces/control chars, a dotted domain with a 2+ letter TLD.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;

export function isPlausibleEmail(value: unknown): value is string {
	return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value.trim());
}

/** Header injection guard: no CR/LF in subject, addresses or filenames. */
function assertNoNewlines(value: string, field: string): void {
	if (/[\r\n]/.test(value)) throw new ValidationError(`${field} must not contain line breaks`);
}

function normalizeRecipientList(value: unknown, field: string, required: boolean): string[] {
	if (value === undefined || value === null) {
		if (required) throw new ValidationError(`${field} is required`);
		return [];
	}
	if (!Array.isArray(value)) throw new ValidationError(`${field} must be an array of email addresses`);
	const out: string[] = [];
	for (const raw of value) {
		if (!isPlausibleEmail(raw)) throw new ValidationError(`${field} contains an invalid email address`);
		const addr = raw.trim().toLowerCase();
		if (!out.includes(addr)) out.push(addr);
	}
	if (required && out.length === 0) throw new ValidationError(`${field} must contain at least one address`);
	return out;
}

export interface EmailAttachmentInput {
	filename: string;
	content_base64?: string;
	content_type: string;
	/** Alternative to content_base64: fetch from a private Supabase bucket (server-side). */
	bucket?: string;
	path?: string;
}

export interface ValidatedAttachment {
	filename: string;
	contentType: string;
	/** Decoded bytes when content_base64 was supplied. */
	content?: Buffer;
	/** Storage location when bucket/path was supplied. */
	storage?: { bucket: string; path: string };
	/** Decoded size in bytes (estimated from base64 length before decoding). */
	bytes: number;
}

export interface ValidatedEmail {
	to: string[];
	cc: string[];
	bcc: string[];
	subject: string;
	html: string;
	text?: string;
	replyTo?: string;
	attachments: ValidatedAttachment[];
	corpoEventId?: string;
	recipientCount: number;
}

export function extensionOf(filename: string): string {
	const idx = filename.lastIndexOf('.');
	return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

export function isAllowedAttachment(contentType: string, filename: string): boolean {
	const exts = ALLOWED_ATTACHMENT_TYPES[contentType.toLowerCase().split(';')[0].trim()];
	if (!exts) return false;
	return exts.includes(extensionOf(filename));
}

/** Decoded byte length of a base64 string without decoding it. */
export function base64DecodedLength(b64: string): number {
	const clean = b64.replace(/\s+/g, '');
	const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
	return Math.floor((clean.length * 3) / 4) - padding;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateEmailBody(body: unknown): ValidatedEmail {
	if (!body || typeof body !== 'object' || Array.isArray(body)) {
		throw new ValidationError('Body must be a JSON object');
	}
	const b = body as Record<string, unknown>;

	const to = normalizeRecipientList(b.to, 'to', true);
	const cc = normalizeRecipientList(b.cc, 'cc', false);
	const bcc = normalizeRecipientList(b.bcc, 'bcc', false);
	const recipientCount = new Set([...to, ...cc, ...bcc]).size;
	if (recipientCount > EMAIL_LIMITS.maxRecipients) {
		throw new ValidationError(`Too many recipients (max ${EMAIL_LIMITS.maxRecipients})`);
	}

	if (typeof b.subject !== 'string' || b.subject.trim().length === 0) {
		throw new ValidationError('subject is required');
	}
	const subject = b.subject.trim();
	assertNoNewlines(subject, 'subject');
	if (subject.length > EMAIL_LIMITS.maxSubjectChars) {
		throw new ValidationError(`subject too long (max ${EMAIL_LIMITS.maxSubjectChars} chars)`);
	}

	if (typeof b.html !== 'string' || b.html.trim().length === 0) {
		throw new ValidationError('html is required');
	}
	const html = b.html;
	if (Buffer.byteLength(html, 'utf8') > EMAIL_LIMITS.maxHtmlBytes) {
		throw new ValidationError(`html too large (max ${EMAIL_LIMITS.maxHtmlBytes / 1024} KB)`, 'payload_too_large');
	}

	let text: string | undefined;
	if (b.text !== undefined && b.text !== null) {
		if (typeof b.text !== 'string') throw new ValidationError('text must be a string');
		if (Buffer.byteLength(b.text, 'utf8') > EMAIL_LIMITS.maxTextBytes) {
			throw new ValidationError('text too large', 'payload_too_large');
		}
		text = b.text;
	}

	let replyTo: string | undefined;
	if (b.reply_to !== undefined && b.reply_to !== null && b.reply_to !== '') {
		if (!isPlausibleEmail(b.reply_to)) throw new ValidationError('reply_to is not a valid email address');
		replyTo = (b.reply_to as string).trim();
	}

	let corpoEventId: string | undefined;
	if (b.corpo_event_id !== undefined && b.corpo_event_id !== null && b.corpo_event_id !== '') {
		if (typeof b.corpo_event_id !== 'string' || !UUID_RE.test(b.corpo_event_id)) {
			throw new ValidationError('corpo_event_id must be a UUID');
		}
		corpoEventId = b.corpo_event_id;
	}

	const attachments = validateAttachments(b.attachments);

	return { to, cc, bcc, subject, html, text, replyTo, attachments, corpoEventId, recipientCount };
}

export function validateAttachments(value: unknown): ValidatedAttachment[] {
	if (value === undefined || value === null) return [];
	if (!Array.isArray(value)) throw new ValidationError('attachments must be an array');
	if (value.length > EMAIL_LIMITS.maxAttachments) {
		throw new ValidationError(`Too many attachments (max ${EMAIL_LIMITS.maxAttachments})`);
	}
	const out: ValidatedAttachment[] = [];
	let total = 0;
	for (const raw of value as unknown[]) {
		if (!raw || typeof raw !== 'object') throw new ValidationError('attachment must be an object');
		const a = raw as Partial<EmailAttachmentInput>;
		if (typeof a.filename !== 'string' || !a.filename.trim()) throw new ValidationError('attachment.filename is required');
		const filename = a.filename.trim().replace(/[\\/]/g, '_');
		assertNoNewlines(filename, 'attachment.filename');
		if (filename.length > EMAIL_LIMITS.maxFilenameChars) throw new ValidationError('attachment.filename too long');
		if (typeof a.content_type !== 'string' || !a.content_type.trim()) {
			throw new ValidationError('attachment.content_type is required');
		}
		const contentType = a.content_type.trim().toLowerCase().split(';')[0];
		if (!isAllowedAttachment(contentType, filename)) {
			throw new ValidationError(
				`attachment "${filename}": only PDF, PNG, JPG and ICS are allowed (type must match extension)`,
				'unsupported_media_type'
			);
		}

		const hasBase64 = typeof a.content_base64 === 'string' && a.content_base64.length > 0;
		const hasStorage = typeof a.bucket === 'string' && typeof a.path === 'string' && a.path.length > 0;
		if (hasBase64 === hasStorage) {
			throw new ValidationError(`attachment "${filename}": provide exactly one of content_base64 or bucket+path`);
		}

		if (hasBase64) {
			const b64 = (a.content_base64 as string).replace(/^data:[^;]+;base64,/, '');
			if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw new ValidationError(`attachment "${filename}": invalid base64`);
			const bytes = base64DecodedLength(b64);
			total += bytes;
			if (total > EMAIL_LIMITS.maxAttachmentBytes) {
				throw new ValidationError(
					`attachments too large (max ${EMAIL_LIMITS.maxAttachmentBytes / (1024 * 1024)} MB total)`,
					'payload_too_large'
				);
			}
			out.push({ filename, contentType, content: Buffer.from(b64, 'base64'), bytes });
		} else {
			const bucket = (a.bucket as string).trim();
			const path = (a.path as string).trim();
			if (!/^[a-z0-9-]+$/.test(bucket)) throw new ValidationError(`attachment "${filename}": invalid bucket`);
			if (path.includes('..') || path.startsWith('/')) throw new ValidationError(`attachment "${filename}": invalid path`);
			out.push({ filename, contentType, storage: { bucket, path }, bytes: 0 });
		}
	}
	return out;
}

// ── Extract ────────────────────────────────────────────────────────────────────────────────

export type ExtractKind = 'pdf' | 'image';

/** Detects the document kind from content-type + magic bytes; throws 415 for anything else. */
export function detectExtractKind(contentType: string | null | undefined, head: Uint8Array, filename = ''): ExtractKind {
	const ct = (contentType ?? '').toLowerCase().split(';')[0].trim();
	const ext = extensionOf(filename);
	const isPdfMagic = head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
	const isPng = head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
	const isJpeg = head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
	const isWebp = head.length >= 12 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
	const isGif = head.length >= 4 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;

	if (isPdfMagic || ct === 'application/pdf' || ext === 'pdf') return 'pdf';
	if (isPng || isJpeg || isWebp || isGif) return 'image';
	if (ct.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'heic'].includes(ext)) return 'image';
	throw new ValidationError('Unsupported file type: send a PDF or an image (PNG/JPG/WEBP/GIF)', 'unsupported_media_type');
}

export function assertExtractSize(kind: ExtractKind, bytes: number): void {
	const max = kind === 'pdf' ? EXTRACT_LIMITS.maxPdfBytes : EXTRACT_LIMITS.maxImageBytes;
	if (bytes > max) {
		throw new ValidationError(`${kind.toUpperCase()} too large (max ${max / (1024 * 1024)} MB)`, 'payload_too_large');
	}
	if (bytes === 0) throw new ValidationError('Empty file');
}

export interface StorageRef {
	bucket: string;
	path: string;
}

/** Only the corpo private buckets may be read by the extract route. */
export const EXTRACT_BUCKETS = ['corpo-documents', 'corpo-assets', 'corpo-renders'] as const;

export function validateStorageRef(body: unknown): StorageRef {
	if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object {bucket, path}');
	const b = body as Record<string, unknown>;
	const bucket = typeof b.bucket === 'string' && b.bucket.trim() ? b.bucket.trim() : 'corpo-documents';
	if (!(EXTRACT_BUCKETS as readonly string[]).includes(bucket)) {
		throw new ValidationError(`bucket must be one of ${EXTRACT_BUCKETS.join(', ')}`);
	}
	if (typeof b.path !== 'string' || !b.path.trim()) throw new ValidationError('path is required');
	const path = b.path.trim().replace(/^\/+/, '');
	if (path.includes('..') || path.length > 1024) throw new ValidationError('invalid path');
	return { bucket, path };
}

/** Heuristic: does the text layer hold enough characters to count as "has text"? */
export function hasUsableTextLayer(text: string, pageCount: number): boolean {
	const chars = text.replace(/\s+/g, '').length;
	return chars >= Math.max(EXTRACT_LIMITS.minTextCharsPerPage, EXTRACT_LIMITS.minTextCharsPerPage * Math.max(pageCount, 1) * 0.5);
}

export function capText(text: string, max = EXTRACT_LIMITS.maxOutputChars): string {
	return text.length > max ? text.slice(0, max) : text;
}

// ── Classify ───────────────────────────────────────────────────────────────────────────────

export interface ClassifyInput {
	filename: string;
	excerpt: string;
}

export function validateClassifyBody(body: unknown): ClassifyInput {
	if (!body || typeof body !== 'object') throw new ValidationError('Body must be a JSON object {filename, excerpt}');
	const b = body as Record<string, unknown>;
	const filename = typeof b.filename === 'string' ? b.filename.trim().slice(0, CLASSIFY_LIMITS.maxFilenameChars) : '';
	const excerptRaw = typeof b.excerpt === 'string' ? b.excerpt : '';
	if (!filename && !excerptRaw.trim()) throw new ValidationError('Provide filename and/or excerpt');
	const excerpt = excerptRaw.slice(0, CLASSIFY_LIMITS.maxExcerptChars);
	return { filename, excerpt };
}

export function isDocType(value: unknown): value is DocType {
	return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value);
}

/**
 * Keyword fallback used when the model is unavailable. Order matters: the first family with a
 * hit wins, filename hits count double. FR + EN vocabulary from the reference corpo files.
 */
const KEYWORDS: ReadonlyArray<[DocType, RegExp]> = [
	['run_of_show', /\b(run[ -]?of[ -]?show|horaire|schedule|déroulement|deroulement|minute[- ]by[- ]minute|cue ?sheet)\b/i],
	['rider', /\b(rider|fiche technique|tech(nical)? spec|backline|input list|hospitality)\b/i],
	['insurance', /\b(insurance|assurance|certificate of insurance|coi|liability|responsabilit[ée] civile|police d'assurance)\b/i],
	['permit', /\b(permit|permis|licen[cs]e|r[ée]gie des alcools|raq|ville de montr[ée]al|autorisation)\b/i],
	['invoice', /\b(invoice|facture|amount due|montant d[ûu]|solde|balance due|tps|tvq|gst|qst|payment terms)\b/i],
	['quote', /\b(quote|quotation|devis|soumission|estimate|estimation|proposal|proposition)\b/i],
	['contract', /\b(contract|contrat|agreement|entente|terms and conditions|conditions g[ée]n[ée]rales|signature|parties)\b/i],
	['menu', /\b(menu|cocktail|canap[ée]s?|bouch[ée]es?|entr[ée]e|plat principal|dessert|bar package|open bar|forfait)\b/i],
	['plan', /\b(plan|floor ?plan|layout|am[ée]nagement|seating|tables?|sc[èe]ne|stage plot|dwg|dxf)\b/i],
	['email', /\b(subject|objet|from:|de:|to:|à:|re:|fwd?:|courriel|e-?mail)\b/i],
	['photo', /\.(jpe?g|png|heic|webp|gif|tiff?)$/i]
];

export function classifyByKeywords(filename: string, excerpt: string): DocType {
	const name = filename.toLowerCase();
	const text = excerpt.toLowerCase();
	let best: DocType = 'other';
	let bestScore = 0;
	for (const [type, re] of KEYWORDS) {
		const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
		const nameHits = (name.match(global) ?? []).length * 2;
		const textHits = (text.match(global) ?? []).length;
		const score = nameHits + textHits;
		if (score > bestScore) {
			bestScore = score;
			best = type;
		}
	}
	if (best === 'other' && !excerpt.trim() && /\.(jpe?g|png|heic|webp|gif|tiff?)$/i.test(filename)) return 'photo';
	return best;
}
