import type { EventAdvance } from '$lib/services/eventsService';

// Helper to safely parse JSON data from the event object
function parseJson(data: any): any {
	if (!data) return null;
	if (typeof data === 'object') return data;
	if (typeof data === 'string') {
		try {
			return JSON.parse(data);
		} catch (e) {
			console.warn('Failed to parse JSON string:', e);
			return null;
		}
	}
	return null;
}

export function generateProductionClipboardMessage(event: EventAdvance) {
	const techRider = parseJson(event.tech_rider);
	const sfxRider = parseJson(event.sfx_rider);
	const hospoRider = parseJson(event.hospo_rider);

	let guestlist = event.guestlist;
	if (typeof guestlist === 'string') {
		guestlist = parseJson(guestlist);
	}

	const parts: { text: string[]; html: string[] } = { text: [], html: [] };

	// --- Tech Rider ---
	if (
		techRider &&
		(techRider.selected_mixer ||
			Object.values(techRider.equipment || {}).some((i: any) => i.selected) ||
			(techRider.other && techRider.other.length > 0))
	) {
		const techText: string[] = [];
		const techHtml: string[] = [];

		techText.push('Backline Confirmed:');
		techHtml.push('<strong><u>Backline Confirmed:</u></strong>');

		if (techRider.selected_mixer) {
			techText.push(`- 1x ${techRider.selected_mixer}`);
			techHtml.push(`- 1x ${techRider.selected_mixer}`);
		}
		for (const key in techRider.equipment) {
			const item = techRider.equipment[key];
			if (item.selected) {
				techText.push(`- ${item.qty || 1}x ${key}`);
				techHtml.push(`- ${item.qty || 1}x ${key}`);
			}
		}

		if (techRider.other) {
			techRider.other.forEach((req: { text: string }) => {
				if (req.text && req.text.trim()) {
					techText.push(`- ${req.text}`);
					techHtml.push(`- ${req.text}`);
				}
			});
		}

		parts.text.push(techText.join('\n'));
		parts.html.push(techHtml.join('<br>'));
	}

	// --- SFX ---
	const hasSfxOther = sfxRider?.other && Array.isArray(sfxRider.other) && sfxRider.other.length > 0;
	const hasStandardSfx =
		sfxRider &&
		(sfxRider.cryo_jets?.enabled || sfxRider.sparkulars?.enabled || sfxRider.lasers?.enabled);

	if (hasStandardSfx || hasSfxOther) {
		const sfxText: string[] = [];
		const sfxHtml: string[] = [];

		sfxText.push('SFX:');
		sfxHtml.push('<strong><u>SFX:</u></strong>');

		if (sfxRider?.sparkulars?.enabled) {
			sfxText.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${sfxRider.sparkulars.duration}sec`);
			sfxHtml.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${sfxRider.sparkulars.duration}sec`);
		}
		if (sfxRider?.cryo_jets?.enabled) {
			sfxText.push(`- ${sfxRider.cryo_jets.qty}x Co2 - ${sfxRider.cryo_jets.duration}sec`);
			sfxHtml.push(`- ${sfxRider.cryo_jets.qty}x Co2 - ${sfxRider.cryo_jets.duration}sec`);
		}
		if (sfxRider?.lasers?.enabled) {
			sfxText.push(`- ${sfxRider.lasers.qty}x Lasers`);
			sfxHtml.push(`- ${sfxRider.lasers.qty}x Lasers`);
		}

		if (hasSfxOther) {
			sfxRider.other.forEach((item: any) => {
				if (item.text) {
					sfxText.push(`- ${item.text}`);
					sfxHtml.push(`- ${item.text}`);
				}
			});
		}

		parts.text.push(sfxText.join('\n'));
		parts.html.push(sfxHtml.join('<br>'));
	}

	// --- Hospitality Rider ---
	if (hospoRider) {
		const hospoText: string[] = [];
		const hospoHtml: string[] = [];

		hospoText.push('Hospitality Rider:');
		hospoHtml.push('<strong><u>Hospitality Rider:</u></strong>');

		const venueName = event.event_venue || 'Venue';
		hospoText.push(`${venueName} will provide:`);
		hospoHtml.push(`${venueName} will provide:`);

		hospoText.push('- 1x shared green room');
		hospoHtml.push('- 1x shared green room');

		const processCategory = (category: any) => {
			if (!category) return;
			Object.entries(category).forEach(([name, item]: [string, any]) => {
				if (item.selected) {
					const line = `- ${item.qty || 1}x ${name}`;
					hospoText.push(line);
					hospoHtml.push(line);
				}
			});
		};

		processCategory(hospoRider.spirits);

		if (hospoRider.beers_wine) {
			processCategory(hospoRider.beers_wine.beers);
			processCategory(hospoRider.beers_wine.wine);
			processCategory(hospoRider.beers_wine.juice);
		}

		processCategory(hospoRider.other_drinks);

		if (hospoRider.base?.regular_drinks) {
			const line = '- Beers, RedBull, Water, Coconut water, Soft drinks';
			hospoText.push(line);
			hospoHtml.push(line);
		}
		if (hospoRider.base?.regular_snacks) {
			const line = '- Snacks: Proteins bar, Nuts, Gum, Chips, Granola bar, etc.';
			hospoText.push(line);
			hospoHtml.push(line);
		}

		const buyoutLine = '- Food Buyout: 50$CAD cash';
		hospoText.push(buyoutLine);
		hospoHtml.push(buyoutLine);

		parts.text.push(hospoText.join('\n'));
		parts.html.push(hospoHtml.join('<br>'));
	}

	// --- Guestlist ---
	const gaCount = guestlist?.ga || 0;
	const vipCount = guestlist?.vip || 0;

	const guestlistText = [
		'Guestlist:',
		`- You can have ${vipCount}x VIP and ${gaCount}x GA guest. Names need to be sent by email or to DOS contact before 7pm on day of show.`
	].join('\n');

	const guestlistHtml = [
		'<strong><u>Guestlist:</u></strong>',
		`- You can have ${vipCount}x VIP and ${gaCount}x GA guest. Names need to be sent by email or to DOS contact before 7pm on day of show.`
	].join('<br>');

	parts.text.push(guestlistText);
	parts.html.push(guestlistHtml);

	const fullText = parts.text.join('\n\n');
	const fullHtml = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${parts.html.join('<br><br>')}</div>`;

	return { text: fullText, html: fullHtml };
}

export function generateCOIMessage() {
	// Text version: Indented with spaces
	const text = [
		'COI Requirements',
		'   New City Gas',
		'   7350121 Canada Inc',
		'   950 ottawa Street',
		'   Montreal, Quebec',
		'   H3C 1S4',
		'', // Empty line
		'Photographers & Videographers',
		"Filming and photography by 3rd parties is only permitted at New City Gas with Produkt's prior written consent. Unless listed as an additional insured on Artist/Company’s policy, independent contractors must carry valid general liability insurance with a limit of no less than $1MM. Produkt & New City Gas will not be held responsible for loss, theft, or damage of equipment."
	].join('\n');

	// HTML version: Indented with div, explicit breaks added
	const addressBlock = [
		'New City Gas',
		'7350121 Canada Inc',
		'950 ottawa Street',
		'Montreal, Quebec',
		'H3C 1S4'
	].join('<br>');

	const htmlParts = [
		'<strong><u>COI Requirements</u></strong>',
		`<div style="margin-left: 20px;">${addressBlock}</div>`,
		'<br>',
		'<strong>Photographers & Videographers</strong>',
		'<br>', // FIX: Added this break so "Filming..." starts on a new line
		"Filming and photography by 3rd parties is only permitted at New City Gas with Produkt's prior written consent. Unless listed as an additional insured on Artist/Company’s policy, independent contractors must carry valid general liability insurance with a limit of no less than $1MM. Produkt & New City Gas will not be held responsible for loss, theft, or damage of equipment."
	];

	const html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${htmlParts.join('')}</div>`;

	return { text, html };
}

