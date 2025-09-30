import { supabase } from '$lib/supabase';
import type { EventAdvance } from '$lib/services/eventsService';

interface HospoRider {
	spirits?: Record<string, { selected: boolean; qty: number }>;
	beers_wine?: {
		beers?: Record<string, { selected: boolean; qty: number }>;
		wine?: Record<string, { selected: boolean; qty: number }>;
		juice?: Record<string, { selected: boolean; qty: number }>;
	};
	other_drinks?: Record<string, { selected: boolean; qty: number }>;
	base?: {
		regular_drinks?: boolean;
		regular_snacks?: boolean;
	};
	custom_requests?: string[];
	custom_rider_text?: string;
}

interface EventWithRider extends EventAdvance {
	event_date?: string;
}

function parseHospoRider(riderData: any): HospoRider | null {
	if (!riderData) return null;
	if (typeof riderData === 'string') {
		try {
			return JSON.parse(riderData);
		} catch {
			return null;
		}
	}
	return riderData;
}

function formatDate(dateString: string): string {
	const date = new Date(dateString.replace(/-/g, '/'));
	const options: Intl.DateTimeFormatOptions = { 
		weekday: 'long', 
		year: 'numeric', 
		month: 'long', 
		day: 'numeric' 
	};
	return date.toLocaleDateString('en-US', options);
}

function formatRiderItems(rider: HospoRider): string[] {
	const items: string[] = [];
	
	if (rider.spirits) {
		Object.entries(rider.spirits).forEach(([name, item]) => {
			if (item.selected && item.qty > 0) {
				items.push(`${item.qty}x ${name}`);
			}
		});
	}
	
	if (rider.beers_wine?.beers) {
		Object.entries(rider.beers_wine.beers).forEach(([name, item]) => {
			if (item.selected && item.qty > 0) {
				items.push(`${item.qty}x ${name}`);
			}
		});
	}
	
	if (rider.beers_wine?.juice) {
		Object.entries(rider.beers_wine.juice).forEach(([name, item]) => {
			if (item.selected && item.qty > 0) {
				items.push(`${item.qty}x ${name}`);
			}
		});
	}
	
	if (rider.other_drinks) {
		Object.entries(rider.other_drinks).forEach(([name, item]) => {
			if (item.selected && item.qty > 0) {
				items.push(`${item.qty}x ${name}`);
			}
		});
	}
	
	if (rider.custom_requests && rider.custom_requests.length > 0) {
		items.push(...rider.custom_requests);
	}
	
	if (rider.custom_rider_text && rider.custom_rider_text.trim()) {
		items.push(rider.custom_rider_text.trim());
	}
	
	return items;
}

function hasChampagne(rider: HospoRider): boolean {
	if (!rider.spirits) return false;
	
	const champagneItems = ['moet chandon', 'dom perignon', 'cava'];
	
	for (const [name, item] of Object.entries(rider.spirits)) {
		const lowerName = name.toLowerCase();
		const isChampagne = champagneItems.some(champagne => lowerName.includes(champagne));
		
		if (isChampagne) {
			console.log(`Found champagne item: ${name}, selected: ${item.selected}`);
			if (item.selected === true) {
				return true;
			}
		}
	}
	
	return false;
}

function getLocalArtists(timetable: any): string[] {
	console.log('getLocalArtists called with:', timetable);
	
	if (!timetable) {
		console.log('No timetable provided');
		return [];
	}
	
	let parsedTimetable = timetable;
	
	if (typeof timetable === 'string') {
		try {
			parsedTimetable = JSON.parse(timetable);
		} catch (e) {
			console.error('Failed to parse timetable:', e);
			return [];
		}
	}
	
	if (!Array.isArray(parsedTimetable)) {
		console.log('Timetable is not an array');
		return [];
	}
	
	console.log('Processing timetable array with', parsedTimetable.length, 'entries');
	
	const localArtists = parsedTimetable
		.filter((entry: any) => {
			const hasLocalNote = entry.notes?.toLowerCase().includes('local');
			console.log(`Checking entry: artist="${entry.artist}", notes="${entry.notes}", isLocal=${hasLocalNote}`);
			return hasLocalNote;
		})
		.map((entry: any) => entry.artist || entry.artist_name || '')
		.filter((name: string) => name !== '' && name !== 'DOORS' && name !== 'CURFEW');
	
	console.log('Local artists found:', localArtists);
	
	const uniqueArtists = [...new Set(localArtists)];
	console.log('Unique local artists:', uniqueArtists);
	
	return uniqueArtists;
}

