// Pretty offer links: app.produkt.ca/offer/<Artist-name>/<offer number>
// Looks up the stored PDF in documents/offers/ (files are named
// "<DD-Mon-YYYY>_<Artist-name>_Offer_<n>.pdf") and streams it back, so the
// shareable pretty link never expires and stays in the address bar.
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';

const BUCKET = 'documents';
const FOLDER = 'offers';

export const GET: RequestHandler = async ({ params }) => {
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

	return new Response(file, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${matches[0].name}"`,
			'Cache-Control': 'private, max-age=60'
		}
	});
};
