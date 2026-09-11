// Corpo auth for /api/corpo/* — Bearer Supabase JWT → supabaseAdmin.auth.getUser →
// user_profiles → corpo access rule (V2 spec §0 D6).
//
//   401 {error, code:'unauthorized'}                 missing / invalid / expired token
//   403 {error:'no_corpo_access', code:'forbidden'}  valid user without corpo access (or no profile)
//
// Same contract as the Render service (produkt-corpo-api backend/src/middleware/auth.ts) so the
// Mac app's CorpoAPIClient can treat both backends identically.
import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import { hasCorpoAccess, normalizeSecondary } from './access';

export type CorpoErrorCode =
	| 'unauthorized'
	| 'forbidden'
	| 'bad_request'
	| 'payload_too_large'
	| 'unsupported_media_type'
	| 'rate_limited'
	| 'not_found'
	| 'provider_error'
	| 'timeout'
	| 'server_error';

/** Typed HTTP error every corpo route throws; `corpoErrorResponse` maps it to JSON. */
export class CorpoHttpError extends Error {
	readonly status: number;
	readonly code: CorpoErrorCode;
	constructor(status: number, message: string, code: CorpoErrorCode) {
		super(message);
		this.name = 'CorpoHttpError';
		this.status = status;
		this.code = code;
	}
}

export interface CorpoUser {
	id: string;
	email: string | null;
	first_name: string | null;
	last_name: string | null;
	role: string | null;
	main_permission: string | null;
	secondary_permission: string[];
	/** The raw bearer token, in case a route needs to act as the user. */
	accessToken: string;
}

const PROFILE_COLUMNS = 'id, email, first_name, last_name, role, main_permission, secondary_permission';

export function bearerToken(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (!header) return null;
	const [scheme, ...rest] = header.trim().split(/\s+/);
	if (!scheme || scheme.toLowerCase() !== 'bearer') return null;
	const token = rest.join('').trim();
	return token.length > 0 ? token : null;
}

/**
 * Resolves the calling user or throws a CorpoHttpError (401/403).
 * Never caches: each Vercel invocation is short-lived and the profile read is one indexed row.
 */
export async function requireCorpoUser(request: Request): Promise<CorpoUser> {
	const token = bearerToken(request);
	if (!token) throw new CorpoHttpError(401, 'Missing bearer token', 'unauthorized');

	const { data, error } = await supabaseAdmin.auth.getUser(token);
	if (error || !data?.user) {
		console.warn('[corpo/auth] getUser failed:', error?.message ?? 'no user');
		throw new CorpoHttpError(401, 'Invalid or expired token', 'unauthorized');
	}

	const { data: profile, error: profileError } = await supabaseAdmin
		.from('user_profiles')
		.select(PROFILE_COLUMNS)
		.eq('id', data.user.id)
		.maybeSingle();

	if (profileError) {
		console.error('[corpo/auth] user_profiles read failed:', profileError.message);
		throw new CorpoHttpError(500, 'Could not load user profile', 'server_error');
	}

	if (!profile || !hasCorpoAccess(profile)) {
		console.info('[corpo/auth] corpo access denied', { userId: data.user.id, hasProfile: Boolean(profile) });
		throw new CorpoHttpError(403, 'no_corpo_access', 'forbidden');
	}

	return {
		id: profile.id,
		email: profile.email ?? data.user.email ?? null,
		first_name: profile.first_name ?? null,
		last_name: profile.last_name ?? null,
		role: profile.role ?? null,
		main_permission: profile.main_permission ?? null,
		secondary_permission: normalizeSecondary(profile.secondary_permission),
		accessToken: token
	};
}

/** `json()` with the status first — every corpo route returns through this. */
export function corpoJson(status: number, body: Record<string, unknown>): Response {
	return json(body, { status });
}

/**
 * Maps any thrown value to a `{error, code}` JSON response. Provider/SES bodies never reach the
 * client: CorpoHttpError carries a short message; anything else becomes a generic 500.
 */
export function corpoErrorResponse(err: unknown, context = 'corpo'): Response {
	if (err instanceof CorpoHttpError) {
		if (err.status >= 500) console.error(`[${context}] ${err.status} ${err.code}: ${err.message}`);
		return corpoJson(err.status, { error: err.message, code: err.code });
	}
	const e = err as { name?: string; message?: string } | null;
	if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
		return corpoJson(504, { error: 'Upstream call timed out', code: 'timeout' });
	}
	console.error(`[${context}] unhandled:`, err);
	return corpoJson(500, { error: 'Internal server error', code: 'server_error' });
}
