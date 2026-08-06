import type { EventAdvance, TimetableEntry } from '$lib/services/eventsService';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveLocalBackline, buildBacklineHtml } from '$lib/utils/localBacklineResolver';

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
 * Resolves the venue for the event, falling back to the events table when the
 * advance row doesn't carry it.
 */
async function resolveEventVenue(
	event: EventAdvance & { event_venue?: string },
	supabase: SupabaseClient
): Promise<string> {
	const direct = event.event_venue || event.venue;
	if (direct) return direct;

	if (!event.event_id) return 'TBD';

	const { data } = await supabase
		.from('events')
		.select('event_venue')
		.eq('event_id', event.event_id)
		.single();

	return data?.event_venue || 'TBD';
}

function normalizeName(name?: string | null): string {
	return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the public invoice upload link for this artist — the exact same link the
 * Talent Payments panel copies with "Share Link".
 */
async function getInvoiceUploadLink(
	event: EventAdvance,
	supabase: SupabaseClient
): Promise<string | null> {
	if (!event?.event_id || !event?.artist_name) return null;

	const origin = typeof window !== 'undefined' ? window.location.origin : '';
	if (!origin) return null;

	try {
		const { data, error } = await supabase
			.from('talent_payments')
			.select('id, artist_name, advance_id, public_token')
			.eq('event_id', event.event_id);

		if (error || !data || data.length === 0) {
			console.warn('No talent_payments rows found for this event:', error);
			return null;
		}

		const target = normalizeName(event.artist_name);

		// Exact artist match first, then fall back to the advance row this email
		// is being generated from (covers B2B slots and spelling drift).
		const match =
			data.find((row: any) => normalizeName(row.artist_name) === target) ||
			data.find((row: any) => row.advance_id === (event as any).id) ||
			null;

		if (!match?.public_token) {
			console.warn('No public_token on the matching talent_payments row.');
			return null;
		}

		return `${origin}/public/invoice/${match.public_token}`;
	} catch (err) {
		console.error('Error fetching invoice upload link:', err);
		return null;
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
		const phoneMatch = mainContact.match(/\+1\s*\(?\d{3}\)?\s*\d{3}[-.\s]?\d{4}/);
		if (!phoneMatch) return null;

		const phone = phoneMatch[0];

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
	event: EventAdvance & { timetable?: TimetableEntry[] | null; event_venue?: string },
	supabase: SupabaseClient
) {
	const {
		data: { user }
	} = await supabase.auth.getUser();

	if (!user || !user.email) {
		console.error('No authenticated user found or user has no email');
		throw new Error('User must be authenticated to generate email');
	}

	let toEmail = await getContactEmail(event.main_contact || null, supabase);
	if (!toEmail) {
		console.warn('No contact email found. defaulting to empty.');
		toEmail = '';
	}

	const contactName = await getContactName(event.main_contact || null, supabase);
	const contactHasPhone = await hasContactPhone(event.main_contact || null, supabase);

	const artistName = event.artist_name || 'N/A';
	const eventDate = formatFullDate(event.event_date ?? null);
	const eventVenue = await resolveEventVenue(event, supabase);
	const fromEmail = user.email;
	const userName = user.user_metadata?.name || fromEmail.split('@')[0];
	const userFirstName = userName.split(' ')[0];

	const subject = `Advance // ${artistName} // ${eventDate} // ${eventVenue} Montreal`;

	const timetableContent = generateTimetableHtml(event.timetable || null);

	// BACKLINE — inherited from the nearest non-local artist in the timetable
	// (forward first, then backward). SFX is never included for a Local.
	const backline = await resolveLocalBackline({
		supabase,
		eventId: event.event_id,
		artistName,
		timetable: event.timetable ?? null
	});
	const backlineContent = buildBacklineHtml(backline.rider);

	if (backline.sourceArtist) {
		console.log(
			`Backline for ${artistName} inherited from ${backline.sourceArtist} (${backline.direction})`,
			backline.chain
		);
	} else {
		console.warn(`No backline source found for ${artistName}.`);
	}

	// Public invoice upload link (same link the Talent Payments panel shares).
	const invoiceUploadLink = await getInvoiceUploadLink(event, supabase);

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
	if (invoiceUploadLink) {
		bulletPoints += `<li>Please upload your invoice here: <a href="${invoiceUploadLink}">${invoiceUploadLink}</a></li>`;
	}

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
CC: allanah@produkt.ca, mezz@produkt.ca
X-Unsent: 1
Content-Type: text/html; charset=utf-8

${htmlBody}
`;

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
	_event: EventAdvance,
	_supabase: SupabaseClient
): Promise<boolean> {
	// Always true so the button is never disabled.
	return true;
}