async function fetchEventsForDate(eventId: string | number): Promise<{ events: EventWithRider[], eventDate: string }> {
	const { data: eventData, error: eventError } = await supabase
		.from('events')
		.select('event_date, timetable, event_venue')
		.eq('event_id', eventId)
		.single();
	
	if (eventError || !eventData) {
		throw new Error('Could not find event date.');
	}
	
	const eventDate = eventData.event_date;
	
	const { data: eventsWithSameDate, error: eventsError } = await supabase
		.from('events')
		.select('event_id, event_date, timetable, event_venue')
		.eq('event_date', eventDate);
	
	if (eventsError) throw eventsError;
	if (!eventsWithSameDate || eventsWithSameDate.length === 0) {
		return { events: [], eventDate };
	}
	
	const eventIds = eventsWithSameDate.map(e => e.event_id);
	
	const { data: advanceData, error: advanceError } = await supabase
		.from('events_advance')
		.select('*')
		.in('event_id', eventIds);
	
	if (advanceError) throw advanceError;
	if (!advanceData || advanceData.length === 0) {
		return { events: [], eventDate };
	}
	
	const eventsMap = new Map(eventsWithSameDate.map(e => [e.event_id, { timetable: e.timetable, event_venue: e.event_venue }]));
	
	const eventsWithTimetable = advanceData.map(event => {
		const eventInfo = eventsMap.get(event.event_id);
		return {
			...event,
			event_date: eventDate,
			timetable: eventInfo?.timetable,
			event_venue: eventInfo?.event_venue
		};
	});
	
	return { events: eventsWithTimetable, eventDate };
}

