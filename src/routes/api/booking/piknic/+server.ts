// src/routes/api/booking/piknic/+server.ts

import type { RequestHandler } from './$types';
import { chromium, type Browser, type Page } from 'playwright';
import { supabase } from '$lib/supabase'; // Import Supabase client

interface EventData {
	name: string;
	date: string;
	venue: string;
	city: string;
	country: string;
	flyer_image_url: string | null;
	url: string;
	source: string;
	artists: string[];
}

interface ScrapeStats {
	processed: number; // Total events found and processed
	created: number; // Total events created/updated in DB
	errors: number;
}

interface StageData {
	name: string;
	artists: string[];
}

function createStreamEncoder() {
	const encoder = new TextEncoder();
	return {
		encode: (data: any) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
	};
}

function parseDate(dateText: string, year?: string): string | null {
	const months: Record<string, string> = {
		JANUARY: '01',
		FEBRUARY: '02',
		MARCH: '03',
		APRIL: '04',
		MAY: '05',
		JUNE: '06',
		JULY: '07',
		AUGUST: '08',
		SEPTEMBER: '09',
		OCTOBER: '10',
		NOVEMBER: '11',
		DECEMBER: '12',
		JAN: '01',
		FEB: '02',
		MAR: '03',
		APR: '04',
		JUN: '06',
		JUL: '07',
		AUG: '08',
		SEP: '09',
		OCT: '10',
		NOV: '11',
		DEC: '12',
		JANVIER: '01',
		FÉVRIER: '02',
		MARS: '03',
		AVRIL: '04',
		MAI: '05',
		JUIN: '06',
		JUILLET: '07',
		AOÛT: '08',
		SEPTEMBRE: '09',
		OCTOBRE: '10',
		NOVEMBRE: '11',
		DÉCEMBRE: '12'
	};

	const patterns = [
		/(\w+)\s+(\d+),?\s+(\d{4})/i,
		/(\d+)\s+(\w+),?\s+(\d{4})/i,
		/(\d+)[\/-](\d+)[\/-](\d{4})/,
		/(\d{4})[-\/](\d+)[-\/](\d+)/,
		/(\d+)\s+(\w+)/i
	];

	for (const pattern of patterns) {
		const match = dateText.match(pattern);
		if (!match) continue;

		if (pattern.source.includes('\\w+')) {
			const [, first, second, third] = match;

			if (third && months[first.toUpperCase()]) {
				return `${third}-${months[first.toUpperCase()]}-${second.padStart(2, '0')}`;
			} else if (third && months[second.toUpperCase()]) {
				return `${third}-${months[second.toUpperCase()]}-${first.padStart(2, '0')}`;
			}

			if (!third && year && months[second.toUpperCase()]) {
				return `${year}-${months[second.toUpperCase()]}-${first.padStart(2, '0')}`;
			} else if (!third && year && months[first.toUpperCase()]) {
				return `${year}-${months[first.toUpperCase()]}-${second.padStart(2, '0')}`;
			}
		} else {
			const [, first, second, third] = match;
			if (first.length === 4) {
				return `${first}-${second.padStart(2, '0')}-${third.padStart(2, '0')}`;
			} else {
				return `${third}-${second.padStart(2, '0')}-${first.padStart(2, '0')}`;
			}
		}
	}

	return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Inserts or updates artists and a SINGLE event row in the database.
 * The event row contains an array of artist IDs.
 *
 * REQUIRES 'booking_event' table to have an 'artist_ids' (uuid[]) column
 * and NOT an 'artist_id' (uuid) column.
 */
async function upsertEventData(
	eventData: EventData,
	stats: ScrapeStats,
	writableStream: WritableStreamDefaultWriter,
	encoder: ReturnType<typeof createStreamEncoder>
) {
	const artistIds: string[] = [];

	// 1. Upsert all artists and collect their IDs
	for (const artistName of eventData.artists) {
		try {
			const { data: artistData, error: artistError } = await supabase
				.from('booking_artist')
				.upsert(
					{
						name: artistName,
						last_seen: new Date().toISOString()
					},
					{
						onConflict: 'name'
					}
				)
				.select('id')
				.single();

			if (artistError || !artistData) {
				throw new Error(artistError?.message || 'No data returned from artist upsert');
			}
			artistIds.push(artistData.id);
		} catch (error: any) {
			console.error(`✗ Error upserting artist ${artistName}:`, error.message);
			stats.errors++;
			// Continue to next artist even if one fails
		}
	}

	// 2. Upsert the SINGLE event with the array of artist IDs
	try {
		const { error: eventError } = await supabase.from('booking_event').upsert(
			{
				name: eventData.name,
				date: eventData.date,
				venue: eventData.venue,
				city: eventData.city,
				country: eventData.country, // Country is already "Canada" from scraper
				flyer_image_url: eventData.flyer_image_url,
				url: eventData.url,
				source: eventData.source,
				artist_ids: artistIds // The new array column
			},
			{
				onConflict: 'url' // Use 'url' as the unique identifier for an event
			}
		);

		if (eventError) {
			throw eventError;
		}

		stats.created++; // Log 1 event created/updated
		const logMessage = `✓ DB: ${eventData.name} -> 1 event row logged with ${artistIds.length} artists.`;
		await writableStream.write(
			encoder.encode({
				type: 'log',
				message: logMessage
			})
		);
		console.log(logMessage);
	} catch (error: any) {
		console.error(`✗ Error upserting event ${eventData.url}:`, error.message);
		stats.errors++;
	}
}

async function extractStagesAndArtists(page: Page): Promise<StageData[]> {
	const stages: StageData[] = [];

	try {
		const stageArticles = await page.locator('article.svelte-v45xu1').all();

		for (const article of stageArticles) {
			try {
				const stageName = await article.locator('h3').textContent();
				if (!stageName) continue;

				const cleanedStageName = stageName.trim();
				const showCards = await article.locator('div._show-card').all();
				const artists: string[] = [];

				for (const card of showCards) {
					try {
						const artistName = await card.locator('a._show-card-artist span').textContent();
						if (artistName) {
							const cleaned = artistName
								.trim()
								.replace(/\s*\(.*?\)\s*$/g, '')
								.trim();
							if (cleaned && !artists.includes(cleaned)) {
								artists.push(cleaned);
							}
						}
					} catch (e) {
						continue;
					}
				}

				if (artists.length > 0) {
					stages.push({
						name: cleanedStageName,
						artists: artists
					});
				}
			} catch (e) {
				continue;
			}
		}
	} catch (e) {
		console.log('Stage extraction error:', e);
	}

	return stages;
}

function detectHeadliners(stages: StageData[]): string[] {
	const headliners: string[] = [];

	for (const stage of stages) {
		if (stage.artists.length === 0) continue;
		const headliner = stage.artists[0];
		if (!headliners.includes(headliner)) {
			headliners.push(headliner);
		}
	}

	return headliners;
}

async function scrapeEventPage(
	page: Page,
	url: string,
	eventType: 'piknic' | 'off-piknic'
): Promise<EventData> {
	await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

	await Promise.race([
		page.waitForSelector('div._show-card', { timeout: 2000 }),
		page.waitForTimeout(800)
	]);

	let eventDate: string | null = null;

	// --- NEW DATE LOGIC ---

	// Priority 1: Try to get the machine-readable <time> tag's datetime attribute.
	// This is the most reliable source. e.g., <time datetime="2025-10-17T...">
	try {
		const timeEl = await page.locator('time[datetime]').first();
		const datetime = await timeEl.getAttribute('datetime', { timeout: 1000 });
		if (datetime) {
			// The attribute is "2025-10-17T21:00:00+00:00"
			eventDate = datetime.split('T')[0]; // This gives "2025-10-17"
		}
	} catch (e) {
		console.log('Priority 1 date analysis (time[datetime]) failed, trying H1...');
	}

	// Priority 2: Fallback to parsing the H1 tag text.
	// e.g., "PIKNIC - ARTIST | 17 OCTOBRE"
	if (!eventDate) {
		try {
			const h1 = await page.locator('h1').first().textContent({ timeout: 1000 });
			if (h1) {
				eventDate = parseDate(h1);
			}
		} catch (e) {
			console.log('Priority 2 date analysis (H1) failed, trying URL...');
		}
	}

	// Priority 3: Final fallback to parsing the URL.
	// This is the least reliable and caused the "17-11-2025" error.
	if (!eventDate) {
		const urlMatch = url.match(/(\d{2})-(\d{2})-(\d{4})/);
		if (urlMatch) {
			// URL format is DD-MM-YYYY
			eventDate = `${urlMatch[3]}-${urlMatch[2]}-${urlMatch[1]}`;
			console.log(`Date from page failed, fell back to URL parse: ${eventDate}`);
		}
	}
	// --- END OF DATE LOGIC ---

	if (!eventDate) {
		// If all methods fail, we cannot proceed.
		throw new Error(`Date not found on page or in URL: ${url}`);
	}

	let flyerImage: string | null = null;
	try {
		const firstArtistImg = await page.locator('a._show-card-artist img').first().getAttribute('src');
		if (firstArtistImg) {
			flyerImage = firstArtistImg.startsWith('http')
				? firstArtistImg
				: `https://cms.piknicelectronik.com${firstArtistImg}`;
		}
	} catch (e) {
		console.log('Image extraction error:', e);
	}

	const stages = await extractStagesAndArtists(page);
	const allArtists: string[] = [];
	for (const stage of stages) {
		allArtists.push(...stage.artists);
	}

	const headliners = detectHeadliners(stages);
	const headlinerText = headliners.length > 0 ? headliners.join(' & ') : 'TBA';
	const eventName =
		eventType === 'piknic' ? `Piknic - ${headlinerText}` : `OfF Piknic - ${headlinerText}`;

	console.log(`\n📊 Stage Breakdown:`);
	for (const stage of stages) {
		console.log(`   ${stage.name}: ${stage.artists.join(', ')}`);
	}
	console.log(`🎤 Headliners: ${headliners.join(' & ')}\n`);

	return {
		name: eventName,
		date: eventDate, // This will now be the correct date
		venue: 'Parc Jean-Drapeau',
		city: 'Montreal',
		country: 'Canada',
		flyer_image_url: flyerImage,
		url: url,
		source: 'Piknic Electronik',
		artists: allArtists
	};
}

async function scrapeCurrentSeason(
	browser: Browser,
	writableStream: WritableStreamDefaultWriter,
	encoder: ReturnType<typeof createStreamEncoder>,
	stats: ScrapeStats,
	isPiknic: boolean
) {
	const page = await browser.newPage();

	const url = isPiknic
		? 'https://piknicelectronik.com/en/events?group=755919'
		: 'https://piknicelectronik.com/en/off-piknic-events';

	const eventType = isPiknic ? 'piknic' : 'off-piknic';
	const label = isPiknic ? 'Piknic 2025' : 'OfF Piknic 2025';

	// Updated progress bar values
	const progressStart = isPiknic ? 10 : 50;
	const progressFiltering = isPiknic ? 15 : 55;
	const progressWeight = isPiknic ? 35 : 45; // (50-15) for Piknic, (100-55) for OfF

	try {
		await writableStream.write(
			encoder.encode({
				type: 'progress',
				stage: 'fetching',
				current: progressStart,
				total: 100,
				message: `Fetching ${label}...`
			})
		);

		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

		await Promise.race([
			page.waitForSelector('a[href*="/event/"]', { timeout: 3000 }),
			page.waitForTimeout(1500)
		]);

		const eventUrls = new Set<string>();

		console.log('🔍 Scanning for event links...');

		const allLinks = await page.locator('a[href*="/event/"], a[href*="/evenement/"]').all();
		for (const link of allLinks) {
			const href = await link.getAttribute('href');
			if (href && (href.includes('/event/') || href.includes('/evenement/'))) {
				const fullUrl = href.startsWith('http') ? href : `https://piknicelectronik.com${href}`;
				eventUrls.add(fullUrl);
			}
		}

		console.log(`✓ Found ${eventUrls.size} events initially`);

		const months = [
			'JANUARY',
			'JAN',
			'MAY',
			'JUNE',
			'JULY',
			'AUGUST',
			'SEPTEMBER',
			'OCTOBER',
			'NOVEMBER',
			'JUN',
			'JUL',
			'AUG',
			'SEP',
			'OCT',
			'NOV'
		];

		for (const month of months) {
			try {
				const tabSelectors = [
					`button:has-text("${month}")`,
					`a:has-text("${month}")`,
					`[role="tab"]:has-text("${month}")`,
					`text=${month}`
				];

				for (const selector of tabSelectors) {
					try {
						const tab = page.locator(selector).first();
						const isVisible = await tab.isVisible({ timeout: 400 }).catch(() => false);

						if (isVisible) {
							await tab.click({ timeout: 800 });
							await page.waitForTimeout(600);
							console.log(`✓ Clicked ${month} tab`);

							const newLinks = await page
								.locator('a[href*="/event/"], a[href*="/evenement/"]')
								.all();
							for (const link of newLinks) {
								const href = await link.getAttribute('href');
								if (href) {
									const fullUrl = href.startsWith('http')
										? href
										: `https://piknicelectronik.com${href}`;
									eventUrls.add(fullUrl);
								}
							}
							break;
						}
					} catch (e) {
						continue;
					}
				}
			} catch (e) {
				// Tab not found
			}
		}

		console.log(`\n${'='.repeat(70)}`);
		console.log(`📅 ${label} - Found ${eventUrls.size} events total`);
		console.log(`${'='.repeat(70)}\n`);

		await writableStream.write(
			encoder.encode({
				type: 'progress',
				stage: 'filtering',
				current: progressFiltering,
				total: 100,
				message: `Found ${eventUrls.size} events in ${label}`
			})
		);

		// PARALLEL PROCESSING - Process 10 pages at once
		const BATCH_SIZE = 10;
		const urlArray = Array.from(eventUrls);
		const pages = await Promise.all(
			Array(BATCH_SIZE)
				.fill(null)
				.map(() => browser.newPage())
		);

		try {
			let current = 0;

			for (let i = 0; i < urlArray.length; i += BATCH_SIZE) {
				const batch = urlArray.slice(i, i + BATCH_SIZE);

				const results = await Promise.allSettled(
					batch.map((eventUrl, batchIndex) => {
						const pageIndex = batchIndex % BATCH_SIZE;
						return scrapeEventPage(pages[pageIndex], eventUrl, eventType);
					})
				);

				for (let j = 0; j < results.length; j++) {
					const result = results[j];
					stats.processed++;
					current++;

					const progress =
						progressFiltering + Math.round((current / eventUrls.size) * progressWeight);

					await writableStream.write(
						encoder.encode({
							type: 'progress',
							stage: 'inserting',
							current: progress,
							total: 100,
							message: `Processing ${label} event ${current}/${eventUrls.size}...`
						})
					);

					if (result.status === 'fulfilled') {
						const eventData = result.value;

						console.log('\n' + '─'.repeat(70));
						console.log('📋 EVENT DATA:');
						console.log('─'.repeat(70));
						console.log(JSON.stringify(eventData, null, 2));
						console.log(
							`\n🎵 Artists (${eventData.artists.length}): ${eventData.artists.join(', ')}`
						);
						console.log('─'.repeat(70) + '\n');

						// Call the upsert function to handle DB logic
						await upsertEventData(eventData, stats, writableStream, encoder);
					} else {
						stats.errors++;
						console.error(`\n✗ ERROR processing ${batch[j]}:`, result.reason);
					}
				}

				await sleep(200); // Small delay between batches
			}
		} finally {
			await Promise.all(pages.map((p) => p.close()));
		}
	} finally {
		await page.close();
	}
}

async function scrapePiknicEvents(
	writableStream: WritableStreamDefaultWriter,
	encoder: ReturnType<typeof createStreamEncoder>
) {
	const browser = await chromium.launch({
		headless: true,
		args: ['--no-sandbox', '--disable-setuid-sandbox']
	});

	const stats: ScrapeStats = { processed: 0, created: 0, errors: 0 };

	try {
		await writableStream.write(
			encoder.encode({
				type: 'progress',
				stage: 'fetching',
				current: 0,
				total: 100,
				message: 'Starting browser...'
			})
		);

		console.log('\n' + '═'.repeat(70));
		console.log('🚀 PIKNIC ELECTRONIK SCRAPER STARTED');
		console.log('═'.repeat(70) + '\n');

		// Scrape current Piknic season
		await scrapeCurrentSeason(browser, writableStream, encoder, stats, true);
		// Scrape current OfF Piknic season
		await scrapeCurrentSeason(browser, writableStream, encoder, stats, false);

		console.log('\n' + '═'.repeat(70));
		console.log('✅ SCRAPING COMPLETE');
		console.log('═'.repeat(70));
		console.log(`📊 Processed Events: ${stats.processed}`);
		console.log(`✓ Events Logged: ${stats.created}`);
		console.log(`✗ Errors: ${stats.errors}`);
		console.log('═'.repeat(70) + '\n');

		await writableStream.write(
			encoder.encode({
				type: 'complete',
				message: `✓ Complete! Processed: ${stats.processed}, Logged: ${stats.created}, Errors: ${stats.errors}`,
				data: stats
			})
		);
	} finally {
		await browser.close();
	}
}

export const POST: RequestHandler = async () => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = createStreamEncoder();
			const writer = {
				write: (chunk: Uint8Array) => controller.enqueue(chunk)
			};

			try {
				await scrapePiknicEvents(writer as any, encoder);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				controller.enqueue(
					encoder.encode({
						type: 'error',
						message: errorMessage
					})
				);
				console.error('❌ Scraping error:', error);
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
