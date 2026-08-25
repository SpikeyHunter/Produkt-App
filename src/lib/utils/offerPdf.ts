// offerPdf.ts
// Produkt offer sheet, laid out like the Prism sheet (centered masthead,
// offer summary band, Event Details | Event Summary two-column block, ticket
// scaling with Break Even, Expense Summary, Contacts, Deal Terms). Vector-
// rendered with jsPDF + autotable on US Letter (8.5x11in).
//
// Theme: app palette on a white sheet —
//   lime #E1FF00 · gray1 #2F2F2F · gray2 #BDBDBB · gray3 #E4E4E4

export interface OfferBandRow {
	label: string;
	note?: string; // small gray sub-line under the label
	value: string; // "$40,000.00 | CA$55,400.00"
	accent?: boolean; // tinted row (Guarantee)
	emphasis?: boolean; // bold row (Total Potential Payout)
}

export interface OfferKvRow {
	label: string;
	value: string;
	strong?: boolean;
	strike?: boolean; // crossed out (e.g. the losing side of a Versus deal)
	underline?: boolean; // bottom rule without bold
}

export interface OfferTicketRow {
	name: string;
	allotment: number;
	comps: number;
	sellable: number;
	price: number;
	breakEven: number | null; // offers only
	sold?: number; // settlements only
	gross: number;
}

export interface OfferExpenseGroup {
	title: string; // "Talent Pay" / "General > Venue"
	// 'expense' -> single amount column; 'bav' -> Budget | Actual | Variance
	mode?: 'expense' | 'bav';
	rows: { name: string; amount: number; budget?: number; variance?: number }[];
	total: number;
	budgetTotal?: number; // bav totals row
	varianceTotal?: number;
}

export interface OfferContactRow {
	name: string;
	role: string;
	email: string;
	phone: string;
}

export interface OfferPdfData {
	// 'offer' (default) or 'settlement' — settlement swaps labels, adds the
	// Sold column, Budget/Actual/Variance groups and the settlement signatures.
	variant?: 'offer' | 'settlement';
	offerNumber: number;
	generatedAt: Date;

	// Centered masthead
	artistName: string;
	dateLabel: string; // "September 6, 2026"
	role: string; // Headliner | Support
	venueName: string;
	venueRoom?: string;
	venueAddress: string[];
	logoUrl?: string; // white logo; inverted to black at render time
	logoFallbackUrl?: string; // already-dark logo (used as-is if the first fails)

	// Offer summary band
	fxNote?: string; // "(FX RATE USD = CAD/1.3850)"
	bandRightHeader?: string; // "Artist Walkout" (settlements) — FX note sits under it
	offerRows: OfferBandRow[];

	// Two-column block
	eventDetails: OfferKvRow[];
	eventSummary: OfferKvRow[];

	// Ticket scaling
	venueCurrency: string;
	tickets: OfferTicketRow[];
	scalingFooter: OfferKvRow[];

	// Expenses
	expenseSummaryLabel?: string; // "Split Point Summary" (split deals) — default "Expense Summary"
	expenseSummaryValue?: string; // "Total: CA$17,628.50" — default "Total Expenses CA$X"
	totalExpenses: number;
	fixedBandLabel: string; // "Fixed Expenses + Artist Payout"
	fixedBandTotal: number;
	expenseGroups: OfferExpenseGroup[];
	variableRows: { name: string; type: string; amount: string; potential: string }[];
	variableTotal: number;

	contacts: OfferContactRow[];

	dealTermsLine: string;
	depositLines?: string[]; // deposit schedule printed under the expiry line
	dealTermsContent?: string; // rich text (HTML) or plain — Deal Terms body
	termsAndConditions: string; // rich text (HTML) or plain ("# Heading" convention)
}

// --- palette ---
const BLACK: [number, number, number] = [17, 17, 17];
const GRAY1: [number, number, number] = [47, 47, 47];
const MUTED: [number, number, number] = [107, 107, 107];
const LINE: [number, number, number] = [216, 216, 216];
const RULE: [number, number, number] = [233, 233, 233];
const LIME: [number, number, number] = [225, 255, 0]; // #E1FF00 — accents only
const LIME_TINT: [number, number, number] = [249, 255, 219]; // low-opacity lime row bg
const BAR: [number, number, number] = [228, 228, 228]; // #E4E4E4 section bars
const BAR_SUB: [number, number, number] = [242, 242, 242]; // sub-bars

const PAGE_W = 8.5;
const PAGE_H = 11;
const MARGIN = 0.45;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOT_LIMIT = PAGE_H - 0.6;

export function currencyPrefix(code: string): string {
	if (code === 'CAD') return 'CA$';
	if (code === 'USD') return '$';
	if (code === 'EUR') return '€';
	if (code === 'GBP') return '£';
	return `${code} $`;
}

export function moneyNum(v: number): string {
	return (Number(v) || 0).toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}

function int(v: number): string {
	return (Number(v) || 0).toLocaleString('en-US');
}

/** Loads a logo, optionally inverting it to black (pixel-level, so it works
 *  where ctx.filter is unsupported), downscaled to keep the PDF small. */
