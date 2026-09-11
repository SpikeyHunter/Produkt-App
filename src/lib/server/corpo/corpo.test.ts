// Unit tests for the pure corpo helpers (no network, no $env): access predicate, validators,
// keyword classifier, rate limiter.
import { describe, expect, it } from 'vitest';
import { hasCorpoAccess, normalizeSecondary } from './access';
import {
	validateEmailBody,
	validateAttachments,
	ValidationError,
	isPlausibleEmail,
	detectExtractKind,
	assertExtractSize,
	validateStorageRef,
	hasUsableTextLayer,
	classifyByKeywords,
	validateClassifyBody,
	base64DecodedLength,
	EMAIL_LIMITS
} from './validate';
import { checkRateLimit, resetRateLimits } from './rateLimit';

describe('hasCorpoAccess (D6)', () => {
	it.each([
		[{ role: 'Admin' }, true],
		[{ role: 'User', main_permission: 'Corpo' }, true],
		[{ role: 'User', main_permission: 'Booking', secondary_permission: ['Corpo'] }, true],
		[{ role: 'User', main_permission: 'Booking', secondary_permission: '{Marketing,Corpo}' }, true],
		[{ role: 'User', main_permission: 'Booking', secondary_permission: 'Corpo' }, true],
		[{ role: 'User', main_permission: 'Booking', secondary_permission: ['Marketing'] }, false],
		[{ role: 'User', main_permission: 'corpo' }, false], // case-sensitive, like the SQL
		[{ role: 'admin' }, false],
		[{ role: 'User' }, false],
		[null, false],
		[undefined, false]
	])('%j → %s', (profile, expected) => {
		expect(hasCorpoAccess(profile as never)).toBe(expected);
	});

	it('normalizes secondary_permission shapes', () => {
		expect(normalizeSecondary(null)).toEqual([]);
		expect(normalizeSecondary(['A', 'B'])).toEqual(['A', 'B']);
		expect(normalizeSecondary('{A,"B C"}')).toEqual(['A', 'B C']);
		expect(normalizeSecondary('["A","B"]')).toEqual(['A', 'B']);
		expect(normalizeSecondary('Corpo')).toEqual(['Corpo']);
	});
});

describe('isPlausibleEmail', () => {
	it.each(['a@b.co', 'first.last+tag@sub.example.com', 'x@produkt.ca'])('accepts %s', (v) => {
		expect(isPlausibleEmail(v)).toBe(true);
	});
	it.each(['', 'nope', 'a@b', 'a b@c.com', 'a@b..com', '<a@b.com>', 'a@b.com\nBcc: x@y.com', 42, null])(
		'rejects %j',
		(v) => expect(isPlausibleEmail(v)).toBe(false)
	);
});

const validEmail = () => ({
	to: ['tech@example.com'],
	subject: 'Mail technique — Olymel',
	html: '<table><tr><td>Bonjour</td></tr></table>'
});

