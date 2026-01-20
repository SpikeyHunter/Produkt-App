import type { EventAdvance, TimetableEntry } from '$lib/services/eventsService';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generates an HTML table for the timetable.
 */
function generateTimetableHtml(timetable: TimetableEntry[] | null): string {
	if (!timetable || timetable.length === 0 || timetable.every((entry) => entry.time === 'TBD')) {
		return '<p>Will be sending them shortly</p>';
	}

	const formatTimeWithSeconds = (timeStr: string): string => {
		if (!timeStr) return '';
		const periodIndex = timeStr.search(/am|pm/i);
		if (periodIndex === -1) return timeStr;
		const timePart = timeStr.substring(0, periodIndex);
		const periodPart = timeStr.substring(periodIndex);
		return `${timePart}:00 ${periodPart}`;
	};

	const formatLengthWithMinutes = (lengthStr: string): string => {
		if (!lengthStr) return '';
		const cleanedStr = lengthStr.replace(/\s+/g, '').replace('min', '');
		let totalMinutes = 0;
		if (cleanedStr.includes('h')) {
			const parts = cleanedStr.split('h');
			const hours = parseInt(parts[0]) || 0;
			const minutes = parseInt(parts[1]) || 0;
			totalMinutes = hours * 60 + minutes;
		} else {
			totalMinutes = parseInt(cleanedStr) || 0;
		}
		return `${totalMinutes} min`;
	};

	const getStatusColors = (status: string) => {
		switch (status) {
			case 'Confirmed':
				return { bg: '#d9ead3', text: '#274e13' };
			case 'Proposed':
				return { bg: '#fce5cd', text: '#783f04' };
			case 'Tentative':
				return { bg: '#fff2cc', text: '#7f6000' };
			case 'Problem':
				return { bg: '#f4cccc', text: '#660000' };
			default:
				return { bg: '#ffffff', text: '#000000' };
		}
	};

	let html =
		'<table style="border-collapse: collapse; font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; font-size: 13px; border: 0.5px solid #d1d5db;">';
	html += '<thead><tr style="background-color: #ffffff;">';
	html +=
		'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 75px;">Timetable</th>';
	html +=
		'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 40px;">Length</th>';
	html +=
		'<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 225px;">Artist</th>';
	html += '</tr></thead>';
	html += '<tbody>';

	timetable.forEach((entry) => {
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';
		const colors = isSpecialEntry
			? { bg: '#ffffff', text: '#000000' }
			: getStatusColors(entry.status);
		html += `<tr style="background-color: ${colors.bg};">`;
		html += `<td style="background-color: #ffffff; border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center;">${formatTimeWithSeconds(entry.time || '')}</td>`;
		html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: center; ">${formatLengthWithMinutes(entry.length || '')}</td>`;
		html += `<td style="border: 0.5px solid #d1d5db; padding: 2px 6px; color: ${colors.text}; font-weight: ${isSpecialEntry ? '400' : '600'}; font-style: ${isSpecialEntry ? 'italic' : 'normal'};">${entry.artist || ''}</td>`;
		html += '</tr>';
	});
	html += '</tbody></table>';

	return html;
}

/**
 * Formats a date string into "Month Day, Year".
 */
function formatFullDate(dateString: string | null): string {
	if (!dateString) return 'TBD';
	try {
		const date = new Date(dateString);
		const options: Intl.DateTimeFormatOptions = {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC'
		};
		return date.toLocaleDateString('en-US', options);
	} catch (error) {
		console.error('Error formatting full date:', error);
		return dateString;
	}
}

/**
 * Gets the backline equipment for the artist after the local artist.
 */
