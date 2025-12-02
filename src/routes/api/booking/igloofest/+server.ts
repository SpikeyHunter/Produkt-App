import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { chromium } from 'playwright';
import { supabase } from '$lib/supabase'; // Ensure this matches your actual file path
import { _isCancelled, _resetCancellation } from './cancel/+server';

// Configuration for all 4 Igloofest locations
// We define the "Main Stage" keywords to intelligently pick the headliner for the event title
const LOCATIONS = [
    // --- MONTREAL (4 Weekends) ---
    { 
        city: 'Montreal', 
        url: 'https://igloofest.ca/en/festival/2026-week-end-1', 
        source: 'Igloofest Montreal',
        mainStageKeywords: ['SAPPORO', 'SAPPORO STAGE'],
        year: 2026,
        prefix: 'Igloofest MTL #1'
    },
    { 
        city: 'Montreal', 
        url: 'https://igloofest.ca/en/festival/2026-week-end-2', 
        source: 'Igloofest Montreal',
        mainStageKeywords: ['SAPPORO', 'SAPPORO STAGE'],
        year: 2026,
        prefix: 'Igloofest MTL #2'
    },
    { 
        city: 'Montreal', 
        url: 'https://igloofest.ca/en/festival/2026-week-end-3', 
        source: 'Igloofest Montreal',
        mainStageKeywords: ['SAPPORO', 'SAPPORO STAGE'],
        year: 2026,
        prefix: 'Igloofest MTL #3'
    },
    { 
        city: 'Montreal', 
        url: 'https://igloofest.ca/en/festival/2026-week-end-4', 
        source: 'Igloofest Montreal',
        mainStageKeywords: ['SAPPORO', 'SAPPORO STAGE'],
        year: 2026,
        prefix: 'Igloofest MTL #4'
    },
    // --- GATINEAU ---
    { 
        city: 'Gatineau', 
        url: 'https://gatineau.igloofest.ca/en/festival/2026-week-end-1', 
        source: 'Igloofest Gatineau',
        mainStageKeywords: ['FIZZ', 'FIZZ STAGE'],
        year: 2026,
        prefix: 'Igloofest Gatineau'
    },
    // --- QUEBEC ---
    { 
        city: 'Quebec', 
        url: 'https://quebec.igloofest.ca/en/festival/igloofest-2026', 
        source: 'Igloofest Quebec',
        mainStageKeywords: ['LOTO-QUEBEC', 'LOTO-QUÉBEC'],
        year: 2026,
        prefix: 'Igloofest Quebec'
    },
    // --- EDMONTON ---
    { 
        city: 'Edmonton', 
        url: 'https://edmonton.igloofest.ca/en/festival/week-end-1', 
        source: 'Igloofest Edmonton',
        mainStageKeywords: ['NATIONAL BANK', 'BANQUE NATIONALE'],
        year: 2026,
        prefix: 'Igloofest Edmonton'
    }
];