describe('validateEmailBody', () => {
	it('accepts a minimal body and lowercases/dedupes recipients', () => {
		const v = validateEmailBody({ ...validEmail(), to: ['A@Example.com', 'a@example.com'], cc: ['b@example.com'] });
		expect(v.to).toEqual(['a@example.com']);
		expect(v.cc).toEqual(['b@example.com']);
		expect(v.recipientCount).toBe(2);
		expect(v.attachments).toEqual([]);
	});

	it('rejects too many recipients across to/cc/bcc', () => {
		const to = Array.from({ length: 20 }, (_, i) => `t${i}@example.com`);
		const cc = Array.from({ length: 11 }, (_, i) => `c${i}@example.com`);
		expect(() => validateEmailBody({ ...validEmail(), to, cc })).toThrow(/Too many recipients/);
	});

	it('rejects missing/invalid fields', () => {
		expect(() => validateEmailBody(null)).toThrow(ValidationError);
		expect(() => validateEmailBody({ ...validEmail(), to: [] })).toThrow(/at least one/);
		expect(() => validateEmailBody({ ...validEmail(), to: ['bad'] })).toThrow(/invalid email/);
		expect(() => validateEmailBody({ ...validEmail(), subject: '' })).toThrow(/subject/);
		expect(() => validateEmailBody({ ...validEmail(), subject: 'x'.repeat(201) })).toThrow(/too long/);
		expect(() => validateEmailBody({ ...validEmail(), subject: 'a\nBcc: evil@x.com' })).toThrow(/line breaks/);
		expect(() => validateEmailBody({ ...validEmail(), html: '' })).toThrow(/html/);
		expect(() => validateEmailBody({ ...validEmail(), reply_to: 'nope' })).toThrow(/reply_to/);
		expect(() => validateEmailBody({ ...validEmail(), corpo_event_id: '123' })).toThrow(/UUID/);
	});

	it('rejects html over 500 KB with 413', () => {
		let err: unknown;
		try {
			validateEmailBody({ ...validEmail(), html: 'x'.repeat(EMAIL_LIMITS.maxHtmlBytes + 1) });
		} catch (e) {
			err = e;
		}
		expect(err).toBeInstanceOf(ValidationError);
		expect((err as ValidationError).status).toBe(413);
	});
});

describe('validateAttachments', () => {
	const pdfB64 = Buffer.from('%PDF-1.4 fake').toString('base64');

	it('accepts PDF/PNG/JPG/ICS with matching extensions', () => {
		const out = validateAttachments([
			{ filename: 'plan.pdf', content_type: 'application/pdf', content_base64: pdfB64 },
			{ filename: 'logo.PNG', content_type: 'image/png', content_base64: pdfB64 },
			{ filename: 'photo.jpeg', content_type: 'image/jpeg; charset=binary', content_base64: pdfB64 },
			{ filename: 'event.ics', content_type: 'text/calendar', content_base64: pdfB64 },
			{ filename: 'render.png', content_type: 'image/png', bucket: 'corpo-renders', path: 'thumbs/x.png' }
		]);
		expect(out).toHaveLength(5);
		expect(out[0].content?.toString()).toBe('%PDF-1.4 fake');
		expect(out[4].storage).toEqual({ bucket: 'corpo-renders', path: 'thumbs/x.png' });
	});

	it('rejects disallowed types, mismatched extensions and ambiguous sources', () => {
		expect(() => validateAttachments([{ filename: 'a.exe', content_type: 'application/octet-stream', content_base64: pdfB64 }])).toThrow(
			/only PDF, PNG, JPG and ICS/
		);
		expect(() => validateAttachments([{ filename: 'a.pdf', content_type: 'image/png', content_base64: pdfB64 }])).toThrow(ValidationError);
		expect(() => validateAttachments([{ filename: 'a.pdf', content_type: 'application/pdf' }])).toThrow(/exactly one/);
		expect(() =>
			validateAttachments([{ filename: 'a.pdf', content_type: 'application/pdf', content_base64: pdfB64, bucket: 'b', path: 'p' }])
		).toThrow(/exactly one/);
		expect(() => validateAttachments([{ filename: 'a.pdf', content_type: 'application/pdf', bucket: 'corpo-documents', path: '../x' }])).toThrow(
			/invalid path/
		);
	});

	it('enforces the 8 MB total cap without decoding', () => {
		const big = 'A'.repeat(Math.ceil((EMAIL_LIMITS.maxAttachmentBytes * 4) / 3) + 8);
		expect(base64DecodedLength(big)).toBeGreaterThan(EMAIL_LIMITS.maxAttachmentBytes);
		let err: unknown;
		try {
			validateAttachments([{ filename: 'a.pdf', content_type: 'application/pdf', content_base64: big }]);
		} catch (e) {
			err = e;
		}
		expect((err as ValidationError).status).toBe(413);
	});
});

