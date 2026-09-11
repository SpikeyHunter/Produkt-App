// POST /api/corpo/classify — cheap document-type label for the Documents module (V2 spec §7.3).
//
//   body     { filename: string, excerpt: string (≤ 4 000 chars, truncated) }
//   200      { doc_type, confidence, provider:'openai'|'keywords', model? }
//   4xx/5xx  { error, code }
//
// gpt-4.1-mini with a strict JSON schema; keyword fallback when the model errors or times out
// so the upload pipeline never blocks on the provider.
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { requireCorpoUser, corpoJson, corpoErrorResponse, CorpoHttpError } from '$lib/server/corpo/auth';
import {
	validateClassifyBody,
	classifyByKeywords,
	isDocType,
	DOC_TYPES,
	ValidationError
} from '$lib/server/corpo/validate';
import { chatCompletion, CORPO_OPENAI_MODEL } from '$lib/server/corpo/openai';

export const config: Config = { maxDuration: 30 };

const OPENAI_TIMEOUT_MS = 20_000;

const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	properties: {
		doc_type: { type: 'string', enum: [...DOC_TYPES] },
		confidence: { type: 'number' }
	},
	required: ['doc_type', 'confidence']
};

const SYSTEM_PROMPT = [
	'You classify documents for a corporate-events team at a Montreal venue (New City Gas).',
	'Documents are in French or English. Given a filename and a text excerpt, return exactly one doc_type:',
	'contract (signed agreements, entente, terms), invoice (facture, amount due), quote (devis, soumission, estimate, proposal),',
	'plan (floor plan, aménagement, seating, stage plot), rider (technical rider, fiche technique, backline),',
	'menu (food/drink menus, forfaits bar), insurance (assurance, certificate of insurance), permit (permis, licences, RAQ, city authorisations),',
	'photo (image with little or no text), email (a saved email / courriel), run_of_show (horaire, schedule, déroulement, cue sheet),',
	'other (anything else). confidence is 0–1.'
].join('\n');

export const POST: RequestHandler = async ({ request }) => {
	try {
		await requireCorpoUser(request);

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			throw new CorpoHttpError(400, 'Body must be valid JSON', 'bad_request');
		}

		let input;
		try {
			input = validateClassifyBody(raw);
		} catch (e) {
			if (e instanceof ValidationError) throw new CorpoHttpError(e.status, e.message, e.code);
			throw e;
		}

		const fallback = classifyByKeywords(input.filename, input.excerpt);

		try {
			const result = await chatCompletion({
				context: 'corpo/classify',
				timeoutMs: OPENAI_TIMEOUT_MS,
				maxTokens: 60,
				temperature: 0,
				jsonSchema: { name: 'corpo_doc_type', schema: SCHEMA },
				messages: [
					{ role: 'system', content: SYSTEM_PROMPT },
					{
						role: 'user',
						content: `FILENAME: ${input.filename || '(none)'}\n\nEXCERPT:\n${input.excerpt || '(empty)'}`
					}
				]
			});
			const parsed = JSON.parse(result.content) as { doc_type?: unknown; confidence?: unknown };
			if (isDocType(parsed.doc_type)) {
				const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5;
				return corpoJson(200, { doc_type: parsed.doc_type, confidence, provider: 'openai', model: CORPO_OPENAI_MODEL });
			}
			console.warn('[corpo/classify] model returned unknown doc_type, using keywords:', parsed.doc_type);
		} catch (err) {
			// Provider errors (502/504/500-missing-key) and bad JSON all degrade to the keyword result.
			const e = err as { message?: string };
			console.warn('[corpo/classify] model failed, using keywords:', e?.message ?? err);
		}

		return corpoJson(200, { doc_type: fallback, confidence: 0.3, provider: 'keywords' });
	} catch (err) {
		return corpoErrorResponse(err, 'corpo/classify');
	}
};
