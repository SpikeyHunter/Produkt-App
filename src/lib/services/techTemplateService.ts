// src/lib/services/techTemplateService.ts
import type {
	EmailTechEvent,
	TimetableEntry,
	TechRider,
	SfxRider,
	SoundcheckInfo,
	RoleInfo,
	CrewAssignments,
	CrewMember
} from '$lib/types/emailtech';

function parseJson<T>(data: any, defaultValue: T): T {
	if (!data) return defaultValue;
	if (typeof data === 'string') {
		try {
			return JSON.parse(data) as T;
		} catch {
			return defaultValue;
		}
	}
	return data as T;
}

function formatFullDate(dateStr: string | null): string {
	if (!dateStr) return 'TBD';
	try {
		const date = new Date(dateStr);
		const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December'
		];
		const dayName = days[date.getDay()];
		const month = months[date.getMonth()];
		const day = date.getDate();
		const year = date.getFullYear();
		const suffix = day > 3 && day < 21 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10] || 'th';
		return `${dayName} ${month} ${day}${suffix} ${year}`;
	} catch {
		return dateStr;
	}
}

function formatTime(time: string): string {
	if (!time) return '';
	const [hours, minutes] = time.split(':');
	const h = parseInt(hours);
	const ampm = h >= 12 ? 'PM' : 'AM';
	const displayHour = h % 12 || 12;
	return `${displayHour}:${minutes}${ampm}`;
}

// ============= SECTION BUILDERS =============

export function buildHeader(events: EmailTechEvent[]): string {
	const mainEvent = events[0];
	const eventNames = events.map((e) => e.event_name).join(' & ');
	const eventDate = formatFullDate(mainEvent.event_date);

	const dosName = mainEvent.dos || 'TBD';
	const dosText = dosName === 'TBD' ? highlight(dosName) : dosName;

	let dosLine = `Please note <strong>${dosText}</strong> will be working with you for this show`;

	if (events.length === 2) {
		const bazartEvent = events.find((e) => e.event_venue === 'Bazart');
		if (bazartEvent) {
			const bazartDos = bazartEvent.dos || 'TBD';
			const bazartDosText = bazartDos === 'TBD' ? highlight(bazartDos) : bazartDos;
			dosLine += ` and ${bazartDosText} at Bazart`;
		}
	}

	dosLine += '.';

	return `<p>Hello everyone,<br>Here are the info for <strong>${eventNames}, ${eventDate}</strong></p>
            <p>${dosLine}</p>
            <p>&nbsp;</p>`;
}

// Replace the buildCrewCall function in techTemplateService.ts

