import { json, type RequestEvent } from '@sveltejs/kit';
import { google } from 'googleapis';
import { Readable } from 'stream';
import { supabase } from '$lib/supabase.js'; // 👈 Added Supabase to backend proxy
import {
	GOOGLE_P_DRIVE_CLIENT_EMAIL,
	GOOGLE_P_DRIVE_PRIVATE_KEY,
	GOOGLE_DRIVE_CONTRACT_FOLDER_ID // 🔴 The build fails here if this is missing in Vercel
} from '$env/static/private';

/* ────────────────────────────────────────────────────────────────────────────
 * AUTH

 * ──────────────────────────────────────────────────────────────────────────── */
let cachedAuthClient: any = null;
async function getAuthClient() {
	if (cachedAuthClient) return cachedAuthClient;

	let privateKey = GOOGLE_P_DRIVE_PRIVATE_KEY;
	if (privateKey.startsWith('"') && privateKey.endsWith('"')) privateKey = privateKey.slice(1, -1);
	privateKey = privateKey.replace(/\\n/g, '\n');

	cachedAuthClient = new google.auth.JWT({
		email: GOOGLE_P_DRIVE_CLIENT_EMAIL,
		key: privateKey,
		scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/drive.file']
	});
	return cachedAuthClient;
}

function toBody(buf: Buffer): Uint8Array<ArrayBuffer> {
	return new Uint8Array(buf.buffer as ArrayBuffer, buf.byteOffset, buf.byteLength);
}

/* ────────────────────────────────────────────────────────────────────────────
 * IN-MEMORY LRU CACHE
 * ──────────────────────────────────────────────────────────────────────────── */
const MAX_CACHE_ENTRIES = 12;
const MAX_CACHE_BYTES = 200 * 1024 * 1024;
const TTL_MS = 1000 * 60 * 30;

interface CacheEntry {
	buf: Buffer;
	etag: string;
	mtime: number;
	insertedAt: number;
	lastAccess: number;
	size: number;
}
const pdfCache: Map<string, CacheEntry> = new Map();
let cacheBytes = 0;

function evictIfNeeded() {
	const now = Date.now();
	for (const [k, v] of pdfCache) {
		if (now - v.insertedAt > TTL_MS) {
			cacheBytes -= v.size;
			pdfCache.delete(k);
		}
	}
	while (pdfCache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
		let oldestKey: string | null = null;
		let oldest = Infinity;
		for (const [k, v] of pdfCache) {
			if (v.lastAccess < oldest) {
				oldest = v.lastAccess;
				oldestKey = k;
			}
		}
		if (!oldestKey) break;
		const removed = pdfCache.get(oldestKey)!;
		cacheBytes -= removed.size;
		pdfCache.delete(oldestKey);
	}
}

async function getPdfFromCacheOrDrive(drive: any, fileId: string): Promise<CacheEntry> {
	const cached = pdfCache.get(fileId);
	const now = Date.now();
	if (cached && now - cached.insertedAt <= TTL_MS) {
		cached.lastAccess = now;
		return cached;
	}

	const meta = await drive.files.get({
		fileId,
		fields: 'md5Checksum, modifiedTime, size',
		supportsAllDrives: true
	});

	const response = await drive.files.get(
		{ fileId, alt: 'media', supportsAllDrives: true },
		{ responseType: 'arraybuffer' }
	);

	const buf = Buffer.from(response.data as ArrayBuffer);
	const entry: CacheEntry = {
		buf,
		etag: `"${meta.data.md5Checksum || meta.data.modifiedTime || fileId}"`,
		mtime: meta.data.modifiedTime ? Date.parse(meta.data.modifiedTime) : now,
		insertedAt: now,
		lastAccess: now,
		size: buf.byteLength
	};
	pdfCache.set(fileId, entry);
	cacheBytes += entry.size;
	evictIfNeeded();
	return entry;
}

function invalidateCache(fileId: string) {
	const e = pdfCache.get(fileId);
	if (e) {
		cacheBytes -= e.size;
		pdfCache.delete(fileId);
	}
}

