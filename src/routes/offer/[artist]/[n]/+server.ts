// Pretty offer links: app.produkt.ca/offer/<Artist-name>/<offer number>
// Looks up the stored PDF in documents/offers/ (files are named
// "<DD-Mon-YYYY>_<Artist-name>_Offer_<n>.pdf") and streams it back, so the
// shareable pretty link never expires and stays in the address bar.
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';

const BUCKET = 'documents';
const FOLDER = 'offers';

/**
 * Name the browser saves under. The app passes the full one (with the event
 * name) as ?name=; a bare shared link falls back to what the stored file name
 * carries: "Produkt Offer - <Artist> - <YYYYMMDD> - V<n>.pdf".
 */
function downloadNameFor(requested: string | null, storedName: string, n: number): string {
	const clean = (x: string) => x.replace(/[\r\n"\\/]/g, '').trim().slice(0, 180);
	if (requested && clean(requested)) return clean(requested);

	const m = storedName.match(/^(\d{2})-([A-Za-z]{3})-(\d{4})_(.+?)_Offer_\d+\.pdf$/i);
	if (!m) return storedName;
	const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
	const mi = months.indexOf(m[2].toLowerCase());
	const ymd = mi >= 0 ? `${m[3]}${String(mi + 1).padStart(2, '0')}${m[1]}` : 'no-date';
	return `Produkt Offer - ${m[4].replace(/-/g, ' ')} - ${ymd} - V${n}.pdf`;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const artist = (params.artist || '').toLowerCase();
	const n = parseInt(params.n || '', 10);
	if (!artist || !Number.isFinite(n) || n < 1) throw error(404, 'Offer not found');

	const { data: files, error: listErr } = await supabaseAdmin.storage
		.from(BUCKET)
		.list(FOLDER, { limit: 1000 });
	if (listErr) throw error(500, 'Storage unavailable');

	// Match "<anything>_<artist>_Offer_<n>.pdf" — punctuation-tolerant, so
	// "BUNT." still matches even when a host normalizes trailing dots away.
	const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
	const want = `${norm(artist)}offer${n}pdf`;
	const matches = (files || [])
		.filter((f) => norm(f.name).endsWith(want))
		.sort(
			(a, b) =>
				new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
		);
	if (matches.length === 0) throw error(404, 'Offer not found');

	// Stream the PDF (instead of redirecting to a signed storage URL) so the
	// address bar keeps the pretty /offer/... link.
	const { data: file, error: dlErr } = await supabaseAdmin.storage
		.from(BUCKET)
		.download(`${FOLDER}/${matches[0].name}`);
	if (dlErr || !file) throw error(500, 'Could not open the offer');

	const fileName = downloadNameFor(url.searchParams.get('name'), matches[0].name, n);
	// ?dl=1 saves instead of opening the viewer (the dropdown's download button).
	const disposition = url.searchParams.get('dl') === '1' ? 'attachment' : 'inline';

	return new Response(file, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition':
				`${disposition}; filename="${fileName.replace(/[^\x20-\x7e]/g, '_')}"; ` +
				`filename*=UTF-8''${encodeURIComponent(fileName)}`,
			'Cache-Control': 'private, max-age=60'
		}
	});
};