export function buildCrewCall(
	events: EmailTechEvent[],
	crewAssignments: CrewAssignments,
	allCrewMembers: CrewMember[] = [],
	storedHtmlContent?: string
): string {
	let content = '<p><strong>Crew call:</strong></p>';

	const validCrewNames = new Set(allCrewMembers.map((m) => m.name));

	// Extract what's currently in the stored HTML to compare
	const extractCrewFromHtml = (html: string): { crew7pm: Set<string>; crew830pm: Set<string> } => {
		const crew7pm = new Set<string>();
		const crew830pm = new Set<string>();

		if (!html) return { crew7pm, crew830pm };

		// Match the crew_call section
		const crewCallMatch = html.match(/<div[^>]*data-section="crew_call"[^>]*>([\s\S]*?)<\/div>/i);
		if (!crewCallMatch) return { crew7pm, crew830pm };

		const crewCallContent = crewCallMatch[1];

		// Extract 7pm crew - remove all HTML tags first
		const sevenPmMatch = crewCallContent.match(/7pm:\s*([\s\S]*?)(?:<\/p>|8:30pm)/i);
		if (sevenPmMatch) {
			const cleanText = sevenPmMatch[1].replace(/<[^>]*>/g, '').trim();
			const names = cleanText
				.split(',')
				.map((n) => n.trim())
				.filter((n) => n && n !== 'TBD');
			names.forEach((name) => crew7pm.add(name));
		}

		// Extract 8:30pm crew
		const eightThirtyMatch = crewCallContent.match(/8:30pm:\s*([\s\S]*?)(?:<\/p>|$)/i);
		if (eightThirtyMatch) {
			const cleanText = eightThirtyMatch[1].replace(/<[^>]*>/g, '').trim();
			const names = cleanText
				.split(',')
				.map((n) => n.trim())
				.filter((n) => n && n !== 'TBD');
			names.forEach((name) => crew830pm.add(name));
		}

		return { crew7pm, crew830pm };
	};

	const storedCrew = storedHtmlContent
		? extractCrewFromHtml(storedHtmlContent)
		: { crew7pm: new Set(), crew830pm: new Set() };

	const processRoles = (roles: (keyof CrewAssignments)[], storedNames: Set<string>): string => {
		// Get current crew from DB/UI
		const currentDbNames = new Set<string>();
		roles.forEach((role) => {
			const assignedNames = crewAssignments[role] || [];
			assignedNames.forEach((fullName) => {
				const firstName = fullName.split(' ')[0];
				currentDbNames.add(firstName);
			});
		});

		// If nothing in DB and nothing stored, show TBD
		if (currentDbNames.size === 0 && storedNames.size === 0) {
			return highlight('TBD');
		}

		// If nothing in DB but something stored, use DB (which is empty = TBD)
		if (currentDbNames.size === 0) {
			return highlight('TBD');
		}

		// Build the final list - ONLY use current DB names (no duplicates)
		return Array.from(currentDbNames)
			.sort((a, b) => a.localeCompare(b))
			.map((firstName) => {
				const isInStored = storedNames.has(firstName);

				// Only highlight if there's a mismatch AND we have stored content
				if (storedHtmlContent && !isInStored) {
					// Name is in DB but NOT in stored HTML (new or changed)
					return highlight(firstName, '#FCA5A5');
				}

				// Check if name was previously highlighted in stored HTML
				if (storedHtmlContent) {
					const wasHighlighted = new RegExp(`<mark[^>]*>\\s*${firstName}\\s*<\\/mark>`, 'i').test(
						storedHtmlContent
					);

					if (wasHighlighted && isInStored) {
						// Was highlighted before and still matches - keep highlight
						return highlight(firstName, '#FCA5A5');
					}
				}

				// No highlight needed - name matches
				return firstName;
			})
			.join(', ');
	};

	const roles7pm: (keyof CrewAssignments)[] = ['LD', 'Video', 'Sound', 'DT', 'Stage/Tech'];
	const roles830pm: (keyof CrewAssignments)[] = ['VJ'];

	const crew7pmText = processRoles(roles7pm, storedCrew.crew7pm as Set<string>);
	const crew830pmText = processRoles(roles830pm, storedCrew.crew830pm as Set<string>);

	content += `<p>7pm: ${crew7pmText}</p>`;

	if (crew830pmText !== highlight('TBD') && crew830pmText.trim() !== '') {
		content += `<p>8:30pm: ${crew830pmText}</p>`;
	}
	content += `<p>&nbsp;</p>`;

	return content;
}

// Update the helper function to ensure proper text color
function highlight(text: string, color: string = '#FCA5A5'): string {
	// Always use black text color for highlighted content
	return `<mark style="background-color: ${color}; color: #212121; padding: 2px 4px; border-radius: 3px;">${text}</mark>`;
}

function linkify(text: string, urlMap: Record<string, string>): string {
	if (!text) return '';

	const urlRegex = /(https?:\/\/[^\s]+)/g;
	const shortUrlBase = 'https://link.produkt.ca/';

	return text.replace(urlRegex, (foundUrl) => {
		// Check if the found URL has a custom slug in our map
		const customSlug = urlMap[foundUrl];

		if (customSlug) {
			// If it does, build the custom display text
			const displayText = shortUrlBase + customSlug;
			return `<a href="${foundUrl}" style="color: #E1FF00; text-decoration: underline;">${displayText}</a>`;
		} else {
			// Otherwise, just display the original URL
			return `<a href="${foundUrl}" style="color: #E1FF00; text-decoration: underline;">${foundUrl}</a>`;
		}
	});
}

