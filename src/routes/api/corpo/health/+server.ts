// GET /api/corpo/health — requires corpo auth so the Mac app can verify its token + access
// against this backend (the Render service has an unauthenticated /health; this one is gated
// on purpose: a 200 here means "this user can call every /api/corpo/* route").
//
//   200 { ok:true, service:'produkt-app-corpo', routes:[…], user:{id,email,role}, limits, ts }
//   401 { error, code:'unauthorized' } · 403 { error:'no_corpo_access', code:'forbidden' }
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { requireCorpoUser, corpoJson, corpoErrorResponse } from '$lib/server/corpo/auth';
import { EMAIL_LIMITS, EXTRACT_LIMITS, CLASSIFY_LIMITS } from '$lib/server/corpo/validate';
import { CORPO_OPENAI_MODEL } from '$lib/server/corpo/openai';

export const config: Config = { maxDuration: 15 };

const CORPO_ROUTES = [
	{ method: 'GET', path: '/api/corpo/health' },
	{ method: 'POST', path: '/api/corpo/send-email' },
	{ method: 'POST', path: '/api/corpo/extract' },
	{ method: 'POST', path: '/api/corpo/classify' }
] as const;

export const GET: RequestHandler = async ({ request }) => {
	try {
		const user = await requireCorpoUser(request);
		return corpoJson(200, {
			ok: true,
			service: 'produkt-app-corpo',
			routes: CORPO_ROUTES,
			user: { id: user.id, email: user.email, role: user.role, main_permission: user.main_permission },
			limits: {
				email: {
					max_recipients: EMAIL_LIMITS.maxRecipients,
					max_subject_chars: EMAIL_LIMITS.maxSubjectChars,
					max_html_bytes: EMAIL_LIMITS.maxHtmlBytes,
					max_attachment_bytes: EMAIL_LIMITS.maxAttachmentBytes,
					rate_limit: '20 sends / 10 min / user (best-effort, per instance)'
				},
				extract: {
					max_pdf_bytes: EXTRACT_LIMITS.maxPdfBytes,
					max_image_bytes: EXTRACT_LIMITS.maxImageBytes,
					max_output_chars: EXTRACT_LIMITS.maxOutputChars,
					max_ocr_pages: EXTRACT_LIMITS.maxOcrPages,
					request_body_note: 'Vercel caps request bodies at ~4.5 MB; larger files must use {bucket, path}'
				},
				classify: { max_excerpt_chars: CLASSIFY_LIMITS.maxExcerptChars, model: CORPO_OPENAI_MODEL }
			},
			ts: new Date().toISOString()
		});
	} catch (err) {
		return corpoErrorResponse(err, 'corpo/health');
	}
};
