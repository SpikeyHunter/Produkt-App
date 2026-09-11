// The corpo access rule (Produkt Corpo V2 spec §0 D6) as a pure function, so it can be
// table-tested and shared by every /api/corpo/* route. Mirrors the SQL exactly, including case:
//   role = 'Admin' OR main_permission = 'Corpo' OR 'Corpo' = any(secondary_permission)
//
// Same predicate as produkt-corpo-api backend/src/lib/access.ts (Render service); the only
// addition is tolerance for `secondary_permission` stored as a single string or a
// Postgres-array literal ("{Corpo,Booking}"), which the web app's authStore also allows.

export const ADMIN_ROLE = 'Admin';
export const CORPO_PERMISSION = 'Corpo';

/** The three user_profiles columns the rule reads (all nullable on the wire). */
export interface AccessFields {
	role?: string | null;
	main_permission?: string | null;
	secondary_permission?: readonly string[] | string | null;
}

/** Normalises secondary_permission (array | string | pg array literal | null) to a string[]. */
export function normalizeSecondary(value: AccessFields['secondary_permission']): string[] {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
			return trimmed
				.slice(1, -1)
				.split(',')
				.map((s) => s.trim().replace(/^"|"$/g, ''))
				.filter(Boolean);
		}
		if (trimmed.startsWith('[')) {
			try {
				const parsed = JSON.parse(trimmed);
				return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
			} catch {
				return [];
			}
		}
		return trimmed ? [trimmed] : [];
	}
	return [];
}

export function hasCorpoAccess(profile: AccessFields | null | undefined): boolean {
	if (!profile) return false;
	if (profile.role === ADMIN_ROLE) return true;
	if (profile.main_permission === CORPO_PERMISSION) return true;
	return normalizeSecondary(profile.secondary_permission).includes(CORPO_PERMISSION);
}