export function buildProjects(events: EmailTechEvent[]): string {
	let content = '<p><strong>Projects:</strong></p>';

	// --- Define your mapping of long URLs to custom names here ---
	const customUrlMappings = {
		'https://drive.google.com/drive/folders/1RnDCHdyL0f6ClkOtpgUnRZNIUiZeYHMG': 'ncg-projo',
		'https://link.produkt.ca/ncg-tv': 'ncg-tv'
	};
	// ----------------------------------------------------------------

	const ncgEvent = events.find((e) => e.event_venue === 'New City Gas');
	const bazartEvent = events.find((e) => e.event_venue === 'Bazart');

	if (ncgEvent) {
		content += '<p><strong>Main Room</strong></p>';
		content += `<ul><li>${highlight('Project TBD')}</li></ul>`;
		content += `<p>&nbsp;</p>`;
	}

	if (bazartEvent) {
		content += '<p>Lounge</p>';
		content += `<ul><li>${highlight('Project TBD')}</li></ul>`;
		content += `<p>&nbsp;</p>`;
	}

	const videoCrewName = events[0]?.crew?.Video;
	if (videoCrewName && videoCrewName.length > 0) {
		const firstName = videoCrewName[0].split(' ')[0];
		content += `<p>@${firstName}</p>`;
	}

	const projectorDetails =
		'9:30pm: Logo NCG https://drive.google.com/drive/folders/1RnDCHdyL0f6ClkOtpgUnRZNIUiZeYHMG';
	content += '<p>Projecteur extérieur:</p>';
	content += `<ul><li>${linkify(projectorDetails, customUrlMappings)}</li></ul>`;
	content += `<p>&nbsp;</p>`;

	// --- This section has been updated ---
	const tvsVisualsText =
		'Visuals for TVS and Interior Projector:<br>TVS Main room: https://link.produkt.ca/ncg-tv';
	content += `<p>${linkify(tvsVisualsText, customUrlMappings)}</p>`;
	// ------------------------------------

	content += '<p>NCG: Folder #1 + Show artwork #3<br>Please remove show artworks at 12am</p>';
	content += `<p>&nbsp;</p>`;
	return content;
}

export function buildSetTimes(events: EmailTechEvent[]): string {
	let content = '<p><strong>Set Times:</strong></p>';

	const ncgEvent = events.find((e) => e.event_venue === 'New City Gas');
	const bazartEvent = events.find((e) => e.event_venue === 'Bazart');

	if (ncgEvent?.timetable) {
		const timetable = parseJson<TimetableEntry[]>(ncgEvent.timetable, []);
		if (timetable.length > 0) {
			content += '<p>Main Room - Set times:</p><ul>';
			timetable.forEach((entry) => {
				content += `<li>${entry.time} - ${entry.artist}</li>`;
			});
			content += '</ul>';
		}
	}

	if (bazartEvent?.timetable) {
		const timetable = parseJson<TimetableEntry[]>(bazartEvent.timetable, []);
		if (timetable.length > 0) {
			content += '<p>Lounge - Set times:</p><ul>';
			timetable.forEach((entry) => {
				content += `<li>${entry.time} - ${entry.artist}</li>`;
			});
			content += '</ul>';
		}
	}

	return content;
}

export function buildSoundcheck(events: EmailTechEvent[]): string {
	let soundchecks: Array<{ artist: string; startTime: string; endTime: string }> = [];

	events.forEach((event) => {
		if (event.soundcheck) {
			const sc = parseJson<SoundcheckInfo>(event.soundcheck, { status: 'no' });
			if (sc.status === 'yes' && sc.start_time && sc.end_time) {
				soundchecks.push({
					artist: event.artist_name,
					startTime: formatTime(sc.start_time),
					endTime: formatTime(sc.end_time)
				});
			}
		}
	});

	if (soundchecks.length === 0) {
		return '<p><strong>Soundcheck/Video/Programmation:</strong> NO</p>';
	}

	soundchecks.sort((a, b) => a.startTime.localeCompare(b.startTime));

	let content = '<p><strong>Soundcheck/Video/Programmation:</strong></p><ul>';
	soundchecks.forEach((sc) => {
		content += `<li>${sc.artist}: ${sc.startTime}-${sc.endTime}</li>`;
	});
	content += '</ul>';

	return content;
}

