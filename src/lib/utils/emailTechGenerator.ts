import type { EmailTechEvent, TechEmailForm, TimetableEntry } from '$lib/types/emailtech';
import { formatDate } from './emailGenerator';

/**
 * Generates the Tech Email Filename
 * Format: Email-Tech_[Event_Name]
 */
export function generateTechFileName(events: EmailTechEvent[]): string {
	const mainEvent = events.find((e) => e.event_venue === 'New City Gas') || events[0];
	if (!mainEvent) return 'Email-Tech_Export';

	let name = mainEvent.event_name || mainEvent.artist_name || 'Event';
	name = name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');

	return `Email-Tech_${name}`;
}

/**
 * Helper: Converts "19:00" -> "7PM" or "19:30" -> "7:30PM"
 */
function formatCrewTime(timeStr: string): string {
	if (!timeStr) return '';
	const [h, m] = timeStr.split(':').map(Number);
	if (isNaN(h)) return timeStr;

	const ampm = h >= 12 ? 'PM' : 'AM';
	const h12 = h % 12 || 12;
	const mStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;

	return `${h12}${mStr}${ampm}`;
}

/**
 * Generates the Tech Email Body HTML
 */
export function generateTechEmailString(
	events: EmailTechEvent[],
	form: TechEmailForm,
	senderName: string
): string {
	const mainEvent = events.find((e) => e.event_venue === 'New City Gas') || events[0];
	const dateStr = formatDate(mainEvent?.event_date || null);
	const titleNames = events.map((e) => e.event_name || e.artist_name).join(' / ');

	const videoCrew = mainEvent.crew?.['Video'] || [];
	const videoName = videoCrew.length > 0 ? videoCrew[0].split(' ')[0] : 'Video';

	let html = `<div style="font-family: sans-serif; font-size: 10pt; color: #000; line-height: 1.3;">`;

	// --- HEADER ---
	html += `<p style="margin: 0 0 10px 0;">Hello everyone,</p>
             <p style="margin: 0 0 10px 0;">Here are the info for <strong>${titleNames} - ${dateStr}</strong><br>
             Please note <strong>${form.liaison || 'Charles'}</strong> will be working with you for this show.</p>`;

	// --- CREW CALL ---
	if (form.crew_calls.length > 0) {
		html += `<p style="margin: 0;"><strong>Crew call:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;
		form.crew_calls.forEach((call) => {
			if (call.time && call.names) {
				html += `${formatCrewTime(call.time)}: ${call.names}<br>`;
			}
		});
		html += `</div>`;
	}

	// --- TEAM NOTES ---
	if (form.team_notes && form.team_notes.trim()) {
		html += `<p style="margin: 0 0 10px 0;">${form.team_notes.replace(/\n/g, '<br>')}</p>`;
	}

	// --- SPECS ---
	if (form.specs_links.length > 0) {
		html += `<div style="margin: 0 0 10px 0;">`;
		form.specs_links.forEach((l) => {
			if (l.label && l.url) {
				html += `<strong>${l.label}</strong>: <a href="${l.url}">${l.url}</a><br>`;
			}
		});
		html += `</div>`;
	}

	// --- PROJECTS ---
	if (form.projects.length > 0 && form.projects.some((p) => p.trim())) {
		html += `<br><p style="margin: 0;"><strong>Projects:</strong></p>
                 <div style="margin: 0 0 5px 0;">`; // Reduced bottom margin to flow into Outdoor
		form.projects.forEach((p) => {
			if (p.trim()) html += `${p}<br>`; // Plain lines based on sample
		});
		html += `</div>`;
	}

	// --- VISUALS (Outdoor) ---
	// Added <br> for spacing before this section
	// Added <strong> around the name
	if (form.projector_outdoor) {
		html += `<br><p style="margin: 0;"><strong>@${videoName}</strong></p>
                 <p style="margin: 0;"><strong>Projecteur extérieur:</strong></p>
                 <p style="margin: 0 0 10px 0;">${form.projector_outdoor.replace(/\n/g, '<br>')}</p>`;
	}

	// --- VISUALS (Interior) ---
	if (form.visuals_interior) {
		html += `<p style="margin: 0;"><strong>Visuals for TVS and Interior Projector:</strong></p>
                 <p style="margin: 0 0 10px 0;">${form.visuals_interior.replace(/\n/g, '<br>')}</p>`;
	}

	// --- SET TIMES ---
	const isHeadliner = (entry: TimetableEntry) => {
		// Casting as any to bypass TS error since TimetableEntry is missing artist_type
		return (entry as any).artist_type === 'Headliner';
	};

	const mainSetTimes = form.set_times.find(
		(st) => st.venue.includes('Main') || st.venue.includes('New City Gas')
	);
	if (mainSetTimes && mainSetTimes.entries.length > 0) {
		html += `<br><p style="margin: 0;"><strong style="text-decoration: underline;">Main Room - Set times:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;
		mainSetTimes.entries.forEach((t) => {
			const line = `${t.time} - ${t.artist}`;
			if (isHeadliner(t)) {
				html += `<strong>${line}</strong><br>`;
			} else {
				html += `${line}<br>`;
			}
		});
		html += `</div>`;
	}

	// Other stages
	form.set_times.forEach((st) => {
		if (!st.venue.includes('Main') && !st.venue.includes('New City Gas') && st.entries.length > 0) {
			html += `<br><p style="margin: 0;"><strong style="text-decoration: underline;">${st.venue} - Set times:</strong></p>
                     <div style="margin: 0 0 10px 0;">`;
			st.entries.forEach((t) => {
				html += `${t.time} - ${t.artist}<br>`;
			});
			html += `</div>`;
		}
	});

	// --- SOUNDCHECK ---
	if (form.soundcheck) {
		html += `<br><p style="margin: 0;"><strong>Soundcheck/Video/Programmation:</strong></p>
                 <p style="margin: 0 0 10px 0;">${form.soundcheck.replace(/\n/g, '<br>')}</p>`;
	}

	// --- LOUNGE AMBIANCE ---
	const l = form.lounge_ambiance;
	if (l && (l.terrasse_type || l.lounge_option || l.lounge_custom)) {
		html += `<br><p style="margin: 0;"><strong>Bazart:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;

		if (l.terrasse_type) {
			const tName = l.terrasse_type === 'back-side' ? 'Back-Side Terrace' : 'Back Terrace';
			let tVal = l.terrasse_option === 'Other' ? l.terrasse_custom : l.terrasse_option;
			if (!tVal) tVal = 'No Music';
			html += `${tName}: ${tVal}<br>`;
		}
		if (l.lounge_option || l.lounge_custom) {
			let lVal = l.lounge_option === 'Other' ? l.lounge_custom : l.lounge_option;
			if (!lVal) lVal = 'No Music';
			html += `Lounge: ${lVal}<br>`;
		}
		html += `</div>`;
	}

	// --- RIDERS ---
	if (form.riders_attached) {
		html += `<br><p style="margin: 0 0 10px 0;"><strong>ALL TECH RIDERS ATTACHED</strong></p>`;
	}

	// --- BACKLINE ---
	if (form.backline.length > 0) {
		form.backline.forEach((b) => {
			if (b.items.length > 0) {
				html += `<p style="margin: 0;"><strong>BACKLINE ${b.venue.toUpperCase()}</strong></p>
                         <div style="margin: 0 0 10px 0;">`;
				b.items.forEach((item) => {
					// NEW: Added the "- " prefix before the item
					html += `- ${item}<br>`;
				});
				html += `</div>`;
			}
		});
	}

	// --- TRAVELLING PARTY ---
	if (form.travelling_party) {
		html += `<br><p style="margin: 0;"><strong>Travelling party:</strong></p>
                 <p style="margin: 0 0 10px 0;">${form.travelling_party.replace(/\n/g, '<br>')}</p>`;
	}

	// --- VJ ---
	if (form.vj_schedule) {
		html += `<br><p style="margin: 0;"><strong>VJ:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;
		form.vj_schedule.split('\n').forEach((line) => {
			if (line.trim()) html += `• ${line}<br>`;
		});
		html += `</div>`;
	}

	// --- LIGHTS ---
	if (form.lights && form.lights.some((x) => x.color)) {
		html += `<br><p style="margin: 0;"><strong>Lights:</strong></p>
                 <div style="margin: 0 0 10px 0;">`;
		form.lights.forEach((row) => {
			if (row.color) {
				html += `${row.area}: ${row.color}<br>`;
			}
		});
		html += `</div>`;
	}

	// --- SFX ---
	if (form.sfx && form.sfx !== 'NONE') {
		html += `<br><p style="margin: 0;"><strong>SFX:</strong></p>
                 <div style="margin: 0 0 10px 0;">${form.sfx.replace(/\n/g, '<br>')}</div>`;
	}

	// --- SPONSORS ---
	const sponsorTxt = form.sponsor_name && form.sponsor_name !== 'None' ? form.sponsor_name : 'NONE';
	html += `<br><p style="margin: 0 0 10px 0;"><strong>Sponsors and/or branding:</strong> ${sponsorTxt}</p>`;

	// --- POST SHOW ---
	if (form.post_show) {
		html += `<br><p style="margin: 0;"><strong>After the show projects:</strong></p>
                 <p style="margin: 0 0 10px 0;">${form.post_show.replace(/\n/g, '<br>')}</p>`;
	}

	// --- CLOSING ---
	html += `<p style="margin: 0;">Please confirm and let me know if you have any questions !</p>
             <p style="margin: 10px 0 0 0;">Thanks a lot,<br>
             ${senderName}</p>`;

	html += `</div>`;
	return html;
}