async function getNextArtistBackline(
	event: EventAdvance,
	supabase: SupabaseClient
): Promise<string> {
	if (!event?.event_id || !event.artist_name || !event.timetable) {
		return '';
	}

	const timetable = event.timetable;

	// Find current local artist in timetable
	const currentArtistEntry = timetable.find((entry: TimetableEntry) => {
		if (entry.artist === event.artist_name) return true;
		const artistsInSlot = entry.artist.split(/\s+B2B\s+/i).map((name: string) => name.trim());
		return artistsInSlot.includes(event.artist_name);
	});

	if (!currentArtistEntry) return '';

	const currentArtistIndex = timetable.indexOf(currentArtistEntry);

	// Find the next artist after the local artist (excluding DOORS/CURFEW)
	const nextArtistEntry = timetable
		.slice(currentArtistIndex + 1)
		.find((entry: TimetableEntry) => entry.artist !== 'DOORS' && entry.artist !== 'CURFEW');

	if (!nextArtistEntry) return '';

	try {
		// Get the first artist name from the slot (handle B2B)
		const nextArtistNames = nextArtistEntry.artist
			.split(/\s+B2B\s+/i)
			.map((name: string) => name.trim());

		// Fetch tech rider for the next artist
		const { data, error } = await supabase
			.from('events_advance')
			.select('tech_rider')
			.eq('event_id', event.event_id)
			.eq('artist_name', nextArtistNames[0])
			.single();

		if (error || !data) {
			console.warn('Could not fetch next artist tech rider:', error);
			return '';
		}

		const techRider =
			typeof data.tech_rider === 'string' ? JSON.parse(data.tech_rider) : data.tech_rider;

		if (!techRider) return '';

		let backlineHtml = '';

		// Add mixer
		if (techRider.selected_mixer) {
			backlineHtml += `* 1x ${techRider.selected_mixer}<br>`;
		}

		// Add equipment (excluding microphones)
		if (techRider.equipment) {
			for (const key in techRider.equipment) {
				const item = techRider.equipment[key];
				if (item.selected && key !== 'Wireless Mic' && key !== 'Wired Mic') {
					backlineHtml += `* ${item.qty}x ${key}<br>`;
				}
			}
		}

		// Add other requests
		if (Array.isArray(techRider.other)) {
			techRider.other.forEach((req: any) => {
				if (req.text && req.text.trim()) {
					backlineHtml += `* ${req.text}<br>`;
				}
			});
		}

		return backlineHtml;
	} catch (err) {
		console.error('Error fetching next artist backline:', err);
		return '';
	}
}

/**
 * Gets contact email from local_contacts based on main_contact.
 */
async function getContactEmail(
	mainContact: string | null,
	supabase: SupabaseClient
): Promise<string | null> {
	if (!mainContact) return null;

	try {
		// Extract phone number from main_contact (format: "Name - Phone")
		const phoneMatch = mainContact.match(/\+1\s*\(?\d{3}\)?\s*\d{3}[-.\s]?\d{4}/);
		if (!phoneMatch) return null;

		const phone = phoneMatch[0];

		// Query local_contacts for matching phone
		const { data, error } = await supabase
			.from('local_contacts')
			.select('email, first_name, dj_name')
			.eq('phone', phone)
			.single();

		if (error || !data) {
			console.warn('Could not find contact in local_contacts:', error);
			return null;
		}

		return data.email;
	} catch (err) {
		console.error('Error fetching contact email:', err);
		return null;
	}
}

/**
 * Gets the contact's first name or DJ name.
 */
async function getContactName(
	mainContact: string | null,
	supabase: SupabaseClient
): Promise<string> {
	if (!mainContact) return '';

	try {
		const phoneMatch = mainContact.match(/\+1\s*\(?\d{3}\)?\s*\d{3}[-.\s]?\d{4}/);
		if (!phoneMatch) return '';

		const phone = phoneMatch[0];

		const { data, error } = await supabase
			.from('local_contacts')
			.select('first_name, dj_name')
			.eq('phone', phone)
			.single();

		if (error || !data) {
			return '';
		}

		return data.first_name || data.dj_name || '';
	} catch (err) {
		console.error('Error fetching contact name:', err);
		return '';
	}
}

/**
 * Checks if the contact has a phone number in local_contacts.
 */
async function hasContactPhone(
	mainContact: string | null,
	supabase: SupabaseClient
): Promise<boolean> {
	if (!mainContact) return false;

	try {
		const phoneMatch = mainContact.match(/\+1\s*\(?\d{3}\)?\s*\d{3}[-.\s]?\d{4}/);
		if (!phoneMatch) return false;

		const phone = phoneMatch[0];

		const { data, error } = await supabase
			.from('local_contacts')
			.select('phone')
			.eq('phone', phone)
			.single();

		if (error || !data || !data.phone) {
			return false;
		}

		return true;
	} catch (err) {
		console.error('Error checking contact phone:', err);
		return false;
	}
}

/**
 * Generates the .eml file for local artist advance email.
 */