export const POST: RequestHandler = async () => {
    _resetCancellation();
    const encoder = new TextEncoder();
    console.log('❄️ Starting Igloofest Scraper...');

    const stream = new ReadableStream({
        async start(controller) {
            const sendUpdate = (data: any) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            let browser;
            try {
                sendUpdate({ type: 'progress', stage: 'initializing', current: 0, message: 'Launching browser...' });
                
                try {
                    browser = await chromium.launch({ headless: true });
                } catch (e) {
                    console.error('Browser launch failed:', e);
                    throw new Error('Playwright not installed. Run "npx playwright install" on server.');
                }
                
                const page = await browser.newPage();
                const totalSteps = LOCATIONS.length;
                let stepsCompleted = 0;

                for (const loc of LOCATIONS) {
                    if (_isCancelled()) {
                        console.log('🛑 Scraper cancelled by user.');
                        sendUpdate({ type: 'cancelled', message: 'Sync cancelled by user.' });
                        break;
                    }

                    const progress = Math.round((stepsCompleted / totalSteps) * 100);
                    sendUpdate({ 
                        type: 'progress', 
                        stage: 'scraping', 
                        current: progress, 
                        message: `Scraping ${loc.city} (${loc.prefix})...` 
                    });

                    console.log(`\n📍 Processing: ${loc.source} - ${loc.url}`);
                    console.time(`Time-${loc.city}`);

                    try {
                        await page.goto(loc.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        
                        // Pass the location config to the browser context to parse specific HTML structure
                        const dailyEvents = await page.evaluate((config) => {
                            const results: any[] = [];
                            
                            // Helper to parse "09:30PM" into minutes for comparison to find the last act
                            const parseTime = (timeStr: string) => {
                                if (!timeStr) return 0;
                                const match = timeStr.match(/(\d+):(\d+)(AM|PM)/i);
                                if (!match) return 0;
                                let [_, h, m, p] = match;
                                let hour = parseInt(h);
                                if (p.toUpperCase() === 'PM' && hour < 12) hour += 12;
                                if (p.toUpperCase() === 'AM' && hour === 12) hour = 0;
                                // Handle cases past midnight (e.g. 01:00 AM should be considered "later" than 11:00 PM for a night show)
                                if (hour < 6) hour += 24; 
                                return hour * 60 + parseInt(m);
                            };

                            // Igloofest uses <article> tags for each day in the accordion
                            const articles = document.querySelectorAll('article[data-state="open"], article');
                            
                            articles.forEach((article) => {
                                // --- 1. Extract Date ---
                                // The button usually contains text like "Thursday, January 15"
                                const dateButton = article.querySelector('button');
                                const dateText = dateButton?.textContent?.trim() || '';
                                
                                // Regex to match Month Day (Supports English and French approx)
                                // e.g. "January 15" or "15 janvier"
                                const dateMatch = dateText.match(/([a-zA-Zûé]+)\s+(\d{1,2})|(\d{1,2})\s+([a-zA-Zûé]+)/);
                                
                                let formattedDate = null;
                                if (dateMatch) {
                                    // Normalize month names (EN/FR)
                                    const monthNames = [
                                        "january", "janvier", "february", "février", "march", "mars", 
                                        "april", "avril", "may", "mai", "june", "juin", 
                                        "july", "juillet", "august", "août", "september", "septembre", 
                                        "october", "octobre", "november", "novembre", "december", "décembre"
                                    ];
                                    
                                    const foundMonthText = (dateMatch[1] || dateMatch[4]).toLowerCase();
                                    const foundDayText = dateMatch[2] || dateMatch[3];

                                    const monthIndex = monthNames.findIndex(m => foundMonthText.includes(m));
                                    
                                    if (monthIndex > -1) {
                                        // Map index to actual month number (0,1 -> 01; 2,3 -> 02, etc because of EN/FR pairs)
                                        const realMonth = Math.floor(monthIndex / 2) + 1;
                                        const mm = String(realMonth).padStart(2, '0');
                                        const dd = String(foundDayText).padStart(2, '0');
                                        formattedDate = `${config.year}-${mm}-${dd}`;
                                    }
                                }

                                if (!formattedDate) return; // Skip if no valid date found

                                // --- 2. Extract Stages and Artists ---
                                const stageElements = article.querySelectorAll('h3');
                                let headlinerName = 'TBA';
                                let headlinerTimeVal = -1;
                                let headlinerImage = null;
                                const allArtists: string[] = [];

                                stageElements.forEach((h3) => {
                                    const stageName = h3.textContent?.toUpperCase() || '';
                                    const isMainStage = config.mainStageKeywords.some((k: string) => stageName.includes(k));
                                    
                                    // The list of artists follows the H3 (it's the next sibling ul)
                                    const artistList = h3.nextElementSibling; 
                                    if (artistList && artistList.tagName === 'UL') {
                                        const items = artistList.querySelectorAll('li a');
                                        
                                        items.forEach((item) => {
                                            const nameEl = item.querySelector('span.text-20, span.text-32'); // Classes from HTML
                                            const timeEl = item.querySelector('time span');
                                            const imgEl = item.querySelector('img');

                                            const name = nameEl?.textContent?.trim();
                                            const timeText = timeEl?.textContent?.trim() || '';
                                            
                                            // Get highest resolution image available in srcset
                                            const srcSet = imgEl?.getAttribute('srcset');
                                            let imgSrc = imgEl?.getAttribute('src');
                                            if (srcSet) {
                                                const candidates = srcSet.split(',').map(s => s.trim().split(' '));
                                                if (candidates.length > 0) imgSrc = candidates[candidates.length - 1][0];
                                            }

                                            if (name) {
                                                allArtists.push(name);

                                                // Determine Headliner (Latest time on Main Stage)
                                                if (isMainStage) {
                                                    const tVal = parseTime(timeText);
                                                    // If this artist plays later than the current max, set them as headliner
                                                    if (tVal > headlinerTimeVal) {
                                                        headlinerTimeVal = tVal;
                                                        headlinerName = name;
                                                        headlinerImage = imgSrc;
                                                    }
                                                }
                                            }
                                        });
                                    }
                                });

                                // Fallback: if no main stage found or times missing, use the first artist of the first stage
                                if ((headlinerName === 'TBA' || headlinerTimeVal === -1) && allArtists.length > 0) {
                                    headlinerName = allArtists[0];
                                    // Try to find image for this fallback artist
                                    const firstImg = article.querySelector('img');
                                    if (firstImg && !headlinerImage) headlinerImage = firstImg.getAttribute('src');
                                }

                                // Clean up Headliner Name (remove "DJ Set" for cleaner titles if preferred, or keep it)
                                // We keep it as per your logs showing "The Blaze (DJ Set)"

                                // Construct Event Object
                                results.push({
                                    name: `${config.prefix} - ${headlinerName}`, // e.g. "Igloofest MTL #1 - Disco Lines"
                                    date: formattedDate,
                                    venue: `${config.city} - Old Port`,
                                    city: config.city,
                                    country: 'Canada',
                                    source: config.source,
                                    url: config.url,
                                    flyer_image_url: headlinerImage,
                                    artists: [...new Set(allArtists)] // Remove duplicates
                                });
                            });

                            return results;
                        }, loc);

                        console.log(`   -> Found ${dailyEvents.length} daily events.`);
                        
                        // --- 3. Save to DB ---
                        for (const event of dailyEvents) {
                            if (_isCancelled()) break;

                            console.log(`   -> Saving: [${event.date}] ${event.name}`);

                            // A. Upsert Artists
                            const artistIds = [];
                            for (const artistName of event.artists) {
                                const { data: artistData, error: artistError } = await supabase
                                    .from('booking_artist')
                                    .upsert({ name: artistName, last_seen: new Date().toISOString() }, { onConflict: 'name' })
                                    .select('id')
                                    .single();
                                
                                if (artistData) artistIds.push(artistData.id);
                                else if (artistError) console.error(`      Error saving artist ${artistName}:`, artistError.message);
                            }

                            // B. Upsert Event
                            // We create a unique "pseudo-URL" with the date anchor to allow multiple events per URL
                            const uniqueUrl = `${event.url}#date=${event.date}`;

                            const { error: eventError } = await supabase
                                .from('booking_event') 
                                .upsert({
                                    name: event.name,
                                    venue: event.venue,
                                    city: event.city,
                                    country: event.country,
                                    date: event.date,
                                    source: event.source,
                                    url: uniqueUrl,
                                    flyer_image_url: event.flyer_image_url,
                                    artist_ids: artistIds
                                }, { onConflict: 'url' });

                            if (eventError) {
                                console.error(`      Error saving event ${event.name}:`, eventError.message);
                            }
                        }

                    } catch (err) {
                        console.error(`❌ Failed to scrape ${loc.url}:`, err);
                    } finally {
                        console.timeEnd(`Time-${loc.city}`);
                    }

                    stepsCompleted++;
                }

                if (browser) await browser.close();
                
                if (!_isCancelled()) {
                    console.log('✅ Igloofest sync finished successfully.');
                    sendUpdate({ type: 'complete', message: 'Igloofest sync complete!', data: { timestamp: new Date() } });
                }

            } catch (error) {
                console.error('🔥 Fatal Scraper Error:', error);
                if (browser) await browser.close();
                sendUpdate({ type: 'error', message: error instanceof Error ? error.message : 'Unknown error' });
            } finally {
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        }
    });
};