function parseRange(
	rangeHeader: string | null,
	totalSize: number
): { start: number; end: number } | null {
	if (!rangeHeader) return null;
	const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
	if (!m) return null;
	let start = m[1] ? parseInt(m[1], 10) : 0;
	let end = m[2] ? parseInt(m[2], 10) : totalSize - 1;
	if (isNaN(start) || isNaN(end) || start < 0 || end >= totalSize || start > end) return null;
	return { start, end };
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET — fast PDF streaming with HTTP range support
 * ──────────────────────────────────────────────────────────────────────────── */
export async function GET({ url, request }: RequestEvent) {
	const fileId = url.searchParams.get('fileId');
	if (!fileId) return new Response('Missing fileId', { status: 400 });

	try {
		const authClient = await getAuthClient();
		const drive = google.drive({ version: 'v3', auth: authClient });

		const entry = await getPdfFromCacheOrDrive(drive, fileId);
		const total = entry.size;

		const ifNoneMatch = request.headers.get('if-none-match');
		if (ifNoneMatch && ifNoneMatch === entry.etag) {
			return new Response(null, {
				status: 304,
				headers: {
					ETag: entry.etag,
					'Cache-Control': 'private, max-age=300, must-revalidate'
				}
			});
		}

		const range = parseRange(request.headers.get('range'), total);

		const baseHeaders: Record<string, string> = {
			'Content-Type': 'application/pdf',
			'Accept-Ranges': 'bytes',
			ETag: entry.etag,
			'Cache-Control': 'private, max-age=300, must-revalidate',
			'Last-Modified': new Date(entry.mtime).toUTCString(),
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges, ETag'
		};

		if (range) {
			const chunk = entry.buf.subarray(range.start, range.end + 1);
			return new Response(toBody(chunk), {
				status: 206,
				headers: {
					...baseHeaders,
					'Content-Range': `bytes ${range.start}-${range.end}/${total}`,
					'Content-Length': String(chunk.byteLength)
				}
			});
		}

		return new Response(toBody(entry.buf), {
			status: 200,
			headers: {
				...baseHeaders,
				'Content-Length': String(total)
			}
		});
	} catch (err: any) {
		console.error('GET /api/gdrive error:', err);
		return new Response('Failed to fetch PDF', { status: err.status || err.code || 500 });
	}
}

export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Range, Content-Type, If-None-Match',
			'Access-Control-Max-Age': '86400'
		}
	});
}

/* ────────────────────────────────────────────────────────────────────────────
 * POST — actions
 * ──────────────────────────────────────────────────────────────────────────── */