export function buildBazart(events: EmailTechEvent[]): string {
	const hasBazart = events.some((e) => e.event_venue === 'Bazart');

	let content = '<p><strong>Bazart:</strong></p>';

	if (hasBazart) {
		content += '<p>Terrace: 5pm: Playlist / 12am: Bazart Music</p>';
		content += '<p>Lounge: 5pm: Playlist / 10pm: Bazart Music</p>';
	} else {
		content += '<p>Terrace: 5pm: Playlist / 12am: Main Room Music</p>';
		content += '<p>Lounge: 5pm: Playlist / 10pm: Main Room Music</p>';
	}

	return content;
}

export function buildRider(events: EmailTechEvent[]): string {
	let content = '<p><strong>ALL TECH RIDERS ATTACHED</strong></p>';

	const ncgEvent = events.find((e) => e.event_venue === 'New City Gas');
	const bazartEvent = events.find((e) => e.event_venue === 'Bazart');

	if (ncgEvent?.tech_rider) {
		const rider = parseJson<TechRider>(ncgEvent.tech_rider, {});
		content += '<p><strong>NCG BACKLINE</strong></p><ul>';

		if (rider.selected_mixer) {
			content += `<li>1x ${rider.selected_mixer}</li>`;
		}

		if (rider.equipment) {
			Object.entries(rider.equipment).forEach(([item, details]) => {
				if (details.selected) {
					content += `<li>${details.qty}x ${item}</li>`;
				}
			});
		}

		if (rider.other && rider.other.length > 0) {
			rider.other.forEach((item) => {
				content += `<li>${item.text}</li>`;
			});
		}

		content += '</ul>';
	}

	if (bazartEvent?.tech_rider) {
		const rider = parseJson<TechRider>(bazartEvent.tech_rider, {});
		content += '<p><strong>Bazart BACKLINE</strong></p><ul>';

		if (rider.selected_mixer) {
			content += `<li>1x ${rider.selected_mixer} (TBD might change)</li>`;
		}

		if (rider.equipment) {
			Object.entries(rider.equipment).forEach(([item, details]) => {
				if (details.selected && item.includes('CDJ')) {
					content += `<li>${details.qty}x ${item}</li>`;
				}
			});
		}

		content += '</ul>';
	}

	return content;
}

export function buildTravellingParty(events: EmailTechEvent[]): string {
	let content = '<p><strong>Travelling party:</strong></p>';

	const ncgEvent = events.find((e) => e.event_venue === 'New City Gas');
	const bazartEvent = events.find((e) => e.event_venue === 'Bazart');

	const processEvent = (event: EmailTechEvent) => {
		if (!event.roles) return '';

		const roles = parseJson<RoleInfo[]>(event.roles, []);
		if (roles.length === 0) return '';

		let eventContent = `<p><strong>${event.artist_name}</strong></p><ul>`;

		roles.forEach((role) => {
			const name = role.firstName;
			const roleName = role.customRole || role.role;
			eventContent += `<li>${name} - ${roleName}</li>`;
		});

		eventContent += '</ul>';
		return eventContent;
	};

	if (ncgEvent) content += processEvent(ncgEvent);
	if (bazartEvent) content += processEvent(bazartEvent);

	return content;
}

export function buildVJSchedule(
	events: EmailTechEvent[],
	crewAssignments: CrewAssignments
): string {
	let content = '<p><strong>VJ:</strong></p>';

	const mainEvent = events[0];
	if (!mainEvent?.timetable) {
		content += '<p>TBD</p>';
		return content;
	}

	const timetable = parseJson<TimetableEntry[]>(mainEvent.timetable, []);
	// FIX: Handle VJ being an array
	const houseVJ = crewAssignments.VJ?.join(', ') || 'VJ NAME';

	content += '<ul>';
	timetable.forEach((entry, index) => {
		if (entry.artist === 'DOORS') {
			const nextEntry = timetable[index + 1];
			if (nextEntry) {
				content += `<li>${entry.time}-${nextEntry.time} - ${houseVJ}</li>`;
			}
		} else if (entry.artist !== 'CURFEW') {
			content += `<li>${entry.time} - ${entry.artist}</li>`;
		}
	});
	content += '</ul>';

	return content;
}

