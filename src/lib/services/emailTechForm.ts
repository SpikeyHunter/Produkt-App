// src/lib/services/emailTechForm.ts
//
// The editor's working copy of the tech form and the diff that turns edits
// into a column patch. Kept out of the page so it can be tested on its own.
//
// The working copy must never share objects with the live record: sections
// edit arrays in place (crew_calls[i].time = …), and a shared reference would
// make the record change together with the form, so the diff would see
// "nothing changed" and nothing would be saved.

import type { TechEmailForm } from '$lib/types/emailtech';
import type { EmailTechRecord } from './emailTechSync';
import { defaultTechForm } from './techTemplateService';
import { stableStringify } from './emailTechSync';

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

/** Saved form + defaults for any field added since it was saved — a deep copy. */
export function formFromRecord(rec: EmailTechRecord | null): TechEmailForm {
	const base: TechEmailForm = clone(defaultTechForm);
	const saved = rec?.email_data?.tech_form_data;
	if (!saved) {
		return { ...base, visible_sections: { ...base.visible_sections, team_notes: false } };
	}
	const s: any = clone(saved);
	return {
		...base,
		...s,
		visible_sections: { ...base.visible_sections, ...(s.visible_sections || {}) },
		set_times: Array.isArray(s.set_times) ? s.set_times : [],
		crew_calls: Array.isArray(s.crew_calls) && s.crew_calls.length ? s.crew_calls : base.crew_calls,
		backline: Array.isArray(s.backline) ? s.backline : []
	};
}

/** Keys of `form` whose value differs from `saved` (object key order never counts). */
export function formPatch(form: TechEmailForm, saved: Partial<TechEmailForm> | undefined | null): Partial<TechEmailForm> {
	const s: any = saved || {};
	const patch: any = {};
	for (const k of Object.keys(form)) {
		if (stableStringify((form as any)[k] ?? null) !== stableStringify(s[k] ?? null)) patch[k] = (form as any)[k];
	}
	return patch;
}

/** True when any nested object/array is shared between the two — a bug guard. */
export function sharesReferences(a: any, b: any, seen = new Set<any>()): boolean {
	if (!b || typeof b !== 'object') return false;
	const collect = (v: any) => {
		if (v && typeof v === 'object' && !seen.has(v)) {
			seen.add(v);
			Object.values(v).forEach(collect);
		}
	};
	collect(b);
	const walk = (v: any): boolean =>
		!!v && typeof v === 'object' && (seen.has(v) || Object.values(v).some(walk));
	return walk(a);
}