export async function generateMihirRider(currentEvent: EventAdvance): Promise<string> {
	try {
		const { events, eventDate } = await fetchEventsForDate(currentEvent.event_id);
		
		if (events.length === 0) {
			throw new Error('No events found for this date.');
		}
		
		const ncgEvents = events.filter(e => e.event_venue === 'New City Gas');
		const bazartEvents = events.filter(e => e.event_venue === 'Bazart');
		
		const missingRiders: string[] = [];
		[...ncgEvents, ...bazartEvents].forEach(event => {
			const artistType = event.artist_type?.toLowerCase();
			if (artistType === 'headliner' || artistType === 'support') {
				const rider = parseHospoRider(event.hospo_rider);
				if (!rider) {
					missingRiders.push(event.artist_name || 'Unknown Artist');
				}
			}
		});
		
		if (missingRiders.length > 0) {
			throw new Error(`Error! Missing Hospo Rider for ${missingRiders.join(', ')}`);
		}
		
		const priorityMap = { headliner: 1, support: 2, local: 3 };
		const sortEvents = (a: EventWithRider, b: EventWithRider) => {
			const aPriority = priorityMap[a.artist_type?.toLowerCase() as keyof typeof priorityMap] || 999;
			const bPriority = priorityMap[b.artist_type?.toLowerCase() as keyof typeof priorityMap] || 999;
			return aPriority - bPriority;
		};
		
		ncgEvents.sort(sortEvents);
		bazartEvents.sort(sortEvents);
		
		const dosName = currentEvent.dos || 'DOS';
		
		let venueText = '';
		const venues = [...new Set(events.map(e => e.event_venue).filter(v => v))];
		
		if (venues.includes('New City Gas') && venues.includes('Bazart')) {
			venueText = 'Main Room and Bazart Lounge';
		} else if (venues.includes('New City Gas')) {
			venueText = 'Main Room';
		} else if (venues.includes('Bazart')) {
			venueText = 'Bazart Lounge';
		} else {
			venueText = venues.join(' and ');
		}
		
		let body = `Hi,\n\n`;
		body += `Here's the list for ${formatDate(eventDate)}. `;
		body += `Please note ${dosName} will be taking care of the artist in the ${venueText} at night.\n\n`;
		
		if (ncgEvents.length > 0) {
			body += `Stage (Main Room) to be set up before 9:30 (please make sure glasses and limes):\n`;
			body += `* 12x Water\n`;
			body += `* 8x Beer\n`;
			body += `* 8x Redbull\n`;
			body += `* 6x Perrier\n`;
			body += `* 2x Coke\n`;
			body += `* 2x Sprite\n`;
			body += `* 2x Ginger Ale\n`;
			body += `* + soft drinks\n\n`;
			
			const ncgTimetable = ncgEvents[0]?.timetable;
			const localArtists = getLocalArtists(ncgTimetable);
			
			localArtists.forEach(artist => {
				const localEvent = ncgEvents.find(e => e.artist_name === artist && (e.artist_type?.toLowerCase() === 'local'));
				if (localEvent) {
					const rider = parseHospoRider(localEvent.hospo_rider);
					if (rider) {
						const items = formatRiderItems(rider);
						items.forEach(item => body += `* ${item} (${artist})\n`);
					} else {
						body += `* 1x Grey Goose (${artist})\n`;
					}
				} else {
					body += `* 1x Grey Goose (${artist})\n`;
				}
			});
			
			const hasChampagneInNCG = ncgEvents.some(e => {
				const rider = parseHospoRider(e.hospo_rider);
				return rider && hasChampagne(rider);
			});
			
			console.log('Final champagne decision for NCG:', hasChampagneInNCG);
			
			body += `* Glasses + Shooters`;
			if (hasChampagneInNCG) {
				body += ` + Champagne Glasses`;
			}
			body += `\n* Ice Bucket\n\n`;
		}
		
		if (bazartEvents.length > 0) {
			body += `Stage (Bazart) to be set up before 9:30 (please make sure glasses and limes are setup PLEASE use low tables for booth):\n`;
			body += `* 6x Water\n`;
			body += `* 6x Redbull\n`;
			body += `* 6x Perrier\n`;
			body += `* 2x Coke\n`;
			body += `* 2x Sprite\n`;
			body += `* 2x Ginger Ale\n`;
			body += `* + soft drinks\n\n`;
			
			const bazartTimetable = bazartEvents[0]?.timetable;
			const localArtists = getLocalArtists(bazartTimetable);
			
			localArtists.forEach(artist => {
				const localEvent = bazartEvents.find(e => e.artist_name === artist && (e.artist_type?.toLowerCase() === 'local'));
				if (localEvent) {
					const rider = parseHospoRider(localEvent.hospo_rider);
					if (rider) {
						const items = formatRiderItems(rider);
						items.forEach(item => body += `* ${item} (${artist})\n`);
					} else {
						body += `* 1x Grey Goose (${artist})\n`;
					}
				} else {
					body += `* 1x Grey Goose (${artist})\n`;
				}
			});
			
			const hasChampagneInBazart = bazartEvents.some(e => {
				const rider = parseHospoRider(e.hospo_rider);
				return rider && hasChampagne(rider);
			});
			
			body += `* Glasses + Shooters`;
			if (hasChampagneInBazart) {
				body += ` + Champagne Glasses`;
			}
			body += `\n* Ice Bucket\n\n`;
		}
		
		const allEventsForGreenRoom = [...ncgEvents, ...bazartEvents].filter(e => {
			const type = e.artist_type?.toLowerCase();
			return type === 'support' || type === 'headliner';
		});
		
		allEventsForGreenRoom.forEach(event => {
			const rider = parseHospoRider(event.hospo_rider);
			if (!rider) return;
			
			body += `${event.artist_name} - Green Room\n`;
			const items = formatRiderItems(rider);
			items.forEach(item => body += `* ${item}\n`);
			body += `\n`;
		});
		
		body += `Thanks,\nCharles`;
		
		return body;
	} catch (error) {
		throw error;
	}
}