export async function POST({ request }: RequestEvent) {
	try {
		const {
			eventDate,
			artistName,
			venueName,
			action,
			folderId,
			fileId,
			fileData,
			fileName,
			mimeType,
			advanceId, // 👈 New payload passed from MacOS App & Web App
		} = await request.json();

		const authClient = await getAuthClient();
		const drive = google.drive({ version: 'v3', auth: authClient });

		// ── DOWNLOAD ───────────────────────────────────────────────────────────
		if (action === 'download' && fileId) {
			try {
				const entry = await getPdfFromCacheOrDrive(drive, fileId);
				return new Response(toBody(entry.buf), {
					headers: {
						'Content-Type': 'application/pdf',
						'Content-Disposition': `inline; filename="contract.pdf"`,
						'Content-Length': String(entry.size),
						'Cache-Control': 'private, max-age=300',
						ETag: entry.etag,
						'Access-Control-Allow-Origin': '*'
					}
				});
			} catch (downloadErr: any) {
				return json({ error: 'Failed to fetch PDF from Drive' }, { status: 500 });
			}
		}

		// ── DELETE ─────────────────────────────────────────────────────────────
		if (action === 'delete') {
			const idToDelete = fileId || folderId;
			if (!idToDelete) return json({ error: 'No ID provided for deletion' }, { status: 400 });

			try {
				await drive.files.update({
					fileId: idToDelete,
					requestBody: { trashed: true },
					supportsAllDrives: true
				});
				if (fileId) invalidateCache(fileId);
			} catch (deleteErr: any) {
				if (deleteErr.code !== 404 && deleteErr.status !== 404) throw deleteErr;
			}
			return json({ success: true });
		}

		// ── UPLOAD ─────────────────────────────────────────────────────────────
		if (action === 'upload' && folderId && fileData) {
			const buffer = Buffer.from(fileData, 'base64');
			const stream = new Readable();
			stream.push(buffer);
			stream.push(null);

			const file = await drive.files.create({
				requestBody: { name: fileName, parents: [folderId] },
				media: { mimeType: mimeType || 'application/pdf', body: stream },
				fields: 'id, webViewLink',
				supportsAllDrives: true
			});

			try {
				await drive.permissions.create({
					fileId: file.data.id!,
					requestBody: { role: 'reader', type: 'anyone' },
					supportsAllDrives: true
				});
			} catch (permErr) {}

			if (file.data.id) {
				try {
					await getPdfFromCacheOrDrive(drive, file.data.id);
				} catch (_) {}
			}

			return json({ success: true, fileId: file.data.id, fileUrl: file.data.webViewLink });
		}

		// ── UPDATE FILE (OVERWRITE EXISTING) ──────────────────────────────────
		if (action === 'update_file' && fileId && fileData) {
			const buffer = Buffer.from(fileData, 'base64');
			const stream = new Readable();
			stream.push(buffer);
			stream.push(null);

			await drive.files.update({
				fileId: fileId,
				media: { mimeType: mimeType || 'application/pdf', body: stream },
				supportsAllDrives: true
			});
			invalidateCache(fileId);
			return json({ success: true });
		}

		// ── RENAME FOLDER ──────────────────────────────────────────────────────
		if (action === 'rename' && folderId) {
			let dateObj = new Date();
			if (eventDate && !isNaN(new Date(eventDate).getTime())) dateObj = new Date(eventDate);
			const fullDateParts = dateObj.toISOString().split('T');
			const monthDay = fullDateParts[0].substring(5);

			let venueFormatted = venueName === 'New City Gas' ? 'NCG' : venueName || 'TBA';
			const safeArtistName = artistName || 'Unknown_Artist';
			const newFolderName = `${monthDay}_${venueFormatted}_${safeArtistName}`;

			await drive.files.update({
				fileId: folderId,
				requestBody: { name: newFolderName },
				supportsAllDrives: true
			});
			return json({ success: true, folderName: newFolderName });
		}

		// ── CREATE FOLDER ──────────────────────────────────────────────────────
		if (action === 'create') {
			// 1. SUPABASE PRE-CHECK (Prevents duplicate API calls if it already exists)
			if (advanceId) {
				const { data: existingContract } = await supabase
					.from('events_contract')
					.select('gdrive_folder_id, gdrive_folder_url')
					.eq('advance_id', advanceId)
					.single();

				if (existingContract?.gdrive_folder_id && existingContract?.gdrive_folder_url) {
					return json({
						success: true,
						folderId: existingContract.gdrive_folder_id,
						folderUrl: existingContract.gdrive_folder_url
					});
				}
			}

			// Generate folder name
			let dateObj = new Date();
			if (eventDate && !isNaN(new Date(eventDate).getTime())) dateObj = new Date(eventDate);
			const year = dateObj.getFullYear().toString();
			const fullDateParts = dateObj.toISOString().split('T');
			const monthDay = fullDateParts[0].substring(5);

			let venueFormatted = venueName === 'New City Gas' ? 'NCG' : venueName || 'TBA';
			const safeArtistName = artistName || 'Unknown_Artist';
			const folderName = `${monthDay}_${venueFormatted}_${safeArtistName}`;
			const escapedFolderName = folderName.replace(/'/g, "\\'"); // Escapes quotes for the query
			
			const rootFolderId = GOOGLE_DRIVE_CONTRACT_FOLDER_ID;
			let yearFolderId = '';
			
			// Resolve Year Folder
			const yearSearch = await drive.files.list({
				q: `'${rootFolderId}' in parents and name='${year}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
				fields: 'files(id, name)',
				includeItemsFromAllDrives: true,
				supportsAllDrives: true,
				corpora: 'allDrives'
			});

			if (yearSearch.data.files && yearSearch.data.files.length > 0) {
				yearFolderId = yearSearch.data.files[0].id!;
			} else {
				const yearFolder = await drive.files.create({
					requestBody: {
						name: year,
						mimeType: 'application/vnd.google-apps.folder',
						parents: [rootFolderId]
					},
					fields: 'id',
					supportsAllDrives: true
				});
				yearFolderId = yearFolder.data.id!;
			}

			// 2. GOOGLE DRIVE PRE-CHECK (Prevents Drive from creating duplicates with the exact same name)
			const folderSearch = await drive.files.list({
				q: `'${yearFolderId}' in parents and name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
				fields: 'files(id, webViewLink)',
				includeItemsFromAllDrives: true,
				supportsAllDrives: true,
				corpora: 'allDrives'
			});

			// If Google Drive already has this folder, just return the existing one!
			if (folderSearch.data.files && folderSearch.data.files.length > 0) {
				return json({
					success: true,
					folderId: folderSearch.data.files[0].id,
					folderUrl: folderSearch.data.files[0].webViewLink
				});
			}

			// 3. CREATE FOLDER
			const eventFolder = await drive.files.create({
				requestBody: {
					name: folderName,
					mimeType: 'application/vnd.google-apps.folder',
					parents: [yearFolderId]
				},
				fields: 'id, webViewLink',
				supportsAllDrives: true
			});

			return json({
				success: true,
				folderId: eventFolder.data.id,
				folderUrl: eventFolder.data.webViewLink
			});
		}

		return json({ error: 'Invalid action' }, { status: 400 });
	} catch (error: any) {
		console.error('Drive API Error Details:', error);
		return json(
			{ error: error.message || 'Unknown Drive API Error' },
			{ status: error.status || error.code || 500 }
		);
	}
}