export async function generateLocalAdvanceEmail(
	event: EventAdvance & { timetable?: TimetableEntry[] | null },
	supabase: SupabaseClient
) {
	// Get the authenticated user
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user || !user.email) {
		console.error('No authenticated user found or user has no email');
		throw new Error('User must be authenticated to generate email');
	}

	// Get contact email
	// Get contact email
	// FIX: Use 'let' so we can modify it, and default to empty string if not found
	let toEmail = await getContactEmail(event.main_contact || null, supabase);

	if (!toEmail) {
		console.warn('No contact email found. defaulting to empty.');
		toEmail = ''; // Allows the email to open with a blank "To:" field
	}

	// Get contact name
	const contactName = await getContactName(event.main_contact || null, supabase);

	// Check if contact has phone number
	const contactHasPhone = await hasContactPhone(event.main_contact || null, supabase);

	const artistName = event.artist_name || 'N/A';
	const eventDate = formatFullDate(event.event_date ?? null);
	const eventVenue = event.venue || event.event_venue || 'TBD';
	const fromEmail = user.email;
	const userName = user.user_metadata?.name || fromEmail.split('@')[0];
	const userFirstName = userName.split(' ')[0];

	const subject = `Advance // ${artistName} // ${eventDate} // ${eventVenue} Montreal`;

	// Get timetable
	const timetableContent = generateTimetableHtml(event.timetable || null);

	// Get backline from next artist
	const backlineContent = await getNextArtistBackline(event, supabase);

	// Get guestlist
	const guestlist = event.guestlist as any;
	let guestlistText = '';
	if (guestlist) {
		const ga = guestlist.ga || 0;
		const vip = guestlist.vip || 0;

		if (ga <= 5) {
			guestlistText = `${ga}x GA`;
		} else if (ga <= 10 && vip <= 10) {
			guestlistText = `${ga}x GA + ${vip}x VIP`;
		} else {
			guestlistText = `${ga}x GA + ${vip}x VIP`;
		}
	}

	// Get specs link based on venue
	let specsText = '';
	if (eventVenue === 'New City Gas') {
		specsText =
			'<p><strong>NCG Specs:</strong> <a href="https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link">https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link</a></p>';
	} else if (eventVenue === 'Bazart') {
		specsText =
			'<p><strong>Bazart Specs:</strong> <a href="https://drive.google.com/drive/folders/1f-twa-hlssqjpUD2CN0zdqGn8cYnbpWY?usp=share_link">https://drive.google.com/drive/folders/1f-twa-hlssqjpUD2CN0zdqGn8cYnbpWY?usp=share_link</a></p>';
	}

	// Build bullet points dynamically
	let bulletPoints = '';
	if (!contactHasPhone) {
		bulletPoints += '<li>Can you please send me your phone number.</li>';
	}
	if (eventVenue === 'New City Gas') {
		bulletPoints += '<li>Can you please send your visuals or logo for our VJ</li>';
	}
	bulletPoints += `<li>Guest list will need to be submitted no later than 7pm night of the event. (Only ${guestlistText} will be given)</li>`;

	const htmlBody = `
        <p>Hi ${contactName},</p>
        <p>Hope you are well.</p>
		<p>Mezz on cc will share artwork files with you + ticketing link (if not already done)</p>
        <p>I will be your DOS artist liaison contact. We ask that you arrive 30min prior to set time, feel free to text me +1 (514) 805-9313</p>
        
		<p><strong><u>Set Time:</u></strong></p>
		${timetableContent}

		<p>The following <a href="https://docs.google.com/document/d/1_jNn_KG-oZyibNJVPaqBQJn9kPRKDrV3DpY7ickz42U/edit?usp=sharing">Google Doc</a> contains important information for you to read, along with details to prepare and submit your invoice for payment.</p>
		<ul>
			${bulletPoints}
		</ul>

		<p><strong><u>Backline Confirmed:</u></strong><br>
		${backlineContent || '* TBD'}
		</p>

		${specsText}

        <p>Please let me know if you have any questions.</p>
        <p>Thank you,<br>${userFirstName.charAt(0).toUpperCase() + userFirstName.slice(1)}</p>
    `
		.replace(/\n/g, '')
		.replace(/    /g, '')
		.trim();

	const emlContent = `Subject: ${subject}
From: ${fromEmail}
To: ${toEmail}
CC: janie@produkt.ca, allanah@produkt.ca, mezz@produkt.ca
X-Unsent: 1
Content-Type: text/html; charset=utf-8

${htmlBody}
`;

	// Create a Blob and trigger the download
	const blob = new Blob([emlContent], { type: 'message/rfc822' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `${subject.replace(/[\s/]+/g, '_')}.eml`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}

/**
 * Checks if the local artist email can be generated (has main_contact).
 */
export async function canGenerateLocalEmail(
	event: EventAdvance,
	supabase: SupabaseClient
): Promise<boolean> {
	// FIX: Always return true so the button is never disabled
	return true;
}
