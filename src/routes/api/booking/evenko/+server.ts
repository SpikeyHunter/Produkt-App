// src/routes/api/booking/evenko/+server.ts

import type { RequestHandler } from './$types';
import { chromium, type Browser, type Page } from 'playwright';
import { supabase } from '$lib/supabase'; // Import Supabase client

// --- INTERFACES (similar to your Piknic scraper) ---

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
	processed: number;
	created: number;
	errors: number;
}

// --- UTILITY FUNCTIONS (reused from your Piknic scraper) ---

function createStreamEncoder() {
	const encoder = new TextEncoder();
	return {
		encode: (data: any) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
	};
}

function parseDate(dateText: string): string | null {
	const months: Record<string, string> = {
		JANUARY: '01', FEBRUARY: '02', MARCH: '03', APRIL: '04', MAY: '05', JUNE: '06',
		JULY: '07', AUGUST: '08', SEPTEMBER: '09', OCTOBER: '10', NOVEMBER: '11', DECEMBER: '12'
	};
    // Match format "Month Day, Year" e.g. "October 18, 2025"
	const pattern = /(\w+)\s+(\d{1,2}),?\s+(\d{4})/i;
	const match = dateText.match(pattern);

	if (match) {
		const [, month, day, year] = match;
		const monthStr = months[month.toUpperCase()];
		if (monthStr) {
			return `${year}-${monthStr}-${day.padStart(2, '0')}`;
		}
	}
	return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


async function upsertEventData(
	eventData: EventData,
	stats: ScrapeStats,
	writableStream: WritableStreamDefaultWriter,
	encoder: ReturnType<typeof createStreamEncoder>
) {
	const artistIds: string[] = [];

	for (const artistName of eventData.artists) {
		try {
			const { data: artistData, error: artistError } = await supabase
				.from('booking_artist')
				.upsert({ name: artistName, last_seen: new Date().toISOString() }, { onConflict: 'name' })
				.select('id')
				.single();

			if (artistError || !artistData) throw new Error(artistError?.message || 'No data from artist upsert');
			artistIds.push(artistData.id);
		} catch (error: any) {
			console.error(`✗ Error upserting artist ${artistName}:`, error.message);
			stats.errors++;
		}
	}

	try {
		const { error: eventError } = await supabase.from('booking_event').upsert(
			{
				name: eventData.name,
				date: eventData.date,
				venue: eventData.venue,
				city: eventData.city,
				country: eventData.country,
				flyer_image_url: eventData.flyer_image_url,
				url: eventData.url,
				source: eventData.source,
				artist_ids: artistIds
			},
			{ onConflict: 'url' }
		);

		if (eventError) throw eventError;

		stats.created++;
		const logMessage = `✓ DB: ${eventData.name} -> 1 event logged with ${artistIds.length} artists.`;
		await writableStream.write(encoder.encode({ type: 'log', message: logMessage }));
		console.log(logMessage);
	} catch (error: any) {
		console.error(`✗ Error upserting event ${eventData.url}:`, error.message);
		stats.errors++;
	}
}


// --- CORE SCRAPING LOGIC ---

async function scrapeEvenkoEvents(
	writableStream: WritableStreamDefaultWriter,
	encoder: ReturnType<typeof createStreamEncoder>
) {
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	const stats: ScrapeStats = { processed: 0, created: 0, errors: 0 };
    const targetUrl = 'https://evenko.ca/en/events/music?type=dance_electronic';

	try {
		await writableStream.write(encoder.encode({ type: 'progress', stage: 'fetching', current: 0, total: 100, message: 'Starting browser...' }));
		
        console.log('\n🚀 EVENKO SCRAPER STARTED');
		await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await writableStream.write(encoder.encode({ type: 'progress', stage: 'fetching', current: 10, total: 100, message: 'Page loaded. Looking for events...' }));
        
        // Wait for event cards to be present
        await page.waitForSelector('div.Card_card__UidMi', { timeout: 10000 });

		const eventCards = await page.locator('div.Card_card__UidMi').all();
		console.log(`✓ Found ${eventCards.length} initial event cards.`);
        
        let current = 0;
		for (const card of eventCards) {
            stats.processed++;
            current++;
            const progress = 10 + Math.round((current / eventCards.length) * 80);
            
			try {
                const nameText = await card.locator('.Card_cardTitle__c06ll').textContent();
                const dateText = await card.locator('.Card_date__tHcxG').textContent();
                const locationText = await card.locator('.Card_location__EgWRn').textContent();
                const venueText = await card.locator('.Card_location__EgWRn a').textContent();
                const relativeUrl = await card.locator('a').first().getAttribute('href');
                let imageUrl = await card.locator('img').getAttribute('src');

                if (!nameText || !dateText || !locationText || !venueText || !relativeUrl) {
                    console.warn('Skipping card, missing essential info.');
                    stats.errors++;
                    continue;
                }

                const name = nameText.trim();
                const date = parseDate(dateText.split('|')[0].trim());
                if (!date) {
                    console.warn(`Could not parse date: "${dateText}" for event: ${name}`);
                    stats.errors++;
                    continue;
                }

                await writableStream.write(encoder.encode({ type: 'progress', stage: 'scraping', current: progress, total: 100, message: `Scraping: ${name}` }));

                const city = locationText.split('–')[1]?.trim() || 'Montreal';
                const url = `https://evenko.ca${relativeUrl}`;
                if (imageUrl && imageUrl.startsWith('//')) {
                    imageUrl = 'https:' + imageUrl;
                }

                const eventData: EventData = {
                    name,
                    date,
                    venue: venueText.trim(),
                    city,
                    country: 'Canada',
                    flyer_image_url: imageUrl,
                    url,
                    source: 'Evenko',
                    artists: [name] // Assuming the event title is the main artist
                };
                
                console.log(`\n📋 EVENT DATA:\n${JSON.stringify(eventData, null, 2)}`);
				await upsertEventData(eventData, stats, writableStream, encoder);

			} catch (error: any) {
				console.error('✗ Error processing an event card:', error.message);
				stats.errors++;
			}
            await sleep(50); // Small delay between processing each card
		}

        await writableStream.write(encoder.encode({ type: 'progress', stage: 'complete', current: 100, total: 100, message: `Finishing up...` }));
		console.log(`\n✅ SCRAPING COMPLETE\n📊 Processed: ${stats.processed}, ✓ Logged: ${stats.created}, ✗ Errors: ${stats.errors}\n`);
		await writableStream.write(encoder.encode({ type: 'complete', message: `✓ Complete! Processed: ${stats.processed}, Logged: ${stats.created}, Errors: ${stats.errors}`, data: stats }));

	} catch(error: any) {
        console.error('❌ Scraping error:', error);
        await writableStream.write(encoder.encode({ type: 'error', message: error.message }));
    } finally {
		await browser.close();
	}
}


export const POST: RequestHandler = async () => {
	const stream = new ReadableStream({
		async start(controller) {
			const encoder = createStreamEncoder();
			const writer = { write: (chunk: Uint8Array) => controller.enqueue(chunk) };
			try {
				await scrapeEvenkoEvents(writer as any, encoder);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				controller.enqueue(encoder.encode({ type: 'error', message: errorMessage }));
			} finally {
				controller.close();
			}
		}
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }
	});
};
