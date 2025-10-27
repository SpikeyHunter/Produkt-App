import type { EventAdvance, TimetableEntry } from '$lib/services/eventsService';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Generates an HTML table for the timetable.
 * This logic is adapted from AdvanceSetTimes.svelte for consistency.
 * @param timetable The timetable array or null.
 * @returns An HTML string of the table, or a fallback message.
 */
function generateTimetableHtml(timetable: TimetableEntry[] | null): string {
	// If timetable is missing, empty, or only contains entries with "TBD" times, show the fallback message.
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
			case 'Confirmed': return { bg: '#d9ead3', text: '#274e13' };
			case 'Proposed': return { bg: '#fce5cd', text: '#783f04' };
			case 'Tentative': return { bg: '#fff2cc', text: '#7f6000' };
			case 'Problem': return { bg: '#f4cccc', text: '#660000' };
			default: return { bg: '#ffffff', text: '#000000' };
		}
	};

	let html = '<table style="border-collapse: collapse; font-family: \'Helvetica Neue\', Helvetica, Arial, sans-serif; font-size: 13px; border: 0.5px solid #d1d5db;">';
	html += '<thead><tr style="background-color: #ffffff;">';
	html += '<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 75px;">Timetable</th>';
	html += '<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 40px;">Length</th>';
	html += '<th style="border: 0.5px solid #d1d5db; padding: 2px 6px; text-align: left; font-weight: bold; width: 225px;">Artist</th>';
	html += '</tr></thead>';
	html += '<tbody>';

	timetable.forEach((entry) => {
		const isSpecialEntry = entry.artist === 'DOORS' || entry.artist === 'CURFEW';
		const colors = isSpecialEntry ? { bg: '#ffffff', text: '#000000' } : getStatusColors(entry.status);
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
 * @param dateString The date string from the event object.
 * @returns The formatted date string.
 */
function formatFullDate(dateString: string | null): string {
    if (!dateString) return 'TBD';
    try {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
        return date.toLocaleDateString('en-US', options);
    } catch (error) {
        console.error('Error formatting full date:', error);
        return dateString;
    }
}

/**
 * Generates the .eml file for the main advance email.
 * @param event The event data object.
 * @param supabase The Supabase client instance.
 */
export async function generateAdvanceEmail(
    event: EventAdvance & { timetable?: TimetableEntry[] | null },
    supabase: SupabaseClient
) {
    // Get the authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || !user.email) {
        console.error('No authenticated user found or user has no email');
        throw new Error('User must be authenticated to generate email');
    }

    const artistName = event.artist_name || 'N/A';
    const eventDate = formatFullDate(event.event_date ?? null);
    const eventVenue = event.venue || 'TBD';
    
    const subject = `Advance // ${artistName} // ${eventDate} // ${eventVenue} Montreal`;

    // Get the authenticated user's email
    const fromEmail = user.email;
    const userName = user.user_metadata?.name || fromEmail.split('@')[0];

    const timetableContent = generateTimetableHtml(event.timetable || null);

    // Conditionally include the VJ line only if a venue is specified.
    const vjLine = event.venue ? `- Please send visuals/logo link for our VJ<br>` : '';

    // Using a template literal for the HTML body and cleaning it up.
    const htmlBody = `
        <p>Hi X,&nbsp;</p>
        <p>Hope you are well.&nbsp;I'll be your contact for advancing this show!</p>
        <p>See below for advance details&nbsp;needed:&nbsp;</p>
        
        <p>
            <u><b>Immigration:</b></u><br>
            - Please send passports and occupations for each member of the touring party.<br>
            - Role list<br>
            - Exemption letters will be sent once received for Immigration Canada<br>
        </p>

        <p>
            <u><b>Hotel:&nbsp;</b></u><br>
            - Please send a rooming list.&nbsp;<br>
            - Hotel will be <b>(X Hotel: W Hotel, Monville, or ALT)</b><br>
            - As per contract,&nbsp;<b>X rooms will be provided for Y night stay.</b> Should more rooms or additional days be required, we are happy to assist in booking, however payment will be at artist expense.&nbsp;<br>
            - Hotel to venue drive time: 10 min&nbsp;<br>
        </p>

        <p>
            <u><b>Ground transportation:&nbsp;</b></u><br>
            - Please send&nbsp;flights information<br>
            - Airport to hotel drive time: 30 min<br>
            - How long do you want to be at the airport before your departure flight?&nbsp;<br>
            - For traveling parties of 4 people and more, please&nbsp;confirm how much luggage you will be traveling&nbsp;with.&nbsp;<br>
            - If the artist and crew members are traveling on different flights, please make sure to send one contact person and phone number for each arrival flight.&nbsp;<br>
        </p>

        <p>
            <u><b>Production:&nbsp;</b></u><br>
            - Please send the day of show contact and phone number.&nbsp;<br>
            - Updated tech & hospitality rider&nbsp;<br>
            ${vjLine}
            - Will a soundcheck be required, and if so, how long?&nbsp;<br>
        </p>

        <p>
            <u><b>Media:&nbsp;</b></u><br>
            - Please advise if you're bringing your own photographer/videographer.<br>
            - Outside media using professional equipment must provide a valid COI (minimum requirements available on request)<br>
            - Any camera setup at FOH, DJ booth, or use of an audio recorder must be advanced and approved in advance<br>
            - Our in-house photo/video team (subject to availability) can capture content and share it with you after the show<br>
        </p>

        <p>
            <u><b>Run of Show:&nbsp;</b></u><br>
            - Please confirm set times below:
        </p>
        ${timetableContent}

        <p>*Artists and crew members must get an ETA to board the plane (except for Canadian and US Citizen)<br>Please confirm with your airline or visit <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html">https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta/apply.html</a></p>
        <p>Best,&nbsp;<br>${userName.charAt(0).toUpperCase() + userName.slice(1)}</p>
    `.replace(/\n/g, '').replace(/    /g, '').trim();

    const emlContent = `Subject: ${subject}
From: ${fromEmail}
To: 
CC: allanah@produkt.ca, janie@produkt.ca
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