async function loadLogo(
	url: string,
	invert: boolean
): Promise<{ dataUrl: string; w: number; h: number } | null> {
	try {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.src = url;
		await img.decode();
		const maxW = 900;
		const scale = Math.min(1, maxW / (img.naturalWidth || 1));
		const w = Math.max(1, Math.round(img.naturalWidth * scale));
		const h = Math.max(1, Math.round(img.naturalHeight * scale));
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return null;
		ctx.drawImage(img, 0, 0, w, h);
		if (invert) {
			const imageData = ctx.getImageData(0, 0, w, h);
			const px = imageData.data;
			for (let i = 0; i < px.length; i += 4) {
				px[i] = 255 - px[i];
				px[i + 1] = 255 - px[i + 1];
				px[i + 2] = 255 - px[i + 2];
			}
			ctx.putImageData(imageData, 0, 0);
		}
		return { dataUrl: canvas.toDataURL('image/png'), w, h };
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Terms rendering: rich text (HTML from the template editor) or plain text
// (legacy "# Heading" convention) parsed into simple blocks.
// ---------------------------------------------------------------------------

interface TermRun {
	text: string;
	bold: boolean;
	italic: boolean;
	underline: boolean;
}

interface TermBlock {
	kind: 'heading' | 'para' | 'bullet' | 'space';
	runs: TermRun[];
	indent: number; // 0-based indent level (execCommand indent / blockquote)
}

const BR_MARK = '\u0000';

export function parseTermBlocks(content: string): TermBlock[] {
	const trimmed = (content || '').trim();
	if (!trimmed) return [];

	const looksHtml = /<[a-z][\s\S]*>/i.test(trimmed);
	if (looksHtml && typeof DOMParser !== 'undefined') {
		const blocks: TermBlock[] = [];
		const docHtml = new DOMParser().parseFromString(trimmed, 'text/html');

		// Collect styled inline runs under an element.
		const collect = (
			node: Node,
			st: { bold: boolean; italic: boolean; underline: boolean },
			out: TermRun[]
		) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const t = (node.textContent || '').replace(/\s+/g, ' ');
				if (t) out.push({ text: t, ...st });
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const el = node as HTMLElement;
			const tag = el.tagName.toLowerCase();
			if (tag === 'br') {
				out.push({ text: BR_MARK, ...st });
				return;
			}
			const next = { ...st };
			if (tag === 'b' || tag === 'strong') next.bold = true;
			if (tag === 'i' || tag === 'em') next.italic = true;
			if (tag === 'u' || tag === 'ins') next.underline = true;
			if (tag === 's' || tag === 'strike' || tag === 'del') {
				// Struck-through text is treated as removed from the sheet.
				return;
			}
			const fw = el.style?.fontWeight || '';
			if (fw === 'bold' || Number(fw) >= 600) next.bold = true;
			if (fw === 'normal' || (Number(fw) > 0 && Number(fw) < 600)) next.bold = false;
			if (el.style?.fontStyle === 'italic') next.italic = true;
			if ((el.style?.textDecoration || '').includes('underline')) next.underline = true;
			el.childNodes.forEach((c) => collect(c, next, out));
		};

		// Split runs on <br> markers and emit one block per visual line; empty
		// lines become 'space' blocks (vertical gaps on the sheet).
		const emit = (kind: TermBlock['kind'], runs: TermRun[], indent: number) => {
			let cur: TermRun[] = [];
			const flush = () => {
				const text = cur.map((r) => r.text).join('').trim();
				if (text) {
					// trim outer whitespace across the run list
					blocks.push({ kind, runs: cur, indent });
				} else {
					blocks.push({ kind: 'space', runs: [], indent: 0 });
				}
				cur = [];
			};
			for (const r of runs) {
				if (r.text === BR_MARK) flush();
				else cur.push(r);
			}
			flush();
		};

		const walk = (node: Node, indent: number) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const t = (node.textContent || '').replace(/\s+/g, ' ').trim();
				if (t) blocks.push({ kind: 'para', runs: [{ text: t, bold: false, italic: false, underline: false }], indent });
				return;
			}
			if (node.nodeType !== Node.ELEMENT_NODE) return;
			const el = node as HTMLElement;
			const tag = el.tagName.toLowerCase();
			const text = (el.textContent || '').replace(/\s+/g, ' ').trim();

			if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
				if (text) blocks.push({ kind: 'heading', runs: [{ text, bold: true, italic: false, underline: false }], indent });
				return;
			}
			if (tag === 'li') {
				const runs: TermRun[] = [];
				collect(el, { bold: false, italic: false, underline: false }, runs);
				emit('bullet', runs, indent);
				return;
			}
			if (tag === 'ul' || tag === 'ol') {
				el.childNodes.forEach((c) => walk(c, indent));
				return;
			}
			if (tag === 'blockquote') {
				// execCommand('indent') wraps content in blockquotes.
				el.childNodes.forEach((c) => walk(c, indent + 1));
				return;
			}
			if (tag === 'p' || tag === 'div') {
				const ml = parseFloat(el.style?.marginLeft || '0');
				const extra = ml > 0 ? Math.round(ml / 40) : 0;
				// A paragraph that's fully bold reads as a heading (house style).
				const inner = el.children.length === 1 ? el.children[0].tagName.toLowerCase() : '';
				if ((inner === 'b' || inner === 'strong') && el.children[0].textContent?.trim() === text && text) {
					blocks.push({ kind: 'heading', runs: [{ text, bold: true, italic: false, underline: false }], indent });
					return;
				}
				if (el.querySelector('li')) {
					el.childNodes.forEach((c) => walk(c, indent + extra));
					return;
				}
				const runs: TermRun[] = [];
				collect(el, { bold: false, italic: false, underline: false }, runs);
				emit(text ? 'para' : 'space', runs, indent + extra);
				return;
			}
			el.childNodes.forEach((c) => walk(c, indent));
		};
		docHtml.body.childNodes.forEach((c) => walk(c, 0));

		// Collapse runs of 2+ consecutive space blocks and trim edges.
		const out: TermBlock[] = [];
		for (const b of blocks) {
			if (b.kind === 'space' && (out.length === 0 || out[out.length - 1].kind === 'space')) continue;
			out.push(b);
		}
		while (out.length && out[out.length - 1].kind === 'space') out.pop();
		return out;
	}

	// Plain text (or Node fallback): strip any tags, honor "# Heading" lines.
	const plain = looksHtml ? trimmed.replace(/<[^>]+>/g, '\n') : trimmed;
	const blocks: TermBlock[] = [];
	for (const rawLine of plain.replace(/\r\n/g, '\n').split('\n')) {
		const line = rawLine.trim();
		if (!line) continue;
		if (line.startsWith('# '))
			blocks.push({ kind: 'heading', runs: [{ text: line.slice(2), bold: true, italic: false, underline: false }], indent: 0 });
		else blocks.push({ kind: 'para', runs: [{ text: line, bold: false, italic: false, underline: false }], indent: 0 });
	}
	return blocks;
}