export function downloadEmlFile(emailBody: string, fileName: string) {
	const dateParts = fileName.split('_')[0];
	let subject = 'Hospitality Rider';
	
	if (dateParts) {
		try {
			const [day, monthAbbr, year] = dateParts.split('-');
			const monthMap: Record<string, number> = {
				'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3,
				'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7,
				'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
			};
			const monthNameMap: Record<string, string> = {
				'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
				'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
				'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
			};
			
			const fullMonth = monthNameMap[monthAbbr] || monthAbbr;
			const monthNum = monthMap[monthAbbr];
			const dayNum = parseInt(day);
			let suffix = 'th';
			if (dayNum === 1 || dayNum === 21 || dayNum === 31) suffix = 'st';
			else if (dayNum === 2 || dayNum === 22) suffix = 'nd';
			else if (dayNum === 3 || dayNum === 23) suffix = 'rd';
			
			const date = new Date(parseInt(year), monthNum, dayNum);
			const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
			
			subject = `${dayOfWeek} - ${fullMonth} ${dayNum}${suffix} ${year}`;
		} catch (error) {
			console.error('Error formatting date:', error);
		}
	}
	
	const to = 'Mihir Routh <mrouth@gmail.com>, Mykl Zadourian <myklzadourian@gmail.com>';
	const cc = 'Allanah De Marco <allanah@produkt.ca>, Janie Latendresse <janie@produkt.ca>';
	const from = 'Charles <charles@produkt.ca>';
	
	let htmlBody = emailBody;
	
	// Remove space after "Hi,"
	htmlBody = htmlBody.replace(/^Hi,\n\n/m, 'Hi,\n');
	
	// Bold the date in the first line
	htmlBody = htmlBody.replace(/(Friday, [^.]+\.)/g, '<strong>$1</strong>');
	
	// Bold "Main Room" or "Bazart Lounge" in the intro sentence only
	htmlBody = htmlBody.replace(/(in the )(Main Room|Bazart Lounge)( at night)/g, '$1<strong>$2</strong>$3');
	
	// Bold and underline entire stage setup headers
	htmlBody = htmlBody.replace(/Stage \(Main Room\) to be set up before 9:30 \(please make sure glasses and limes\):/g, '<strong><u>Stage (Main Room) to be set up before 9:30 (please make sure glasses and limes):</u></strong>');
	htmlBody = htmlBody.replace(/Stage \(Bazart\) to be set up before 9:30 \(please make sure glasses and limes are setup PLEASE use low tables for booth\):/g, '<strong><u>Stage (Bazart) to be set up before 9:30 (please make sure glasses and limes are setup PLEASE use low tables for booth):</u></strong>');
	
	// Bold and underline Green Room headers
	htmlBody = htmlBody.replace(/^([^*\n]+ - Green Room)$/gm, '<strong><u>$1</u></strong>');
	
	// Convert asterisks to proper HTML bullets BEFORE converting line breaks
	htmlBody = htmlBody.replace(/\* ([^\n]+)/g, '<li style="margin-left: 20px; line-height: 1.2; margin-bottom: 0;">$1</li>');
	
	// Now convert line breaks, but remove <br> that comes right after </li>
	htmlBody = htmlBody.replace(/\n/g, '<br>');
	htmlBody = htmlBody.replace(/<\/li><br>/g, '</li>');
	
	const randomNum = Math.floor(Math.random() * 10000);
	const finalFileName = `${fileName}_${randomNum}`;
	
	const emlContent = [
		`From: ${from}`,
		`To: ${to}`,
		`CC: ${cc}`,
		`Subject: ${subject}`,
		`MIME-Version: 1.0`,
		`Content-Type: text/html; charset=utf-8`,
		``,
		`<html><body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 12px; line-height: 1.6;">`,
		htmlBody,
		`</body></html>`
	].join('\r\n');
	
	const blob = new Blob([emlContent], { type: 'message/rfc822' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${finalFileName}.eml`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}