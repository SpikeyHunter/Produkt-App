// src/lib/utils/sectionParser.ts

/**
 * Extracts individual sections from full email content
 * Each section is clearly bounded by HTML structure
 */
export function extractSectionsFromContent(
	fullContent: string,
	activeSectionIds: string[] // Still useful for validation
): Record<string, string> {
	if (!fullContent || !fullContent.trim()) return {};

	const extracted: Record<string, string> = {};

	// Extract ALL sections, not just active ones
	const allSectionIds = [
		'header',
		'crew_call',
		'projects',
		'set_times',
		'soundcheck',
		'bazart',
		'rider',
		'travelling_party',
		'vj_schedule',
		'lights',
		'sfx',
		'footer'
	];

	const sectionMarkers: Record<string, RegExp> = {
		header: /<div[^>]*data-section="header"[^>]*>([\s\S]*?)<\/div>/i,
		crew_call: /<div[^>]*data-section="crew_call"[^>]*>([\s\S]*?)<\/div>/i,
		projects: /<div[^>]*data-section="projects"[^>]*>([\s\S]*?)<\/div>/i,
		set_times: /<div[^>]*data-section="set_times"[^>]*>([\s\S]*?)<\/div>/i,
		soundcheck: /<div[^>]*data-section="soundcheck"[^>]*>([\s\S]*?)<\/div>/i,
		bazart: /<div[^>]*data-section="bazart"[^>]*>([\s\S]*?)<\/div>/i,
		rider: /<div[^>]*data-section="rider"[^>]*>([\s\S]*?)<\/div>/i,
		travelling_party: /<div[^>]*data-section="travelling_party"[^>]*>([\s\S]*?)<\/div>/i,
		vj_schedule: /<div[^>]*data-section="vj_schedule"[^>]*>([\s\S]*?)<\/div>/i,
		lights: /<div[^>]*data-section="lights"[^>]*>([\s\S]*?)<\/div>/i,
		sfx: /<div[^>]*data-section="sfx"[^>]*>([\s\S]*?)<\/div>/i,
		footer: /<div[^>]*data-section="footer"[^>]*>([\s\S]*?)<\/div>/i
	};

	// Extract ALL sections regardless of active state
	for (const sectionId of allSectionIds) {
		const marker = sectionMarkers[sectionId];
		if (marker) {
			const match = fullContent.match(marker);
			if (match && match[1]) {
				extracted[sectionId] = match[1].trim();
			}
		}
	}

	return extracted;
}

/**
 * Merges template content with custom modifications
 * Preserves user edits while allowing dynamic data updates
 */
export function mergeSectionContent(
	templateContent: string,
	customContent: string | undefined,
	sectionId: string,
	isVisible: boolean = true // NEW parameter
): string {
	const displayStyle = isVisible ? '' : ' style="display:none;"';
	const wrappedTemplate = `<div data-section="${sectionId}"${displayStyle}>${templateContent}</div>`;

	if (customContent && customContent.trim() && customContent !== templateContent) {
		// Preserve existing display style if present, otherwise apply new one
		if (customContent.includes(`data-section="${sectionId}"`)) {
			if (!isVisible && !customContent.includes('display:none')) {
				return customContent.replace(
					`data-section="${sectionId}"`,
					`data-section="${sectionId}" style="display:none;"`
				);
			}
			if (isVisible && customContent.includes('display:none')) {
				return customContent.replace(/\s*style="display:none;"\s*/g, '');
			}
			return customContent;
		}
		return `<div data-section="${sectionId}"${displayStyle}>${customContent}</div>`;
	}

	return wrappedTemplate;
}

/**
 * Checks if content has been modified from template
 */
export function isContentModified(currentContent: string, templateContent: string): boolean {
	const normalize = (str: string) => str.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();

	return normalize(currentContent) !== normalize(templateContent);
}

/**
 * Updates a specific field within a section without rewriting the entire section
 */
export function updateSectionField(
	sectionContent: string,
	fieldName: string,
	newValue: string
): string {
	// Field markers for specific updates
	const fieldMarkers: Record<string, RegExp> = {
		LD: /(<p[^>]*>.*?LD[:\s]*<\/p>)/i,
		Video: /(<p[^>]*>.*?Video[:\s]*<\/p>)/i,
		VJ: /(<p[^>]*>.*?VJ[:\s]*<\/p>)/i,
		Sound: /(<p[^>]*>.*?Sound[:\s]*<\/p>)/i,
		'Stage Manager': /(<p[^>]*>.*?Stage Manager[:\s]*<\/p>)/i,
		Technician: /(<p[^>]*>.*?Technician[:\s]*<\/p>)/i,
		DT: /(<p[^>]*>.*?DT[:\s]*<\/p>)/i
	};

	const marker = fieldMarkers[fieldName];
	if (marker && sectionContent.match(marker)) {
		// Update only the specific field
		return sectionContent.replace(marker, `<p>${fieldName}: ${newValue}</p>`);
	}

	return sectionContent;
}
