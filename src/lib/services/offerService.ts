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
/**
 * The name a browser saves the PDF under:
 *   "Produkt Offer - KREAM (KREAM Liquid:Lab 2027) - 20270501 - V1.pdf"
 * Only characters a filesystem refuses are swapped out.
 */
export function buildOfferDownloadName(
	artistName: string,
	eventName: string,
	eventDate: string,
	n: number
): string {
	const clean = (x: string) =>
		(x || '')
			.replace(/[\/\\:*?"<>|\r\n]/g, '-')
			.replace(/\s+/g, ' ')
			.trim();
	const artist = clean(artistName) || 'Artist';
	const ev = clean(eventName);
	const ymd = /^\d{4}-\d{2}-\d{2}/.test(eventDate || '')
		? eventDate.slice(0, 10).replace(/-/g, '')
		: 'no-date';
	return `Produkt Offer - ${artist}${ev && ev !== artist ? ` (${ev})` : ''} - ${ymd} - V${n}.pdf`;
}

export type OfferLinkOptions = {
	/** name the browser's Save / Download uses */
	fileName?: string;
	/** true = served as an attachment, so the browser saves instead of viewing */
	download?: boolean;
};

export function offerPrettyUrl(artistName: string, n: number, opts: OfferLinkOptions = {}): string {
	const base = `/offer/${encodeURIComponent(sanitizeForFileName(artistName))}/${n}`;
	const q = new URLSearchParams();
	if (opts.fileName) q.set('name', opts.fileName);
	if (opts.download) q.set('dl', '1');
	const qs = q.toString();
	return qs ? `${base}?${qs}` : base;
}

export function openOfferPretty(artistName: string, n: number, opts: OfferLinkOptions = {}): void {
	window.open(offerPrettyUrl(artistName, n, opts), '_blank', 'noopener');
}

/**
 * Save the PDF, asking where and under what name first.
 *
 * Chrome / Edge / Electron expose a native "Save as" dialog (File System
 * Access API) with the file name pre-filled. Safari and Firefox don't have
 * one a page can open, so there the file goes through a normal download —
 * whether the browser asks for a location is its own download setting
 * (Safari › Settings › General › File download location › Ask for each download).
 */
export async function downloadOfferPretty(
	artistName: string,
	n: number,
	fileName: string
): Promise<void> {
	const url = offerPrettyUrl(artistName, n, { fileName, download: true });

	const picker = (window as any).showSaveFilePicker;
	if (typeof picker === 'function') {
		let handle: any;
		try {
			// Must be the first await: the dialog only opens inside the click.
			handle = await picker({
				suggestedName: fileName,
				types: [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }]
			});
		} catch (err: any) {
			if (err?.name === 'AbortError') return; // user cancelled — nothing to do
			handle = null; // picker unavailable here (sandboxed frame etc.) — fall back
		}
		if (handle) {
			try {
				const res = await fetch(url);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const writable = await handle.createWritable();
				await writable.write(await res.blob());
				await writable.close();
				return;
			} catch (err) {
				console.error('[offer] save-as failed, falling back to a plain download', err);
			}
		}
	}

	// Plain download — a real anchor click, which Safari honours.
	const a = document.createElement('a');
	a.href = url;
	a.download = fileName;
	document.body.appendChild(a);
	try {
		a.click();
	} finally {
		a.remove();
	}
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