export function buildLights(crewAssignments: CrewAssignments): string {
	// FIX: Handle LD being an array
	const ldName = crewAssignments.LD?.join(', ') || 'LD NAME';

	let content = '<p><strong>Lights:</strong></p>';
	content += '<p>Niveau 1 et terrace: Bazart Colours - 5pm-3am</p>';
	content += `<p>Lounge: 5pm-3am: Bazart Colours + Red Corridor @${ldName}</p>`;
	content += '<p>Facade: 5pm-3am: Red</p>';
	content += '<p>Main room: Red</p>';
	content += '<p>Lasers GA entrance outside: 10pm: Red</p>';

	return content;
}

export function buildSFX(events: EmailTechEvent[]): string {
	let sfxLines: string[] = [];

	const artistTypes = ['Headliner', 'Support', 'Local'];

	artistTypes.forEach((type) => {
		events.forEach((event) => {
			if (event.artist_type === type && event.sfx_rider) {
				const sfx = parseJson<SfxRider>(event.sfx_rider, {});
				let parts: string[] = [];

				if (sfx.cryo_jets?.enabled) {
					const qty = sfx.cryo_jets.qty || 4;
					const duration = sfx.cryo_jets.duration;
					parts.push(`${qty}x CO2 - ${duration} sec`);
				}

				if (sfx.sparkulars?.enabled) {
					const qty = sfx.sparkulars.qty || 4;
					const duration = sfx.sparkulars.duration;
					parts.push(`${qty}x Sparks - ${duration} sec`);
				}

				if (parts.length > 0) {
					sfxLines.push(`${event.artist_name}: ${parts.join(' / ')}`);
				}
			}
		});
	});

	if (sfxLines.length === 0) {
		return '<p><strong>Special FX:</strong> None</p>';
	}

	let content = '<p><strong>Special FX:</strong></p>';
	sfxLines.forEach((line) => {
		content += `<p>${line}</p>`;
	});

	return content;
}

export function buildFooter(): string {
	return `<p><strong>Sponsors and/or branding:</strong></p><p>${highlight('SPONSOR HERE')}</p><p><strong>After the show projects:</strong></p><p>${highlight('Project TBD')}</p><p>Please make sure your work space is clean THANK YOU! :)</p><p>Please confirm and let me know if you have any questions !</p><p>Thanks a lot,<br>Charles</p>`;
}

export const techTemplateSections = [
	{
		id: 'header',
		label: 'Header',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildHeader(events)
	},
	{
		id: 'crew_call',
		label: 'Crew Call',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildCrewCall(events, crew || {}, allCrew, storedHtml)
	},
	{
		id: 'projects',
		label: 'Projects',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildProjects(events)
	},
	{
		id: 'set_times',
		label: 'Set Times',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildSetTimes(events)
	},
	{
		id: 'soundcheck',
		label: 'Soundcheck',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildSoundcheck(events)
	},
	{
		id: 'bazart',
		label: 'Bazart',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildBazart(events)
	},
	{
		id: 'rider',
		label: 'Rider',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildRider(events)
	},
	{
		id: 'travelling_party',
		label: 'Travelling Party',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildTravellingParty(events)
	},
	{
		id: 'vj_schedule',
		label: 'VJ Schedule',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildVJSchedule(events, crew || {})
	},
	{
		id: 'lights',
		label: 'Lights',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildLights(crew || {})
	},
	{
		id: 'sfx',
		label: 'Special FX',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildSFX(events)
	},
	{
		id: 'footer',
		label: 'Footer',
		generator: (
			events: EmailTechEvent[],
			crew?: CrewAssignments,
			allCrew?: CrewMember[],
			storedHtml?: string
		) => buildFooter()
	}
];
