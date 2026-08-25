// offerService.ts
// Storage + naming for generated offer sheets.
// Offers live in the 'documents' bucket under offers/ and are identified as
//   <event_short_id>_<event_date>_<Artist-name>_Offer_<offer number>.pdf

import { supabase } from '$lib/supabase';

const BUCKET = 'documents';
const FOLDER = 'offers';

export interface OfferHistoryEntry {
	n: number; // offer number (1-based, +1 each new generation)
	fileName: string;
	path: string; // path inside the bucket (offers/<fileName>)
	generatedAt: string; // ISO timestamp
	rate?: number; // FX rate stamped at generation
	total?: number; // walkout at sellout in venue currency (for version deltas)
	fingerprint?: string; // hash of the offer inputs, for change detection
}

/** "Tape B" -> "Tape-B"; strips anything not filename-safe. */
export function sanitizeForFileName(name: string): string {
	return (name || 'Unknown')
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-zA-Z0-9\-_.]/g, '');
}

export function buildOfferFileName(
	eventDate: string,
	artistName: string,
	offerNumber: number
): string {
	// "06-Sep-2026_Max-Dean-b2b-Luke-Dean_Offer_1.pdf"
	const datePart = formatOfferDate(eventDate) || 'no-date';
	return `${datePart}_${sanitizeForFileName(artistName)}_Offer_${offerNumber}.pdf`;
}

/** "2026-06-20" / ISO / Date -> "20-Jun-2026" */
export function formatOfferDate(input: string | Date): string {
	// Plain dates parse at noon so UTC->local shifts can't roll the day back.
	const d =
		typeof input === 'string'
			? new Date(input.length === 10 ? `${input}T12:00:00` : input)
			: input;
	if (!d || isNaN(d.getTime())) return '';
	const day = String(d.getDate()).padStart(2, '0');
	const month = d.toLocaleString('en-US', { month: 'short' });
	return `${day}-${month}-${d.getFullYear()}`;
}

export async function uploadOfferPdf(
	fileName: string,
	blob: Blob,
	folder: string = FOLDER
): Promise<string | null> {
	const path = `${folder}/${fileName}`;
	const opts = { upsert: true, contentType: 'application/pdf' } as const;
	let { error } = await supabase.storage.from(BUCKET).upload(path, blob, opts);
	if (error) {
		// Some storage policies allow insert+delete but not update — force the
		// overwrite by removing the old object first, then retrying once.
		await supabase.storage.from(BUCKET).remove([path]);
		({ error } = await supabase.storage.from(BUCKET).upload(path, blob, opts));
	}
	if (error) {
		console.error('❌ [offers] Failed to upload offer PDF:', error);
		return null;
	}
	return path;
}

/** Deletes an offer PDF (used when an overwrite changes the file name). */
export async function removeOfferPdf(path: string): Promise<void> {
	if (!path) return;
	const { error } = await supabase.storage.from(BUCKET).remove([path]);
	if (error) console.error('❌ [offers] Failed to remove old offer PDF:', error);
}

/** Returns a URL the browser can open (signed if the bucket is private). */
export async function getOfferUrl(path: string): Promise<string | null> {
	const { data: signed, error } = await supabase.storage
		.from(BUCKET)
		.createSignedUrl(path, 60 * 60);
	if (!error && signed?.signedUrl) return signed.signedUrl;

	const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
	return pub?.publicUrl || null;
}

/** Shareable pretty link: /offer/<Artist-name>/<n> (works on any host). */
export function offerPrettyUrl(artistName: string, n: number): string {
	return `/offer/${encodeURIComponent(sanitizeForFileName(artistName))}/${n}`;
}

export function openOfferPretty(artistName: string, n: number): void {
	window.open(offerPrettyUrl(artistName, n), '_blank', 'noopener');
}

/** Shareable pretty link: /settlement/<Artist-name>/<Ext|Int>. */
export function settlementPrettyUrl(artistName: string, variant: 'external' | 'internal'): string {
	return `/settlement/${encodeURIComponent(sanitizeForFileName(artistName))}/${variant === 'external' ? 'Ext' : 'Int'}`;
}

export function openSettlementPretty(artistName: string, variant: 'external' | 'internal'): void {
	window.open(settlementPrettyUrl(artistName, variant), '_blank', 'noopener');
}

export async function openOffer(path: string): Promise<boolean> {
	const url = await getOfferUrl(path);
	if (!url) return false;
	window.open(url, '_blank', 'noopener');
	return true;
}
