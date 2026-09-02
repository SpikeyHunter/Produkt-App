// Food buyout: one shared parser/formatter so the hospo copy, the tech+hospo
// copy, the advance card and the liaison view all print the exact same line.
//
//   None         -> no line at all
//   Cash Buyout  -> "Food Buyout: 50$CAD cash"
//   Dinner       -> "Food Buyout: <free text>"
//   Room Credit  -> "Room Credit: 50$CAD/Artist & 25$CAD/Crew"
//                   (a 0$ side is left out)

export type FoodBuyoutType = 'buyout' | 'dinner' | 'room_credit' | null;

export interface FoodBuyout {
	type: FoodBuyoutType;
	details: string;
	artist?: number; // room credit, per artist
	crew?: number; // room credit, per crew
}

export function parseFoodBuyout(raw: any): FoodBuyout {
	let parsed: any = raw;
	try {
		if (typeof parsed === 'string') parsed = JSON.parse(parsed);
		if (typeof parsed === 'string') parsed = JSON.parse(parsed);
	} catch {
		parsed = null;
	}
	if (!parsed || typeof parsed !== 'object') return { type: null, details: '' };
	return {
		type: parsed.type ?? null,
		details: parsed.details ?? '',
		artist: Number(parsed.artist) || 0,
		crew: Number(parsed.crew) || 0
	};
}

/** "50$", "$50", "50 CAD", "50" -> "50" */
function amountOf(text: string): string {
	const m = String(text || '').match(/\d+(?:[.,]\d+)?/);
	return m ? m[0].replace(',', '.') : '';
}

/** Text after "- " on the hospo list, or null when nothing should print. */
export function formatFoodBuyoutLine(fb: FoodBuyout | null | undefined): string | null {
	if (!fb || !fb.type) return null;
	if (fb.type === 'buyout') {
		const amt = amountOf(fb.details);
		return amt ? `Food Buyout: ${amt}$CAD cash` : 'Food Buyout: cash';
	}
	if (fb.type === 'dinner') {
		const txt = String(fb.details || '').trim();
		return txt ? `Food Buyout: ${txt}` : 'Food Buyout: Dinner';
	}
	if (fb.type === 'room_credit') {
		const parts: string[] = [];
		if ((Number(fb.artist) || 0) > 0) parts.push(`${Number(fb.artist)}$CAD/Artist`);
		if ((Number(fb.crew) || 0) > 0) parts.push(`${Number(fb.crew)}$CAD/Crew`);
		if (parts.length === 0) return null;
		return `Room Credit: ${parts.join(' & ')}`;
	}
	return null;
}