export function generateAudioSpecsMessage(venue?: string | null) {
	const isBazart = venue && venue.toLowerCase().includes('bazart');

	let text = '';
	let htmlParts: string[] = [];

	if (isBazart) {
		text = [
			'DJ Monitors:',
			'- In-booth monitoring consists of 02x EV ETX-12P powered speakers.',
			'- Kit is capable of delivering clean, distortion-free output at professional DJ levels.',
			'',
			'PA System:',
			'- The Lounge is equipped with a Meyer Sound system providing full coverage and tonal balance.',
			'- Setup combines UPA, UPQ, UPJ, Ultra-X40, and UPM series cabinets with 900-LFC subs.',
			'- Auxiliary hallway zones powered with 02x Crown CTs-3000.',
			'- Processing and control via Allen&Heath SQ5, BSS London Blu, and Meyer Galileo.',
			'- Kit is fully tuned, calibrated, and phase-aligned for the Lounge environment.'
		].join('\n');

		htmlParts = [
			'<strong><u>DJ Monitors:</u></strong>',
			'- In-booth monitoring consists of 02x EV ETX-12P powered speakers.<br>- Kit is capable of delivering clean, distortion-free output at professional DJ levels.',
			'<br>',
			'<strong><u>PA System:</u></strong>',
			'- The Lounge is equipped with a Meyer Sound system providing full coverage and tonal balance.<br>- Setup combines UPA, UPQ, UPJ, Ultra-X40, and UPM series cabinets with 900-LFC subs.<br>- Auxiliary hallway zones powered with 02x Crown CTs-3000.<br>- Processing and control via Allen&Heath SQ5, BSS London Blu, and Meyer Galileo.<br>- Kit is fully tuned, calibrated, and phase-aligned for the Lounge environment.'
		];
	} else {
		// Default (New City Gas)
		text = [
			'DJ Monitors:',
			'- In house DJ monitors consist of 6x Vertec VT4886 powered by a Crown iTech HD9000 and 2x JBL Professional ASB7128.',
			'- Kit is capable of generating 117dBA before limiting distortion free at DJ position.',
			'',
			'PA System:',
			'- The venue has an installed JBL Professional PA using the Application engineered series boxes for full coverage to within 2dB.',
			'- Subwoofers are arrayed in 3 separate cardioid clusters beneath the stage in properly ventilated chambers.',
			'- All drivers amplified with Crown iTech HD & Macro-Tech HD and managed by a Soundweb London Blu. Kit is fully calibrated and phase-aligned.'
		].join('\n');

		htmlParts = [
			'<strong><u>DJ Monitors:</u></strong>',
			'- In house DJ monitors consist of 6x Vertec VT4886 powered by a Crown iTech HD9000 and 2x JBL Professional ASB7128.<br>- Kit is capable of generating 117dBA before limiting distortion free at DJ position.',
			'<br>',
			'<strong><u>PA System:</u></strong>',
			'- The venue has an installed JBL Professional PA using the Application engineered series boxes for full coverage to within 2dB.<br>- Subwoofers are arrayed in 3 separate cardioid clusters beneath the stage in properly ventilated chambers.<br>- All drivers amplified with Crown iTech HD & Macro-Tech HD and managed by a Soundweb London Blu. Kit is fully calibrated and phase-aligned.'
		];
	}

	const html = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${htmlParts.join('<br>')}</div>`;

	return { text, html };
}