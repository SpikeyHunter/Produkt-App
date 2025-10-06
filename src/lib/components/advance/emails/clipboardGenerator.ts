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

		techText.push('Backline confirmed:');
		techHtml.push('<strong><u>Backline confirmed:</u></strong>');

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

		// **FIX: Added logic for "Other Requests"**
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
	if (
		sfxRider &&
		(sfxRider.cryo_jets?.enabled || sfxRider.sparkulars?.enabled || sfxRider.lasers?.enabled)
	) {
		const sfxText: string[] = [];
		const sfxHtml: string[] = [];

		sfxText.push('SFX:');
		sfxHtml.push('<strong><u>SFX:</u></strong>');

		if (sfxRider.sparkulars?.enabled) {
			sfxText.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${sfxRider.sparkulars.duration}sec`);
			sfxHtml.push(`- ${sfxRider.sparkulars.qty}x Sparkulars - ${sfxRider.sparkulars.duration}sec`);
		}
		if (sfxRider.cryo_jets?.enabled) {
			sfxText.push(`- ${sfxRider.cryo_jets.qty}x Co2 - ${sfxRider.cryo_jets.duration}sec`);
			sfxHtml.push(`- ${sfxRider.cryo_jets.qty}x Co2 - ${sfxRider.cryo_jets.duration}sec`);
		}
		if (sfxRider.lasers?.enabled) {
			sfxText.push(`- ${sfxRider.lasers.qty}x Lasers`);
			sfxHtml.push(`- ${sfxRider.lasers.qty}x Lasers`);
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
		hospoText.push(`${event.event_venue || 'Venue'} will provide:`);
		hospoHtml.push(`${event.event_venue || 'Venue'} will provide:`);
		hospoText.push('- 1x shared green room');
		hospoHtml.push('- 1x shared green room');

		const selectedSpirits = Object.entries(hospoRider.spirits || {}).filter(
			([, item]: [string, any]) => item.selected
		);
		selectedSpirits.forEach(([name, item]: [string, any]) => {
			const line = `- ${item.qty || 1}x ${name}`;
			hospoText.push(line);
			hospoHtml.push(line);
		});

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

		// Add the static food buyout line from your request
		const buyoutLine = '- Food Buyout: 50$CAD cash';
		hospoText.push(buyoutLine);
		hospoHtml.push(buyoutLine);

		parts.text.push(hospoText.join('\n'));
		parts.html.push(hospoHtml.join('<br>'));
	}

	// --- Guestlist ---
	const guestlistText = [
		'Guestlist:',
		'- You can have 10x VIP and 10x GA guest. Names need to be sent by email or to DOS contact before 7pm on day of show.'
	].join('\n');
	const guestlistHtml = [
		'<strong><u>Guestlist:</u></strong>',
		'- You can have 10x VIP and 10x GA guest. Names need to be sent by email or to DOS contact before 7pm on day of show.'
	].join('<br>');
	parts.text.push(guestlistText);
	parts.html.push(guestlistHtml);

	// --- Final Assembly ---
	const fullText = parts.text.join('\n\n');
	const fullHtml = `<div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 9pt;">${parts.html.join('<br><br>')}</div>`;

	return { text: fullText, html: fullHtml };
}