describe('extract validators', () => {
	const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

	it('detects kind from magic bytes, content-type or extension', () => {
		expect(detectExtractKind('application/octet-stream', pdf)).toBe('pdf');
		expect(detectExtractKind(null, png)).toBe('image');
		expect(detectExtractKind(null, jpg)).toBe('image');
		expect(detectExtractKind('image/heic', new Uint8Array(4), 'x.heic')).toBe('image');
		expect(detectExtractKind(null, new Uint8Array(4), 'x.pdf')).toBe('pdf');
		expect(() => detectExtractKind('application/msword', new Uint8Array(8), 'x.doc')).toThrow(/Unsupported/);
	});

	it('enforces size caps per kind', () => {
		expect(() => assertExtractSize('pdf', 20 * 1024 * 1024)).not.toThrow();
		expect(() => assertExtractSize('pdf', 20 * 1024 * 1024 + 1)).toThrow(/too large/);
		expect(() => assertExtractSize('image', 10 * 1024 * 1024 + 1)).toThrow(/too large/);
		expect(() => assertExtractSize('image', 0)).toThrow(/Empty/);
	});

	it('only allows the corpo private buckets', () => {
		expect(validateStorageRef({ path: '/shared/a.pdf' })).toEqual({ bucket: 'corpo-documents', path: 'shared/a.pdf' });
		expect(() => validateStorageRef({ bucket: 'documents', path: 'a.pdf' })).toThrow(/bucket must be/);
		expect(() => validateStorageRef({ bucket: 'corpo-documents', path: '../a.pdf' })).toThrow(/invalid path/);
		expect(() => validateStorageRef({ bucket: 'corpo-documents' })).toThrow(/path is required/);
	});

	it('judges a text layer usable only with enough characters per page', () => {
		expect(hasUsableTextLayer('', 2)).toBe(false);
		expect(hasUsableTextLayer('a b c', 2)).toBe(false);
		expect(hasUsableTextLayer('x'.repeat(400), 2)).toBe(true);
	});
});

describe('classify', () => {
	it('validates and truncates the excerpt', () => {
		const v = validateClassifyBody({ filename: 'a.pdf', excerpt: 'x'.repeat(5000) });
		expect(v.excerpt).toHaveLength(4000);
		expect(() => validateClassifyBody({})).toThrow(/filename and\/or excerpt/);
	});

	it.each([
		['Facture_Olymel_2026.pdf', 'Montant dû: 12 000 $ TPS TVQ', 'invoice'],
		['Devis traiteur.pdf', 'Soumission pour 250 personnes', 'quote'],
		['contrat.pdf', 'This agreement is entered into by the parties. Signature:', 'contract'],
		['Schedule Olymel.xlsx', '17:00 ouverture des portes, 18:30 discours', 'run_of_show'],
		['plan_salle.pdf', 'aménagement tables scène', 'plan'],
		['IMG_2041.jpeg', '', 'photo'],
		['certificat.pdf', 'Certificate of insurance – general liability', 'insurance'],
		['random.bin', 'zzzz qqqq', 'other']
	])('%s → %s', (filename, excerpt, expected) => {
		expect(classifyByKeywords(filename, excerpt)).toBe(expected);
	});
});

describe('checkRateLimit', () => {
	it('allows up to the limit in the window, then blocks with retry_after', () => {
		resetRateLimits();
		const t0 = 1_000_000;
		for (let i = 0; i < 20; i++) expect(checkRateLimit('u1', 20, 600_000, t0 + i).allowed).toBe(true);
		const blocked = checkRateLimit('u1', 20, 600_000, t0 + 30);
		expect(blocked.allowed).toBe(false);
		expect(blocked.retryAfterSec).toBeGreaterThan(0);
		expect(checkRateLimit('u2', 20, 600_000, t0 + 30).allowed).toBe(true);
		expect(checkRateLimit('u1', 20, 600_000, t0 + 600_001).allowed).toBe(true);
	});
});
