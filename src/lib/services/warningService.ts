// src/lib/services/warningService.ts
import type { EmailTechEvent, CrewAssignments, SoundcheckInfo } from '$lib/types/emailtech';

// Helper to safely parse JSON data from the database
function parseJson<T>(data: any, defaultValue: T): T {
	if (typeof data === 'string') {
		try {
			return JSON.parse(data) as T;
		} catch {
			return defaultValue;
		}
	}
	return (data || defaultValue) as T;
}

// Helper to format time strings (e.g., 19:30 -> 7:30PM)
function formatTime(time: string): string {
	if (!time) return '';
	const [hours, minutes] = time.split(':');
	const h = parseInt(hours);
	const ampm = h >= 12 ? 'PM' : 'AM';
	const displayHour = h % 12 || 12;
	return `${displayHour}:${minutes}${ampm}`;
}

export interface Warning {
	sectionId: string;
	message: string;
	fix: (currentContent: string) => string;
}

/**
 * Detects if the soundcheck time displayed in the email matches the database.
 */
function detectSoundcheckWarnings(
	events: EmailTechEvent[],
	htmlContent: string
): Warning[] {
	const warnings: Warning[] = [];
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlContent, 'text/html');
	const soundcheckElement = doc.querySelector('[data-section-id="soundcheck"]');
	
	if (!soundcheckElement) return [];

	const isHidden = soundcheckElement.getAttribute('style')?.includes('display: none');
	if (isHidden) return [];

	const text = soundcheckElement.textContent || '';

	for (const event of events) {
		const sc = parseJson<SoundcheckInfo>(event.soundcheck, { status: 'no' });
		if (sc.status === 'yes' && sc.start_time && sc.end_time) {
			const expectedStart = formatTime(sc.start_time);
			const expectedEnd = formatTime(sc.end_time);
			const expectedText = `${expectedStart}-${expectedEnd}`;

			if (!text.includes(expectedText)) {
				warnings.push({
					sectionId: 'soundcheck',
					message: `Soundcheck time for ${event.artist_name} changed to ${expectedText}`,
					fix: (currentContent) => {
						const freshDoc = new DOMParser().parseFromString(currentContent, 'text/html');
						const el = freshDoc.querySelector(`[data-section-id="soundcheck"]`);
						if (!el) return currentContent;

						const regex = new RegExp(
							`(${event.artist_name}:\\s*)[\\d:]+\\s*(?:AM|PM)\\s*-\\s*[\\d:]+\\s*(?:AM|PM)`,
							'gi'
						);
						
						if (el.innerHTML.match(regex)) {
							el.innerHTML = el.innerHTML.replace(regex, `$1${expectedText}`);
							return freshDoc.body.innerHTML;
						}
						return currentContent;
					}
				});
			}
		}
	}
	return warnings;
}

function detectCrewCallWarnings(
	crewAssignments: CrewAssignments,
	htmlContent: string
): Warning[] {
	const warnings: Warning[] = [];
	const parser = new DOMParser();
	const doc = parser.parseFromString(htmlContent, 'text/html');
	const crewElement = doc.querySelector('[data-section-id="crew_call"]');
	
	if (!crewElement) return [];

	const isHidden = crewElement.getAttribute('style')?.includes('display: none');
	if (isHidden) return [];

	const text = crewElement.textContent || '';
	const roles7pm = ['LD', 'Video', 'Sound', 'Technician', 'DT', 'Stage Manager'];
	const assignedCrew = roles7pm
		.map((role) => crewAssignments[role as keyof CrewAssignments])
		.filter(Boolean);

	if (assignedCrew.length > 0 && text.includes('TBD')) {
		warnings.push({
			sectionId: 'crew_call',
			message: 'Crew members assigned but "TBD" still appears in crew call',
			fix: (currentContent) => {
				const freshDoc = new DOMParser().parseFromString(currentContent, 'text/html');
				const el = freshDoc.querySelector(`[data-section-id="crew_call"]`);
				if (!el) return currentContent;

				const crewNames = assignedCrew.flat().join(', ');
				el.innerHTML = el.innerHTML.replace(
					/TBD/gi,
					crewNames
				);
				return freshDoc.body.innerHTML;
			}
		});
	}

	return warnings;
}

export function checkAllWarnings(
	events: EmailTechEvent[],
	crew: CrewAssignments,
	content: string
): Warning[] {
	if (!content || events.length === 0) return [];
	let allWarnings: Warning[] = [];
	allWarnings.push(...detectSoundcheckWarnings(events, content));
	allWarnings.push(...detectCrewCallWarnings(crew, content));
	return allWarnings;
}