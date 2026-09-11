// POST /api/corpo/send-email — server-side send for the Tech Mail / crew call / client
// confirmation flows (V2 spec §8.7, D8). Same SES + nodemailer raw-MIME plumbing as
// api/send-message-email, but: corpo-gated, one message to many recipients (not a per-user
// loop), caller-supplied HTML (the app renders the Outlook-safe table HTML), attachments,
// strict validation, best-effort per-user rate limit.
//
//   body {
//     to: string[], cc?: string[], bcc?: string[],           ≤ 30 recipients combined
//     subject: string,                                       ≤ 200 chars
//     html: string, text?: string,                           ≤ 500 KB each
//     reply_to?: string,                                     default: caller's email
//     attachments?: [{ filename, content_type,               PDF/PNG/JPG/ICS, ≤ 6 MB decoded total (SES raw 10 MB)
//                      content_base64 } | { filename, content_type, bucket, path }],
//     corpo_event_id?: string (uuid, logged only)
//   }
//   200 { ok:true, message_id, recipients }
//   400/413/415 { error, code } · 401/403 · 429 { error, code:'rate_limited', retry_after_sec }
//   502 { error:'Email provider rejected the message', code:'provider_error' } (SES body logged only)
import type { RequestHandler } from './$types';
import type { Config } from '@sveltejs/adapter-vercel';
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import nodemailer from 'nodemailer';
import { env as privateEnv } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { requireCorpoUser, corpoJson, corpoErrorResponse, CorpoHttpError } from '$lib/server/corpo/auth';
import { validateEmailBody, ValidationError, EMAIL_LIMITS, EXTRACT_BUCKETS } from '$lib/server/corpo/validate';
import { checkRateLimit } from '$lib/server/corpo/rateLimit';

export const config: Config = { maxDuration: 30 };

// Same verified sender as api/send-message-email (hardcoded there); only the display name differs.
const FROM_ADDRESS = 'support@produkt.ca';
const FROM_HEADER = `"Produkt Corpo" <${FROM_ADDRESS}>`;

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const SES_TIMEOUT_MS = 20_000;

const sesClient = new SESClient({
	region: privateEnv.AWS_REGION as string,
	credentials: {
		accessKeyId: privateEnv.AWS_ACCESS_KEY_ID as string,
		secretAccessKey: privateEnv.AWS_SECRET_ACCESS_KEY as string
	}
});

const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });

/** Very small HTML → text fallback when the caller sends no `text` part. */
function htmlToText(html: string): string {
	return html
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const user = await requireCorpoUser(request);

		if (!privateEnv.AWS_REGION || !privateEnv.AWS_ACCESS_KEY_ID || !privateEnv.AWS_SECRET_ACCESS_KEY) {
			throw new CorpoHttpError(500, 'Email provider is not configured on the server', 'server_error');
		}

		const rl = checkRateLimit(`send-email:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS);
		if (!rl.allowed) {
			return corpoJson(429, {
				error: `Rate limit: max ${RATE_LIMIT} sends per 10 minutes`,
				code: 'rate_limited',
				retry_after_sec: rl.retryAfterSec
			});
		}

		let raw: unknown;
		try {
			raw = await request.json();
		} catch {
			throw new CorpoHttpError(400, 'Body must be valid JSON', 'bad_request');
		}

		let mail;
		try {
			mail = validateEmailBody(raw);
		} catch (e) {
			if (e instanceof ValidationError) throw new CorpoHttpError(e.status, e.message, e.code);
			throw e;
		}

		// Resolve storage-backed attachments (private corpo buckets only) and enforce the total cap.
		let totalBytes = 0;
		const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
		for (const a of mail.attachments) {
			let content: Buffer;
			if (a.content) {
				content = a.content;
			} else if (a.storage) {
				if (!(EXTRACT_BUCKETS as readonly string[]).includes(a.storage.bucket)) {
					throw new CorpoHttpError(400, `attachment "${a.filename}": bucket must be one of ${EXTRACT_BUCKETS.join(', ')}`, 'bad_request');
				}
				const { data, error } = await supabaseAdmin.storage.from(a.storage.bucket).download(a.storage.path);
				if (error || !data) {
					console.warn('[corpo/send-email] attachment download failed:', a.storage, error?.message);
					throw new CorpoHttpError(404, `attachment "${a.filename}": file not found in storage`, 'not_found');
				}
				content = Buffer.from(await data.arrayBuffer());
			} else {
				continue;
			}
			totalBytes += content.byteLength;
			if (totalBytes > EMAIL_LIMITS.maxAttachmentBytes) {
				throw new CorpoHttpError(413, `attachments too large (max ${EMAIL_LIMITS.maxAttachmentBytes / (1024 * 1024)} MB total)`, 'payload_too_large');
			}
			attachments.push({ filename: a.filename, content, contentType: a.contentType });
		}

		const replyTo = mail.replyTo ?? user.email ?? undefined;

		const info = await transporter.sendMail({
			from: FROM_HEADER,
			to: mail.to,
			cc: mail.cc.length ? mail.cc : undefined,
			bcc: mail.bcc.length ? mail.bcc : undefined,
			replyTo,
			subject: mail.subject,
			text: mail.text ?? htmlToText(mail.html),
			html: mail.html,
			attachments: attachments.length ? attachments : undefined
		});

		const rawMessage = info.message as Buffer;

		let messageId: string;
		try {
			const result = await sesClient.send(new SendRawEmailCommand({ RawMessage: { Data: rawMessage } }), {
				abortSignal: AbortSignal.timeout(SES_TIMEOUT_MS)
			});
			messageId = result.MessageId ?? info.messageId ?? '';
		} catch (sesErr) {
			// Log the SES failure server-side; never forward AWS error bodies to the client.
			const e = sesErr as { name?: string; message?: string };
			console.error('[corpo/send-email] SES send failed:', e?.name, e?.message);
			if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
				throw new CorpoHttpError(504, 'Email provider timed out', 'timeout');
			}
			throw new CorpoHttpError(502, 'Email provider rejected the message', 'provider_error');
		}

		console.log(
			`[corpo/send-email] sent by ${user.id} to=${mail.to.length} cc=${mail.cc.length} bcc=${mail.bcc.length} ` +
				`attachments=${attachments.length} bytes=${rawMessage.byteLength}` +
				(mail.corpoEventId ? ` event=${mail.corpoEventId}` : '')
		);

		return corpoJson(200, { ok: true, message_id: messageId, recipients: mail.recipientCount });
	} catch (err) {
		return corpoErrorResponse(err, 'corpo/send-email');
	}
};