export async function buildOfferPdf(data: OfferPdfData): Promise<Blob> {
	const jsPDF = (await import('jspdf')).default;
	const autoTable = (await import('jspdf-autotable')).default;

	// Typed as any: the repo's legacy @types/jspdf stub predates the v3 API.
	const doc: any = new jsPDF({ orientation: 'portrait', unit: 'in', format: 'letter' });
	doc.setLineHeightFactor(1.35);

	const isSettlement = data.variant === 'settlement';
	let logo = data.logoUrl ? await loadLogo(data.logoUrl, true) : null;
	if (!logo && data.logoFallbackUrl) logo = await loadLogo(data.logoFallbackUrl, false);
	const cur = currencyPrefix(data.venueCurrency);

	let y = MARGIN;

	const ensureSpace = (needed: number) => {
		if (y + needed > FOOT_LIMIT) {
			doc.addPage();
			y = MARGIN;
		}
	};

	const hairline = (x1: number, x2: number, atY: number, color = RULE) => {
		doc.setDrawColor(color[0], color[1], color[2]);
		doc.setLineWidth(0.006);
		doc.line(x1, atY, x2, atY);
	};

	// Section bar: gray fill, black text, no border lines. `accent` = lime
	// (reserved for the offer band header).
	const bar = (
		label: string,
		rightValue = '',
		x = MARGIN,
		w = CONTENT_W,
		sub = false,
		accent = false
	) => {
		const h = 0.21;
		const fill = accent ? LIME : sub ? BAR_SUB : BAR;
		doc.setFillColor(fill[0], fill[1], fill[2]);
		doc.rect(x, y, w, h, 'F');
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8.5);
		doc.setTextColor(0, 0, 0);
		doc.text(label, x + 0.08, y + 0.145);
		if (rightValue) {
			doc.setFont('helvetica', sub ? 'bold' : 'normal');
			doc.text(rightValue, x + w - 0.08, y + 0.145, { align: 'right' });
		}
		y += h + 0.04;
	};

	// kv row within an arbitrary column
	// Rules only where a total/strong row needs separating — matching the
	// reference sheet (no gray borders between every line).
	const kvRow = (
		row: OfferKvRow,
		x: number,
		w: number,
		atY: number
	): number => {
		const h = 0.15;
		doc.setFont('helvetica', row.strong ? 'bold' : 'normal');
		doc.setFontSize(8);
		const color = row.strike ? MUTED : BLACK;
		doc.setTextColor(color[0], color[1], color[2]);
		doc.text(row.label, x + 0.08, atY + 0.105);
		doc.text(row.value, x + w - 0.08, atY + 0.105, { align: 'right' });
		if (row.strike) {
			// Cross out label and value (the side of the deal that didn't win).
			const lw = doc.getTextWidth(row.label);
			const vw = doc.getTextWidth(row.value);
			doc.setDrawColor(MUTED[0], MUTED[1], MUTED[2]);
			doc.setLineWidth(0.008);
			doc.line(x + 0.08, atY + 0.075, x + 0.08 + lw, atY + 0.075);
			doc.line(x + w - 0.08 - vw, atY + 0.075, x + w - 0.08, atY + 0.075);
		}
		if (row.strong || row.underline) {
			hairline(x, x + w, atY + h, LINE);
			// Same breathing room under the rule as above it.
			return atY + h + 0.035;
		}
		return atY + h;
	};

	const baseTable = (opts: any) => {
		autoTable(doc, {
			startY: y,
			margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 0.6 },
			theme: 'plain',
			styles: {
				font: 'helvetica',
				fontSize: 8,
				textColor: BLACK as any,
				cellPadding: { top: 0.026, bottom: 0.026, left: 0.08, right: 0.08 },
				lineWidth: 0,
				lineColor: RULE as any
			},
			headStyles: {
				fontStyle: 'normal',
				fontSize: 8,
				textColor: BLACK as any,
				lineWidth: { bottom: 0.006 } as any,
				lineColor: LINE as any
			},
			...opts
		});
		y = doc.lastAutoTable.finalY + 0.05;
	};

	// ------------------------------------------------------ centered masthead
	if (logo) {
		const logoH = 0.55;
		const logoW = (logo.w / logo.h) * logoH;
		doc.addImage(logo.dataUrl, 'PNG', (PAGE_W - logoW) / 2, y, logoW, logoH);
		y += logoH + 0.16;
	}

	// Artist + date band: solid lime (#E1FF00), black text, centered, square.
	y += 0.04;
	doc.setFontSize(15);
	const artistPart = data.artistName;
	const datePart = ` - ${data.dateLabel}`;
	doc.setFont('helvetica', 'bold');
	const wArtist = doc.getTextWidth(artistPart);
	doc.setFont('helvetica', 'normal');
	const wDate = doc.getTextWidth(datePart);
	const padX = 0.24;
	const bandH = 0.34;
	const bandW = wArtist + wDate + padX * 2;
	const bandX = (PAGE_W - bandW) / 2;
	doc.setFillColor(LIME[0], LIME[1], LIME[2]);
	doc.rect(bandX, y, bandW, bandH, 'F');
	doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
	doc.setFont('helvetica', 'bold');
	doc.text(artistPart, bandX + padX, y + 0.235);
	doc.setFont('helvetica', 'normal');
	doc.text(datePart, bandX + padX + wArtist, y + 0.235);
	y += bandH + 0.1;

	doc.setFontSize(11.5);
	doc.text(
		data.venueRoom ? `${data.venueName} (${data.venueRoom})` : data.venueName,
		PAGE_W / 2,
		y + 0.1,
		{ align: 'center' }
	);
	y += 0.2;
	doc.setFontSize(8.5);
	doc.setTextColor(GRAY1[0], GRAY1[1], GRAY1[2]);
	for (const line of data.venueAddress) {
		doc.text(line, PAGE_W / 2, y + 0.08, { align: 'center' });
		y += 0.145;
	}
	y += 0.12;

	// ------------------------------------------------------ offer summary band
	if (data.bandRightHeader) {
		// "Headliner Settlement | Artist Walkout" with the FX note on a second
		// line inside the same lime band, black text.
		const bandH = data.fxNote ? 0.34 : 0.21;
		doc.setFillColor(LIME[0], LIME[1], LIME[2]);
		doc.rect(MARGIN, y, CONTENT_W, bandH, 'F');
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8.5);
		doc.setTextColor(0, 0, 0);
		doc.text(`${data.role} ${isSettlement ? 'Settlement' : 'Offer'}`, MARGIN + 0.08, y + 0.145);
		doc.setFont('helvetica', 'normal');
		doc.text(data.bandRightHeader, PAGE_W - MARGIN - 0.08, y + 0.145, { align: 'right' });
		if (data.fxNote) {
			doc.setFontSize(7.5);
			doc.text(data.fxNote, PAGE_W - MARGIN - 0.08, y + 0.28, { align: 'right' });
		}
		y += bandH; // flush against the tinted deal row below
	} else {
		bar(`${data.role} ${isSettlement ? 'Settlement' : 'Offer'}`, data.fxNote || '', MARGIN, CONTENT_W, false, true);
		y -= 0.04; // flush against the tinted deal row below
	}
	for (const row of data.offerRows) {
		doc.setFontSize(8.5);
		const labelLines = doc.splitTextToSize(row.label, CONTENT_W - 2.3);
		const noteLines = row.note ? doc.splitTextToSize(row.note, CONTENT_W - 2.3) : [];
		const h = Math.max(0.24, labelLines.length * 0.135 + noteLines.length * 0.12 + 0.11);
		ensureSpace(h);
		if (row.accent) {
			// Low-opacity lime highlight behind the Guarantee row.
			doc.setFillColor(LIME_TINT[0], LIME_TINT[1], LIME_TINT[2]);
			doc.rect(MARGIN, y, CONTENT_W, h, 'F');
		}
		if (row.emphasis) {
			doc.setDrawColor(LIME[0], LIME[1], LIME[2]);
			doc.setLineWidth(0.014);
			doc.line(MARGIN, y, PAGE_W - MARGIN, y);
		}
		doc.setFont('helvetica', row.accent || row.emphasis ? 'bold' : 'normal');
		doc.setFontSize(8.5);
		doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
		let ly = y + 0.16;
		for (const l of labelLines) {
			doc.text(l, MARGIN + 0.08, ly);
			ly += 0.14;
		}
		if (noteLines.length) {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(7.5);
			doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
			for (const l of noteLines) {
				doc.text(l, MARGIN + 0.08, ly - 0.01);
				ly += 0.125;
			}
		}
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8.5);
		doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
		doc.text(row.value, PAGE_W - MARGIN - 0.08, y + 0.16, { align: 'right' });
		y += h;
	}
	y += 0.1;

	// -------------------------------- Event Details | Event Summary two-column
	// (settlements have no Event Details -> Event Summary spans full width)
	if (data.eventDetails.length === 0) {
		ensureSpace(0.26 + data.eventSummary.length * 0.16);
		bar('Event Summary');
		for (const row of data.eventSummary) {
			ensureSpace(0.16);
			y = kvRow(row, MARGIN, CONTENT_W, y);
		}
		y += 0.1;
	} else {
		const colGap = 0.14;
		const colW = (CONTENT_W - colGap) / 2;
		const leftX = MARGIN;
		const rightX = MARGIN + colW + colGap;
		const maxRows = Math.max(data.eventDetails.length, data.eventSummary.length);
		ensureSpace(0.26 + maxRows * 0.16);

		const barsY = y;
		doc.setFillColor(BAR[0], BAR[1], BAR[2]);
		doc.rect(leftX, barsY, colW, 0.21, 'F');
		doc.rect(rightX, barsY, colW, 0.21, 'F');
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8.5);
		doc.setTextColor(0, 0, 0);
		doc.text('Event Details', leftX + 0.08, barsY + 0.145);
		doc.text('Event Summary', rightX + 0.08, barsY + 0.145);

		let lY = barsY + 0.25;
		for (const row of data.eventDetails) {
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(8);
			doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
			doc.text(row.label, leftX + 0.08, lY + 0.1);
			doc.text(row.value, leftX + colW * 0.45, lY + 0.1);
			lY += 0.15;
		}
		let rY = barsY + 0.25;
		for (const row of data.eventSummary) {
			rY = kvRow(row, rightX, colW, rY);
		}
		y = Math.max(lY, rY) + 0.1;
	}

	// ---------------------------------------------------------- ticket scaling
	if (data.tickets.length > 0) {
		ensureSpace(0.6);
		bar(
			isSettlement
				? `Sales Breakdown (Currencies below are in ${cur})`
				: `Ticket Scaling (Currencies below are in ${cur})`
		);
		y -= 0.05; // header row sits flush inside the band
		const totals = data.tickets.reduce(
			(acc, t) => {
				acc.allotment += t.allotment;
				acc.comps += t.comps;
				acc.sellable += t.sellable;
				acc.sold += Number(t.sold) || 0;
				acc.gross += t.gross;
				return acc;
			},
			{ allotment: 0, comps: 0, sellable: 0, sold: 0, gross: 0 }
		);
		baseTable({
			head: [
				isSettlement
					? ['Type', 'Comps', 'Sellable', 'Sold', 'Ticket Price', 'Gross']
					: ['Type', 'Allotment', 'Comps', 'Sellable', 'Ticket Price', 'Break Even', 'Gross Potential']
			],
			body: data.tickets.map((t) =>
				isSettlement
					? [
							t.name,
							int(t.comps),
							int(t.sellable),
							int(Number(t.sold) || 0),
							`$${moneyNum(t.price)}`,
							`$${moneyNum(t.gross)}`
						]
					: [
							t.name,
							int(t.allotment),
							int(t.comps),
							int(t.sellable),
							`$${moneyNum(t.price)}`,
							t.breakEven != null ? int(t.breakEven) : '—',
							`$${moneyNum(t.gross)}`
						]
			),
			foot: [
				isSettlement
					? [
							'Totals',
							int(totals.comps),
							int(totals.sellable),
							int(totals.sold),
							'',
							`$${moneyNum(totals.gross)}`
						]
					: [
							'Totals',
							int(totals.allotment),
							int(totals.comps),
							int(totals.sellable),
							'',
							'',
							`$${moneyNum(totals.gross)}`
						]
			],
			headStyles: {
				fontStyle: 'normal',
				fontSize: 8,
				textColor: BLACK as any,
				fillColor: BAR as any,
				lineWidth: 0
			},
			footStyles: {
				fontStyle: 'bold',
				textColor: BLACK as any,
				lineWidth: { top: 0.006 } as any,
				lineColor: LINE as any
			},
			columnStyles: isSettlement
				? {
						0: { cellWidth: 2.2 },
						1: { halign: 'right' },
						2: { halign: 'right' },
						3: { halign: 'right' },
						4: { halign: 'right' },
						5: { halign: 'right', cellWidth: 1.35 }
					}
				: {
						0: { cellWidth: 1.7 },
						1: { halign: 'right' },
						2: { halign: 'right' },
						3: { halign: 'right' },
						4: { halign: 'right' },
						5: { halign: 'right' },
						6: { halign: 'right', cellWidth: 1.35 }
					},
			didParseCell: (hook: any) => {
				if (hook.section !== 'body' && hook.column.index > 0) hook.cell.styles.halign = 'right';
			}
		});
		y -= 0.02; // tax row hugs the Totals row (one bordered section)
		for (const f of data.scalingFooter) {
			ensureSpace(0.16);
			y = kvRow(f, MARGIN, CONTENT_W, y);
		}
		y += 0.08;
	}

	// --------------------------------------------------------------- expenses
	ensureSpace(0.6);
	bar(
		data.expenseSummaryLabel || 'Expense Summary',
		data.expenseSummaryValue || `Total Expenses ${cur}${moneyNum(data.totalExpenses)}`
	);
	bar(
		`${data.fixedBandLabel} (Currencies below are in ${cur})`,
		`${cur}${moneyNum(data.fixedBandTotal)}`,
		MARGIN,
		CONTENT_W,
		true
	);
	// Expense groups flow in two columns, shortest-column-first (Prism-style:
	// General>General left, Production>Additional right, Talent Pay below, ...).
	{
		const colW2 = CONTENT_W / 2 - 0.07;
		const colX = [MARGIN, MARGIN + CONTENT_W / 2 + 0.07];
		let colY: [number, number] = [y, y];
		const rowLineH = 0.135;

		const rowLines = (name: string, w: number): string[] =>
			doc.splitTextToSize(name, w - 1.05);

		const groupHeight = (g: (typeof data.expenseGroups)[number], w: number): number => {
			let h = 0.16; // header
			for (const r of g.rows) h += rowLines(r.name, w).length * rowLineH + 0.035;
			h += 0.15; // totals row
			return h + 0.07;
		};

		const signedMoney = (v: number) => `${v < 0 ? '-' : ''}$${moneyNum(Math.abs(v))}`;

		const renderGroup = (
			g: (typeof data.expenseGroups)[number],
			x: number,
			w: number,
			startY: number
		): number => {
			const bav = g.mode === 'bav';
			// bav column x positions (right-aligned): Budget | Actual | Variance
			const cB = x + w - 1.4;
			const cA = x + w - 0.72;
			const cV = x + w - 0.08;
			const nameW = bav ? w - 2.2 : w;
			let gy = startY;
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
			doc.text(g.title, x + 0.08, gy + 0.1);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(bav ? 7 : 8);
			doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
			if (bav) {
				doc.text('Budget', cB, gy + 0.1, { align: 'right' });
				doc.text('Actual', cA, gy + 0.1, { align: 'right' });
				doc.text('Variance', cV, gy + 0.1, { align: 'right' });
			} else {
				doc.text('Expense', x + w - 0.08, gy + 0.1, { align: 'right' });
			}
			hairline(x, x + w, gy + 0.15, LINE);
			gy += 0.16;
			for (const r of g.rows) {
				const lines = doc.splitTextToSize(r.name, bav ? nameW : w - 1.05);
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(bav ? 7.5 : 8);
				doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
				let ly = gy + 0.105;
				for (const line of lines) {
					doc.text(line, x + 0.08, ly);
					ly += rowLineH;
				}
				if (bav) {
					doc.text(signedMoney(Number(r.budget) || 0), cB, gy + 0.105, { align: 'right' });
					doc.text(signedMoney(r.amount), cA, gy + 0.105, { align: 'right' });
					doc.text(signedMoney(Number(r.variance) || 0), cV, gy + 0.105, { align: 'right' });
				} else {
					doc.text(`$${moneyNum(r.amount)}`, x + w - 0.08, gy + 0.105, { align: 'right' });
				}
				gy += lines.length * rowLineH + 0.035;
			}
			// Totals
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(bav ? 7.5 : 8);
			doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
			doc.text('Totals', x + 0.08, gy + 0.105);
			if (bav) {
				doc.text(signedMoney(Number(g.budgetTotal) || 0), cB, gy + 0.105, { align: 'right' });
				doc.text(signedMoney(g.total), cA, gy + 0.105, { align: 'right' });
				doc.text(signedMoney(Number(g.varianceTotal) || 0), cV, gy + 0.105, { align: 'right' });
			} else {
				doc.text(`$${moneyNum(g.total)}`, x + w - 0.08, gy + 0.105, { align: 'right' });
			}
			hairline(x, x + w, gy + 0.15, LINE);
			gy += 0.15;
			return gy + 0.07;
		};

		for (const group of data.expenseGroups) {
			const h = groupHeight(group, colW2);
			let c: 0 | 1 = colY[0] <= colY[1] ? 0 : 1;
			if (colY[c] + h > FOOT_LIMIT) {
				const other: 0 | 1 = c === 0 ? 1 : 0;
				if (colY[other] + h <= FOOT_LIMIT) {
					c = other;
				} else {
					doc.addPage();
					colY = [MARGIN, MARGIN];
					c = 0;
				}
			}
			colY[c] = renderGroup(group, colX[c], colW2, colY[c]);
		}
		y = Math.max(colY[0], colY[1]);
	}

	ensureSpace(0.5);
	bar(
		`Variable Expenses (Currencies below are in ${cur})`,
		`${cur}${moneyNum(data.variableTotal)}`,
		MARGIN,
		CONTENT_W,
		true
	);
	y -= 0.05; // header row sits flush inside the band
	baseTable({
		headStyles: {
			fontStyle: 'normal',
			fontSize: 8,
			textColor: BLACK as any,
			fillColor: BAR_SUB as any,
			lineWidth: { bottom: 0.008 } as any,
			lineColor: LINE as any
		},
		head: [['Type', 'Amount', isSettlement ? 'Total' : 'Total Potential']],
		body: [
			...data.variableRows.map((r) => [`${r.name} (${r.type})`, r.amount, r.potential]),
			['Totals:', '', `$${moneyNum(data.variableTotal)}`]
		],
		columnStyles: {
			0: { cellWidth: 3.4 },
			1: { halign: 'right' },
			2: { halign: 'right', cellWidth: 1.5 }
		},
		didParseCell: (hook: any) => {
			if (hook.section === 'head' && hook.column.index > 0) hook.cell.styles.halign = 'right';
			if (hook.section === 'body' && hook.row.index === data.variableRows.length) {
				hook.cell.styles.fontStyle = 'bold';
			}
		}
	});
	y += 0.1;

	// --------------------------------------------------------------- contacts
	if (data.contacts.length > 0) {
		// Contacts never split across pages: measure the block, break first.
		ensureSpace(Math.min(0.35 + data.contacts.length * 0.17, FOOT_LIMIT - MARGIN));
		bar('Contacts');
		baseTable({
			body: data.contacts.map((c) => [c.name, c.role, c.email, c.phone]),
			columnStyles: {
				0: { cellWidth: 1.85 },
				1: { cellWidth: 2.0 },
				2: { cellWidth: 2.2 },
				3: { halign: 'right' }
			}
		});
		y += 0.1;
	}

	// ------------------------------------------------ terms block renderer
	// Rich layout: bold/italic/underline runs, indents, blank lines, justified
	// text. Whole paragraphs move to the next page instead of splitting, and a
	// heading always stays attached to the start of its paragraph.
	const renderTermBlocks = (blocks: TermBlock[]) => {
		const lineH = 0.12;
		const bodySize = 7.5;

		// A "word" is one unbreakable unit; it can span style boundaries (e.g.
		// "<u>24 hours</u>." keeps the period glued to "hours").
		type Frag = { text: string; bold: boolean; italic: boolean; underline: boolean; w: number };
		type Word = { frags: Frag[]; w: number };

		const setFragFont = (f: { bold: boolean; italic: boolean }, size: number) => {
			const style =
				f.bold && f.italic ? 'bolditalic' : f.bold ? 'bold' : f.italic ? 'italic' : 'normal';
			doc.setFont('helvetica', style);
			doc.setFontSize(size);
		};

		const tokenize = (runs: TermRun[], size: number): Word[] => {
			const words: Word[] = [];
			let open = false; // last token had no trailing whitespace yet
			for (const r of runs) {
				const parts = r.text.split(/(\s+)/);
				for (const part of parts) {
					if (!part) continue;
					if (/^\s+$/.test(part)) {
						open = false;
						continue;
					}
					const frag: Frag = { text: part, bold: r.bold, italic: r.italic, underline: r.underline, w: 0 };
					setFragFont(frag, size);
					frag.w = doc.getTextWidth(part);
					if (open && words.length) {
						const wd = words[words.length - 1];
						wd.frags.push(frag);
						wd.w += frag.w;
					} else {
						words.push({ frags: [frag], w: frag.w });
					}
					open = true;
				}
			}
			return words;
		};

		const layoutLines = (runs: TermRun[], maxW: number, size: number): Word[][] => {
			const words = tokenize(runs, size);
			doc.setFont('helvetica', 'normal');
			doc.setFontSize(size);
			const spaceW = doc.getTextWidth(' ');
			const lines: Word[][] = [];
			let cur: Word[] = [];
			let curW = 0;
			for (const wd of words) {
				const needed = cur.length ? curW + spaceW + wd.w : wd.w;
				if (needed > maxW && cur.length) {
					lines.push(cur);
					cur = [wd];
					curW = wd.w;
				} else {
					cur.push(wd);
					curW = needed;
				}
			}
			if (cur.length) lines.push(cur);
			return lines;
		};

		const drawLine = (
			line: Word[],
			x: number,
			maxW: number,
			size: number,
			justify: boolean,
			color: number[]
		) => {
			doc.setFontSize(size);
			doc.setFont('helvetica', 'normal');
			const naturalSpace = doc.getTextWidth(' ');
			const totalW = line.reduce((a, wd) => a + wd.w, 0);
			const gaps = line.length - 1;
			let space = naturalSpace;
			if (justify && gaps > 0) {
				const stretched = (maxW - totalW) / gaps;
				// Never stretch absurdly (short trailing lines aren't justified anyway).
				space = stretched > naturalSpace * 3.2 ? naturalSpace : Math.max(naturalSpace, stretched);
			}
			let cx = x;
			const baseline = y + 0.08;
			for (let i = 0; i < line.length; i++) {
				const wd = line[i];
				let fx = cx;
				for (let fi = 0; fi < wd.frags.length; fi++) {
					const f = wd.frags[fi];
					setFragFont(f, size);
					doc.setTextColor(color[0], color[1], color[2]);
					doc.text(f.text, fx, baseline);
					if (f.underline) {
						const nextFragUnderlined = fi + 1 < wd.frags.length && wd.frags[fi + 1].underline;
						const nextWordUnderlined =
							fi === wd.frags.length - 1 && i + 1 < line.length && line[i + 1].frags[0]?.underline;
						doc.setDrawColor(color[0], color[1], color[2]);
						doc.setLineWidth(0.006);
						doc.line(
							fx,
							baseline + 0.02,
							fx + f.w + (nextWordUnderlined ? space : 0) + (nextFragUnderlined ? 0 : 0),
							baseline + 0.02
						);
					}
					fx += f.w;
				}
				cx += wd.w + space;
			}
		};

		for (let bi = 0; bi < blocks.length; bi++) {
			const block = blocks[bi];
			if (block.kind === 'space') {
				// Blank editor line -> vertical gap (skipped right at a page top).
				if (y > MARGIN + 0.01 && y + lineH * 0.7 <= FOOT_LIMIT) y += lineH * 0.7;
				continue;
			}

			const indentX = MARGIN + 0.08 + block.indent * 0.22 + (block.kind === 'bullet' ? 0.14 : 0);
			const maxW = CONTENT_W - (indentX - MARGIN) - 0.08;

			if (block.kind === 'heading') {
				// Keep the heading attached to the first two lines of what follows.
				const nextBlock = blocks[bi + 1];
				let followH = lineH * 2;
				if (nextBlock && nextBlock.kind !== 'space' && nextBlock.kind !== 'heading') {
					const nextLines = layoutLines(nextBlock.runs, maxW, bodySize);
					followH = Math.min(nextLines.length, 2) * lineH;
				}
				ensureSpace(0.06 + lineH + 0.03 + followH);
				y += 0.06;
				doc.setFont('helvetica', 'bold');
				doc.setFontSize(8.5);
				doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
				doc.text(block.runs.map((r) => r.text).join('').trim(), indentX, y + 0.08);
				y += lineH + 0.03;
				continue;
			}

			const lines = layoutLines(block.runs, maxW, bodySize);
			const blockH = lines.length * lineH + 0.03;
			// A paragraph that fits on a fresh page never splits mid-page.
			if (blockH <= FOOT_LIMIT - MARGIN) ensureSpace(blockH);
			lines.forEach((line, i) => {
				ensureSpace(lineH);
				if (i === 0 && block.kind === 'bullet') {
					doc.setFont('helvetica', 'normal');
					doc.setFontSize(bodySize);
					doc.setTextColor(GRAY1[0], GRAY1[1], GRAY1[2]);
					doc.text('•', indentX - 0.12, y + 0.08);
				}
				drawLine(line, indentX, maxW, bodySize, i < lines.length - 1, GRAY1);
				y += lineH;
			});
			y += 0.03;
		}
	};

	// -------------------------------------------------------------- deal terms
	// Settlement sheets never print terms — those live on the offer only.
	const dealTermsBlocks = isSettlement ? [] : parseTermBlocks(data.dealTermsContent || '');
	const hasDealTerms =
		!isSettlement &&
		(!!data.dealTermsLine || dealTermsBlocks.length > 0 || (data.depositLines?.length ?? 0) > 0);
	if (hasDealTerms) {
	ensureSpace(0.5 + Math.min(dealTermsBlocks.length, 3) * 0.14);
	bar('Deal Terms');
	if (data.dealTermsLine) {
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(8);
		const tw = doc.getTextWidth(data.dealTermsLine);
		doc.setFillColor(LIME[0], LIME[1], LIME[2]);
		doc.rect(MARGIN, y, tw + 0.16, 0.2, 'F');
		doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
		doc.text(data.dealTermsLine, MARGIN + 0.08, y + 0.135);
		y += 0.28;
	}
	// Deposit schedule (Prism contract-terms style)
	if (data.depositLines && data.depositLines.length > 0) {
		for (const line of data.depositLines) {
			ensureSpace(0.16);
			doc.setFont('helvetica', 'bold');
			doc.setFontSize(8);
			doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
			doc.text(line, MARGIN + 0.08, y + 0.08);
			y += 0.15;
		}
		y += 0.06;
	}
	if (dealTermsBlocks.length > 0) {
		renderTermBlocks(dealTermsBlocks);
		y += 0.08;
	}
	}

	const termBlocks = isSettlement ? [] : parseTermBlocks(data.termsAndConditions || '');
	if (termBlocks.length > 0) {
		ensureSpace(0.6);
		bar('Additional Deal Terms');
		renderTermBlocks(termBlocks);
		y += 0.1;
	}

	// -------------------------------------------------------------- signatures
	if (isSettlement) {
		// Prism settlement block: two parties, three sign-off lines each.
		ensureSpace(1.8);
		bar('Settlement');
		const sigW = (CONTENT_W - 0.6) / 2;
		const cols = [
			{ x: MARGIN, who: 'Artist' },
			{ x: PAGE_W - MARGIN - sigW, who: 'Promoter' }
		];
		const sigRows = (who: string) => [
			`Name, Relationship to ${who}`,
			'Email, Phone',
			'Signature, Date'
		];
		const startY = y + 0.1;
		for (const col of cols) {
			let sy = startY;
			for (const label of sigRows(col.who)) {
				doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
				doc.setLineWidth(0.01);
				doc.line(col.x, sy + 0.32, col.x + sigW, sy + 0.32);
				doc.setFont('helvetica', 'normal');
				doc.setFontSize(7);
				doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
				doc.text(label, col.x, sy + 0.43);
				sy += 0.52;
			}
		}
		y = startY + 3 * 0.52;
	} else {
		ensureSpace(0.85);
		y = Math.max(y + 0.15, Math.min(FOOT_LIMIT - 0.7, PAGE_H - 1.4));
		const sigW = (CONTENT_W - 0.6) / 2;
		doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
		doc.setLineWidth(0.01);
		doc.line(MARGIN, y + 0.35, MARGIN + sigW, y + 0.35);
		doc.line(PAGE_W - MARGIN - sigW, y + 0.35, PAGE_W - MARGIN, y + 0.35);
		doc.setFont('helvetica', 'bold');
		doc.setFontSize(7);
		doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
		doc.text('ACCEPTED — ARTIST / AGENT', MARGIN, y + 0.47);
		doc.text('PRODUKT', PAGE_W - MARGIN - sigW, y + 0.47);
		doc.setFont('helvetica', 'normal');
		doc.text('Date', MARGIN, y + 0.58);
		doc.text('Date', PAGE_W - MARGIN - sigW, y + 0.58);
	}

	// ------------------------------------------------------ footer, every page
	const fmtShort = (d: Date) =>
		`${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
	const pageCount = doc.getNumberOfPages();
	for (let i = 1; i <= pageCount; i++) {
		doc.setPage(i);
		hairline(MARGIN, PAGE_W - MARGIN, PAGE_H - 0.32);
		doc.setFont('helvetica', 'normal');
		doc.setFontSize(6.5);
		doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
		doc.text(
			`${data.artistName} · ${isSettlement ? 'Settlement' : `Offer ${data.offerNumber}`} · ${fmtShort(data.generatedAt)}`,
			MARGIN,
			PAGE_H - 0.18
		);
		doc.text('Powered by Produkt', PAGE_W / 2, PAGE_H - 0.18, { align: 'center' });
		doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 0.18, { align: 'right' });
	}

	return doc.output('blob');
}
