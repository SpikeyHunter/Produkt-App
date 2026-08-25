// Pretty settlement links: app.produkt.ca/settlement/<Artist-name>/<Ext|Int>
// Looks up the stored PDF in documents/settlements/ (files are named
// "<DD-Mon-YYYY>_<Artist-name>_<Ext|Int>_Settlement.pdf") and streams it back,
// so the shareable link never expires and stays in the address bar.
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabaseAdmin';
import type { RequestHandler } from './$types';

const BUCKET = 'documents';
const FOLDER = 'settlements';

export const GET: RequestHandler = async ({ params }) => {
	const artist = (params.artist || '').toLowerCase();
	const rawVariant = (params.variant || '').toLowerCase();
	const variant = rawVariant.startsWith('ext') ? 'ext' : rawVariant.startsWith('int') ? 'int' : '';
	if (!artist || !variant) throw error(404, 'Settlement not found');

	const { data: files, error: listErr } = await supabaseAdmin.storage
		.from(BUCKET)
		.list(FOLDER, { limit: 1000 });
	if (listErr) throw error(500, 'Storage unavailable');

	// Punctuation-tolerant match: "<anything>_<artist>_<Ext|Int>_Settlement.pdf".
	const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '');
	const want = `${norm(artist)}${variant}settlementpdf`;
	const matches = (files || [])
		.filter((f) => norm(f.name).endsWith(want))
		.sort(
			(a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
		);
	if (matches.length === 0) throw error(404, 'Settlement not found');

	const { data: file, error: dlErr } = await supabaseAdmin.storage
		.from(BUCKET)
		.download(`${FOLDER}/${matches[0].name}`);
	if (dlErr || !file) throw error(500, 'Could not open the settlement');

	return new Response(file, {
		headers: {
			'Content-Type': 'application/pdf',
			'Content-Disposition': `inline; filename="${matches[0].name}"`,
			'Cache-Control': 'private, max-age=60'
		}
	});
};
