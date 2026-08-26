<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import DealCreator from './DealCreator.svelte';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import {
		computeArtistPayout,
		computeBackend,
		computeEventCosts,
		formatDealSummary
	} from '$lib/components/calendar/page/tabs/deals/dealEngine';
	import { syncDealSetTimesToTimetable } from '$lib/services/timetableSync';
	import { getCachedDealPayload, setCachedDealPayload } from './eventDealCache';
	import { buildOfferPdf, currencyPrefix, moneyNum } from '$lib/utils/offerPdf';
	import {
		buildOfferFileName,
		formatOfferDate,
		uploadOfferPdf,
		removeOfferPdf,
		openOffer,
		openOfferPretty,
		openSettlementPretty,
		type OfferHistoryEntry
	} from '$lib/services/offerService';
	import {
		getDefaultTcTemplate,
		getOfferEventDefaults,
		eventTypeOf
	} from '$lib/services/templateService';
	import type { DealRole, DealTypeOption, Deposit } from '../../../../../types/tabs/deals';

	let dailyApiRate = 1;
	let activeExchangeRate = 1;
	let useCustomRate = false;
	let customRate = 1.3832; // Offer Rate (Settings)
	let customSettlementRate = 1.3832; // Settlement Rate (Settings, mirrors offer rate by default)

	// --- FX offer markup (event-level, set in the event Settings view) ---
	let fxMarkupEnabled = true;
	let fxMarkupPercent = 5;

	// --- Exchange rate locking (Settlement / Settled) ---
	let lockedExchangeRate: number | null = null;
	let lockedExchangeRateAt: string | null = null;
	let rateReady = false; // true once the daily API rate has resolved (or isn't needed)
	let lockAttempted = false; // ensures we only auto-lock + save once per mount

	interface Deal {
		id: string;
		artistName: string;
		artistId?: string;
		artistPic?: string;
		summaryText?: string;
		w_tax?: boolean;
		w_tax_amount?: number;
		cad_tax_type?: 'Flat' | 'Taxes';
		cad_qst?: boolean;
		cad_gst?: boolean;
		description?: any;
		role: DealRole;
		dealType: DealTypeOption;
		deposits: Deposit[];
		isPendingInfoOnly?: boolean; // Flag to catch empty DB payloads
		[key: string]: any;
	}

	export let userRole = 'Email Only';
	export let eventDealData: any;
	export let eventDate: string = '';
	export let event: any = null;
	export let venueCurrency: string = 'CAD';

	export let viewedVersionNum: number = 1;
	export let overrideCalendarData: any = null;

	// Event lifecycle status: 'Confirmed' | 'Hold' | 'Settlement' | 'Settled' (case-insensitive).
	// Pass it explicitly from the parent, or it falls back to common locations on the event object.
	export let eventStatus: string = '';

	// Runs once at init, before the first render: prefer whatever this session
	// last wrote over the (possibly stale) payload handed down by the parent.
	{
		const cached = getCachedDealPayload(event, viewedVersionNum);
		if (cached) eventDealData = cached;
	}

	$: effectiveStatus = String(
		eventStatus ||
			event?.status ||
			event?.calendar?.status ||
			event?.event_status ||
			event?.calendar_data?.status ||
			''
	).toLowerCase();
	// DB stores 'IN SETTLEMENT' — match every settlement-ish spelling.
	$: isLockedStage = ['settlement', 'in settlement', 'settled'].includes(effectiveStatus);
	$: isActiveStage = effectiveStatus === 'confirmed' || effectiveStatus === 'hold';

	// Only locked if looking at a different version
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: isAlternateVersion = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;
	$: isViewOnly = isAlternateVersion;

	$: currentDealData = (() => {
		let raw = eventDealData;
		if (!raw) return {};
		if (typeof raw === 'object') return raw;
		if (typeof raw === 'string') {
			try {
				let parsed = JSON.parse(raw);
				if (typeof parsed === 'string') parsed = JSON.parse(parsed);
				return parsed;
			} catch (e) {
				return {};
			}
		}
		return {};
	})();

	$: parsedEventCost = (() => {
		const rawCost = overrideCalendarData
			? overrideCalendarData.event_cost
			: event?.calendar_data?.event_cost || event?.event_cost || event?.event_costs;
		if (!rawCost) return null;
		if (typeof rawCost === 'object') return rawCost;
		if (typeof rawCost === 'string') {
			try {
				let parsed = JSON.parse(rawCost);
				if (typeof parsed === 'string') parsed = JSON.parse(parsed);
				return parsed;
			} catch (e) {
				return null;
			}
		}
		return null;
	})();

	$: parsedEventRevenue = (() => {
		const raw = overrideCalendarData
			? overrideCalendarData.event_revenue
			: event?.calendar_data?.event_revenue || event?.event_revenue || event?.event_revenues;
		if (!raw) return null;
		if (typeof raw === 'object') return raw;
		if (typeof raw === 'string') {
			try {
				let parsed = JSON.parse(raw);
				if (typeof parsed === 'string') parsed = JSON.parse(parsed);
				return parsed;
			} catch (e) {
				return null;
			}
		}
		return null;
	})();

	$: dealContext = (() => {
		// offerCost/offerRevenue prefer the fresh DB copy over the page-load
		// snapshot, so payouts update as soon as Revenue/Costs edits land.
		const cb = computeEventCosts(
			offerCost,
			offerRevenue,
			Number(additionalSupportActual) || 0,
			{ useActual: true }
		);
		return {
			gross: cb.gross,
			netGross: cb.netGross,
			costs: cb.total,
			paidTickets: cb.paidTickets,
			totalAllotment: cb.totalAllotment,
			exchangeRate: activeExchangeRate
		};
	})();

	/**
	 * Resolves which exchange rate applies to a specific deal:
	 *   1. Deal denominated in the venue currency -> 1 (no conversion needed)
	 *   2. Event is in Settlement/Settled -> the locked rate (frozen, saved in DB)
	 *   3. Deal has a rate saved at creation / last offer update -> that saved rate
	 *   4. Fallback -> the live active rate (custom override or daily API rate)
	 */
	/**
	 * Base FX rate (no offer markup):
	 *   1. Deal in venue currency -> 1
	 *   2. Settlement/Settled -> locked rate
	 *   3. Deal has a saved offer rate -> that
	 *   4. Fallback -> live active rate
	 */
	function resolveBaseRate(deal: any): number {
		if (deal?.dealCurrency && deal.dealCurrency === venueCurrency) return 1;
		if (isLockedStage) {
			// Settlement context: custom Settlement Rate > rate saved at the last
			// settlement generation > auto-locked rate > the offer chain below.
			if (useCustomRate && Number(customSettlementRate || customRate) > 0)
				return Number(customSettlementRate || customRate);
			const savedSettle = Number(deal?.savedSettlementRate);
			if (savedSettle > 0) return savedSettle;
			if (lockedExchangeRate) return lockedExchangeRate;
		}
		// Offer context: the custom Offer Rate (Settings) overrides any rate
		// stamped on the deal.
		if (useCustomRate && Number(customRate) > 0) return Number(customRate);
		const saved = Number(deal?.savedExchangeRate);
		if (saved > 0) return saved;
		return activeExchangeRate;
	}

	// Whether the FX markup applies to this deal (never for same-currency deals).
	function markupAppliesTo(deal: any): boolean {
		return fxMarkupEnabled && !(deal?.dealCurrency && deal.dealCurrency === venueCurrency);
	}

	// Effective rate used in payout math = base rate x (1 + markup%).
	function resolveDealRate(deal: any): number {
		const base = resolveBaseRate(deal);
		return markupAppliesTo(deal) ? base * (1 + fxMarkupPercent / 100) : base;
	}

	// The live API rate with the markup applied (what a new offer would lock in).
	function markedUpLiveRate(deal: any): number {
		return markupAppliesTo(deal) ? dailyApiRate * (1 + fxMarkupPercent / 100) : dailyApiRate;
	}

	/** Other deals that count as expenses on this deal's split point:
	 *  co-headliners + support deals with "Include in Headliner Deal" on. */
	function includedTalentCostFor(deal: any): number {
		let sum = 0;
		for (const d of deals) {
			if (d.id === deal.id || d.isPendingInfoOnly || !d.artistName) continue;
			if (!(d.role === 'Headliner' || d.includeInHeadlinerDeal === true)) continue;
			sum += computeArtistPayout(
				{ dealType: d.dealType, guaranteeAmount: d.guaranteeAmount, details: d.details },
				{ ...dealContext, exchangeRate: resolveDealRate(d) }
			);
		}
		return sum;
	}

	function resolveDealPayout(deal: any): number {
		if (deal.isPendingInfoOnly) return 0;
		const hd = {
			dealType: deal.dealType,
			guaranteeAmount: deal.guaranteeAmount,
			details: deal.details
		};
		// The split point includes the other included talent as an expense —
		// same basis the sidebar, pro forma and offer/settlement sheets use.
		return computeArtistPayout(hd, {
			...dealContext,
			costs: dealContext.costs + includedTalentCostFor(deal),
			exchangeRate: resolveDealRate(deal)
		});
	}

	$: deals = (() => {
		let parsedDeals: Deal[] = [];
		const raw = currentDealData || {};

		if (!Array.isArray(raw)) {
			const parseRoleDeals = (roleStr: DealRole, keyPrefix: string) => {
				let i = 1;
				while (true) {
					let sfx = i === 1 ? '' : `_${i}`;
					let nameKey = `${keyPrefix}_name${sfx}`;

					if (!(nameKey in raw)) break;

					let name = raw[nameKey];
					if (name && name !== 'NULL' && name !== 'null') {
                        // Flag deals that have an artist ID/Name but no dealType logic yet
						let dealData = raw[`${keyPrefix}_deal${sfx}`] || {};
						let isPendingInfoOnly = Object.keys(dealData).length === 0 || !dealData.dealType;

						parsedDeals.push({
							id: dealData.id || crypto.randomUUID(),
							role: roleStr,
							artistId: raw[`${keyPrefix}_id${sfx}`],
							artistName: name,
							artistPic: raw[`${keyPrefix}_pic${sfx}`],
							isPendingInfoOnly,
							...dealData
						});
					}
					i++;
				}
			};

			parseRoleDeals('Headliner', 'headliner');
			parseRoleDeals('Support', 'support');
		} else {
			parsedDeals = raw.map((d: any) => ({ ...d, isPendingInfoOnly: !d.dealType }));
		}

		return parsedDeals;
	})();

	// --- Reorder mode (drag to rearrange within a section) ---
	let reorderMode: DealRole | null = null; // 'Headliner' | 'Support' | null (one section at a time)
	let draggingId: string | null = null;
	let dragOrder: Partial<Record<DealRole, string[]>> = {}; // live order overrides while dragging

	function applyOrder(list: Deal[], ids?: string[]): Deal[] {
		if (!ids || ids.length === 0) return list;
		const map = new Map(list.map((d) => [d.id, d]));
		const ordered: Deal[] = [];
		for (const id of ids) {
			const d = map.get(id);
			if (d) {
				ordered.push(d);
				map.delete(id);
			}
		}
		// Any deals not in the override (e.g. newly added) go to the end.
		for (const d of map.values()) ordered.push(d);
		return ordered;
	}

	$: headlinerDeals = applyOrder(
		deals.filter((d: Deal) => d.role === 'Headliner'),
		dragOrder['Headliner']
	);
	$: supportDeals = applyOrder(
		deals.filter((d: Deal) => d.role === 'Support'),
		dragOrder['Support']
	);

	$: canEditAndManage = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewDetails = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewNamesOnly = ['Manager'].includes(userRole);

	$: hasAnyAccess = canViewDetails || canViewNamesOnly;

	let isCreatingDeal = false;
	let dealToEdit: Deal | null = null;

	let activeMenuId: string | null = null;

	let showDeleteModal = false;
	let dealToDeleteId: string | null = null;

	let additionalSupportBudgeted: number | string = 0;
	let additionalSupportActual: number | string = 0;

	$: if (currentDealData) {
		additionalSupportBudgeted = currentDealData.additional_support_budgeted || 0;
		additionalSupportActual = currentDealData.additional_support_actual || 0;

		useCustomRate = currentDealData.useCustomRate || false;
		customRate = currentDealData.customRate || 1.3832;
		customSettlementRate =
			Number(currentDealData.customSettlementRate) || currentDealData.customRate || 1.3832;
		activeExchangeRate = useCustomRate ? customRate : dailyApiRate;

		lockedExchangeRate = Number(currentDealData.lockedExchangeRate) || null;
		lockedExchangeRateAt = currentDealData.lockedExchangeRateAt || null;

		fxMarkupEnabled = currentDealData.fxMarkupEnabled !== false;
		fxMarkupPercent = currentDealData.fxMarkupPercent === 10 ? 10 : 5;
	}

	// Auto-lock the exchange rate the first time the event is viewed in
	// Settlement/Settled with no locked rate yet. Persists to DB immediately so
	// the rate is frozen at the moment of settlement.
	$: if (
		rateReady &&
		isLockedStage &&
		!lockAttempted &&
		!isViewOnly &&
		canEditAndManage &&
		lockedExchangeRate == null &&
		deals
	) {
		lockAttempted = true;
		lockedExchangeRate = activeExchangeRate;
		lockedExchangeRateAt = new Date().toISOString();
		saveToDatabase(deals);
	}

	// ---- Storage <-> DB reconciliation ----
	// If an offer/settlement PDF was deleted directly in the storage bucket, the
	// stale history entry (and its dead link) is pruned from the DB on load.
	let storageReconciled = false;
	$: if (!storageReconciled && deals.length > 0 && canEditAndManage && !isViewOnly) {
		storageReconciled = true;
		reconcileStorageLinks();
	}

	async function reconcileStorageLinks() {
		try {
			const [o, se] = await Promise.all([
				supabase.storage.from('documents').list('offers', { limit: 1000 }),
				supabase.storage.from('documents').list('settlements', { limit: 1000 })
			]);
			if (o.error || se.error) return; // storage unreachable — leave data alone
			const present = new Set([
				...(o.data || []).map((f) => `offers/${f.name}`),
				...(se.data || []).map((f) => `settlements/${f.name}`)
			]);
			let changed = false;
			const updated = [...headlinerDeals, ...supportDeals].map((d: any) => {
				const offers = (d.offers || []).filter((h: any) => !h.path || present.has(h.path));
				const settlements = (d.settlements || []).filter(
					(h: any) => !h.path || present.has(h.path)
				);
				if (
					offers.length === (d.offers || []).length &&
					settlements.length === (d.settlements || []).length
				)
					return d;
				changed = true;
				return { ...d, offers, settlements };
			});
			if (changed) {
				console.log('🧹 [storage] Pruned offer/settlement links whose PDFs were deleted.');
				await saveToDatabase(updated);
			}
		} catch (err) {
			console.error('❌ [storage] Reconciliation failed:', err);
		}
	}

	// Default template contents, cached for change detection + PDF fallback.
	let defaultTcContent = '';
	let defaultDealTermsContent = '';

	// Fresh revenue/costs straight from the DB. The event object's snapshot goes
	// stale as soon as the Revenue/Costs tabs save, so offers must never rely on
	// it — an offer generated from the snapshot printed all zeros.
	let freshRevenue: any = null;
	let freshCost: any = null;

	function parseMaybeJson(raw: any): any {
		if (!raw) return null;
		if (typeof raw === 'object') return raw;
		try {
			let p = JSON.parse(raw);
			if (typeof p === 'string') p = JSON.parse(p);
			return p;
		} catch {
			return null;
		}
	}

	async function loadFreshFinancials() {
		const targetId = event?.calendar?.id || event?.group_id || event?.id;
		if (!targetId) return;
		const { data } = await supabase
			.from('calendar_data')
			.select('event_revenue, event_cost')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum)
			.maybeSingle();
		if (data) {
			freshRevenue = parseMaybeJson(data.event_revenue);
			freshCost = parseMaybeJson(data.event_cost);
		}
	}

	$: offerRevenue = freshRevenue ?? parsedEventRevenue;
	$: offerCost = freshCost ?? parsedEventCost;

	// Same idea as loadFreshFinancials, for the deals themselves: sheets must
	// reflect the DB as it is right now (support deals / budgets added this
	// session included), even if local state lagged behind — no reload needed.
	async function loadFreshDeals(): Promise<void> {
		const targetId = event?.calendar?.id || event?.group_id || event?.id;
		if (!targetId) return;
		const { data } = await supabase
			.from('calendar_data')
			.select('event_deal')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum)
			.maybeSingle();
		const fresh = parseMaybeJson(data?.event_deal);
		if (fresh && typeof fresh === 'object' && Object.keys(fresh).length > 0) {
			eventDealData = fresh;
			setCachedDealPayload(event, viewedVersionNum, fresh);
			// Let deals / support / rates recompute before the caller reads them.
			await tick();
		}
	}

	// Light realtime: when this event's calendar_data row is updated (another
	// user or another tab), refresh the local copies. Read-only — never writes,
	// so it can't clobber unsaved local edits elsewhere.
	let dealDataChannel: any = null;

	function subscribeDealData() {
		const targetId = event?.calendar?.id || event?.group_id || event?.id;
		if (!targetId || dealDataChannel) return;
		dealDataChannel = supabase
			.channel(`deals-data-${targetId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'calendar_data',
					filter: `calendar_id=eq.${targetId}`
				},
				(payload: any) => {
					const row = payload?.new;
					if (!row || row.version_number !== viewedVersionNum) return;
					if (row.event_revenue !== undefined) freshRevenue = parseMaybeJson(row.event_revenue);
					if (row.event_cost !== undefined) freshCost = parseMaybeJson(row.event_cost);
					if (row.event_deal !== undefined) {
						const payloadDeal = parseMaybeJson(row.event_deal);
						if (payloadDeal) {
							eventDealData = payloadDeal;
							setCachedDealPayload(event, viewedVersionNum, payloadDeal);
						}
					}
				}
			)
			.subscribe();
	}

	onDestroy(() => {
		if (dealDataChannel) supabase.removeChannel(dealDataChannel);
	});

	onMount(async () => {
		subscribeDealData();
		getDefaultTcTemplate('Additional Terms and Conditions').then(
			(t) => (defaultTcContent = t?.content || '')
		);
		getDefaultTcTemplate('Deal Terms', eventTypeOf(event)).then(
			(t) => (defaultDealTermsContent = t?.content || '')
		);
		loadFreshFinancials();
		if (venueCurrency !== 'USD') {
			try {
				const res = await fetch('https://open.er-api.com/v6/latest/USD');
				const data = await res.json();
				if (data?.rates?.[venueCurrency]) {
					dailyApiRate = data.rates[venueCurrency];
					activeExchangeRate = useCustomRate ? customRate : dailyApiRate;
				}
			} catch (err) {
				console.error('Error fetching API rate:', err);
			} finally {
				rateReady = true;
			}
		} else {
			rateReady = true;
		}
	});

	function openCreateDeal() {
		dealToEdit = null;
		isCreatingDeal = true;
		activeMenuId = null;
	}

	function editDeal(deal: Deal) {
		dealToEdit = deal;
		isCreatingDeal = true;
		activeMenuId = null;
	}

	function deleteDeal(dealId: string) {
		dealToDeleteId = dealId;
		showDeleteModal = true;
		activeMenuId = null;
	}

	// --- Offer generation flow ---
	// Steps: rate (saved vs live FX differs) -> version (overwrite vs new when a
	// previous offer exists) -> confirm (first offer) -> generating -> done.
	type OfferStep = 'rate' | 'nochange' | 'version' | 'confirm' | 'generating' | 'done' | 'error';
	let showOfferModal = false;
	let offerDeal: Deal | null = null;
	let offerUpdating = false;
	let offerStep: OfferStep = 'confirm';
	let offerError = '';
	let lastGeneratedPath: string | null = null;
	let lastGeneratedNumber = 0;
	let offerSearch = '';
	let versionMenuId: string | null = null;

	function dealOffers(deal: Deal | null): OfferHistoryEntry[] {
		return Array.isArray(deal?.offers) ? (deal!.offers as OfferHistoryEntry[]) : [];
	}

	// Settlement sheet history, stored on the deal like offers are.
	interface SettlementEntry {
		n: number;
		variant: 'external' | 'internal';
		fileName: string;
		path: string;
		generatedAt: string;
		fingerprint?: string;
	}

	function dealSettlements(deal: Deal | null): SettlementEntry[] {
		return Array.isArray(deal?.settlements) ? (deal!.settlements as SettlementEntry[]) : [];
	}

	function settlementLabel(se: SettlementEntry): string {
		return `${se.variant === 'external' ? 'Ext.' : 'Int.'} Settlement`;
	}

	function latestSettlement(deal: Deal | null): SettlementEntry | null {
		const all = dealSettlements(deal);
		if (all.length === 0) return null;
		return all.reduce((a, b) =>
			new Date(a.generatedAt).getTime() >= new Date(b.generatedAt).getTime() ? a : b
		);
	}

	/** Everything that lands on a settlement sheet, per variant. */
	function settlementFingerprint(
		deal: Deal,
		variant: 'external' | 'internal',
		adjustments: { label: string; amount: number }[]
	): string {
		const payload = {
			v: 1,
			variant,
			adj: adjustments.map((a) => ({ l: a.label, a: a.amount })),
			d: {
				dealType: deal.dealType,
				guaranteeAmount: deal.guaranteeAmount,
				dealCurrency: deal.dealCurrency,
				w_tax: deal.w_tax,
				w_tax_amount: deal.w_tax_amount,
				details: deal.details,
				description: deal.description
			},
			rate: Number(resolveDealRate(deal).toFixed(6)),
			tickets: (offerRevenue?.tickets || []).map((t: any) => ({
				n: t.name,
				s: t.sold,
				x: t.extSold,
				p: t.price,
				f: t.ticketFees
			})),
			fin: offerRevenue?.financials || {},
			cost: offerCost || {},
			support: Number(additionalSupportActual) || 0
		};
		return hashString(JSON.stringify(payload));
	}

	function settlementsFor(deal: Deal, query: string): SettlementEntry[] {
		const q = (query || '').trim().toLowerCase();
		const ordered = dealSettlements(deal)
			.slice()
			.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
		if (!q) return ordered;
		return ordered.filter(
			(se) =>
				settlementLabel(se).toLowerCase().includes(q) ||
				formatOfferDate(se.generatedAt).toLowerCase().includes(q)
		);
	}

	function latestOffer(deal: Deal | null): OfferHistoryEntry | null {
		const offers = dealOffers(deal);
		return offers.length ? offers.reduce((a, b) => (a.n > b.n ? a : b)) : null;
	}

	/** Signed CA$ delta vs the previous offer number (null when unknown). */
	function offerDelta(deal: Deal, o: OfferHistoryEntry): number | null {
		if (o.total == null) return null;
		const ordered = dealOffers(deal).slice().sort((a, b) => a.n - b.n);
		const idx = ordered.findIndex((h) => h.n === o.n);
		if (idx <= 0) return null;
		const prev = ordered[idx - 1];
		if (prev?.total == null) return null;
		return o.total - prev.total;
	}

	function offerVersionsFor(deal: Deal, query: string): OfferHistoryEntry[] {
		const q = (query || '').trim().toLowerCase();
		const ordered = dealOffers(deal).slice().sort((a, b) => b.n - a.n);
		if (!q) return ordered;
		return ordered.filter(
			(o) =>
				`offer ${o.n}`.includes(q) ||
				formatOfferDate(o.generatedAt).toLowerCase().includes(q)
		);
	}

	function toggleVersionMenu(dealId: string) {
		offerSearch = '';
		versionMenuId = versionMenuId === dealId ? null : dealId;
	}

	// Deleting an offer version: confirm popup first, then remove the stored
	// PDF and the history entry. Works on the last remaining offer too.
	let offerDeleting = false;
	let offerDeleteTarget: {
		deal: Deal;
		kind: 'offer' | 'settlement';
		o?: OfferHistoryEntry;
		se?: SettlementEntry;
	} | null = null;

	function requestDeleteOffer(deal: Deal, o: OfferHistoryEntry) {
		offerDeleteTarget = { deal, kind: 'offer', o };
	}

	function requestDeleteSettlement(deal: Deal, se: SettlementEntry) {
		offerDeleteTarget = { deal, kind: 'settlement', se };
	}

	async function confirmDeleteOffer() {
		if (!offerDeleteTarget) return;
		const { deal, kind, o, se } = offerDeleteTarget;
		if (kind === 'offer' && o) await deleteOfferVersion(deal, o);
		if (kind === 'settlement' && se) await deleteSettlementVersion(deal, se);
		offerDeleteTarget = null;
	}

	async function deleteSettlementVersion(deal: Deal, se: SettlementEntry) {
		if (offerDeleting) return;
		offerDeleting = true;
		try {
			const newHistory = dealSettlements(deal).filter(
				(h) => !(h.n === se.n && h.variant === se.variant)
			);
			const updatedDeals = [...headlinerDeals, ...supportDeals].map((d) =>
				d.id === deal.id ? { ...d, settlements: newHistory } : d
			);
			await saveToDatabase(updatedDeals);
			if (newHistory.length === 0) versionMenuId = null;
			removeOfferPdf(se.path);
		} catch (err) {
			console.error('❌ [settlement] Failed to delete settlement version:', err);
		} finally {
			offerDeleting = false;
		}
	}

	async function deleteOfferVersion(deal: Deal, o: OfferHistoryEntry) {
		if (offerDeleting) return;
		offerDeleting = true;
		try {
			// Remove the entry first so the UI never blocks on a storage error.
			const newHistory = dealOffers(deal).filter((h) => h.n !== o.n);
			const updatedDeals = [...headlinerDeals, ...supportDeals].map((d) =>
				d.id === deal.id ? { ...d, offers: newHistory } : d
			);
			await saveToDatabase(updatedDeals);
			if (newHistory.length === 0) versionMenuId = null;
			removeOfferPdf(o.path); // fire-and-forget storage cleanup
		} catch (err) {
			console.error('❌ [offers] Failed to delete offer version:', err);
		} finally {
			offerDeleting = false;
		}
	}

	/** "22:00" / "10PM" / "10:00 PM" -> "10:00 PM Sun, Sep 6" (Prism style).
	 *  Curfew rolls to the next day when it lands at/before the start time. */
	function fmtEventTime(
		raw: string,
		dateIso: string,
		rollAfter: string | null = null
	): string {
		if (!raw) return '';
		const m = String(raw)
			.trim()
			.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
		if (!m) return String(raw);
		let hours = parseInt(m[1], 10);
		const mins = parseInt(m[2] || '0', 10);
		const ap = m[3]?.toLowerCase();
		if (ap === 'pm' && hours < 12) hours += 12;
		if (ap === 'am' && hours === 12) hours = 0;

		const base = new Date(dateIso?.length === 10 ? `${dateIso}T12:00:00` : dateIso);
		if (isNaN(base.getTime())) return String(raw);
		const d = new Date(base);
		d.setHours(hours, mins, 0, 0);

		if (rollAfter) {
			const s = fmtEventTimeParse(rollAfter);
			if (s != null && hours * 60 + mins <= s) d.setDate(d.getDate() + 1);
		}

		const timeStr = d
			.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
			.replace(/\u202f/g, ' ');
		const dayStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
		return `${timeStr} ${dayStr}`;
	}

	function fmtEventTimeParse(raw: string): number | null {
		const m = String(raw)
			.trim()
			.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
		if (!m) return null;
		let hours = parseInt(m[1], 10);
		const mins = parseInt(m[2] || '0', 10);
		const ap = m[3]?.toLowerCase();
		if (ap === 'pm' && hours < 12) hours += 12;
		if (ap === 'am' && hours === 12) hours = 0;
		return hours * 60 + mins;
	}

	function clickOutsideVersions(node: HTMLElement) {
		const handleClick = (e: MouseEvent) => {
			if (node && !node.contains(e.target as Node)) versionMenuId = null;
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	// ---- change detection: fingerprint of everything that lands on the sheet ----
	function hashString(str: string): string {
		let h = 5381;
		for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
		return (h >>> 0).toString(36);
	}

	function offerFingerprint(deal: Deal, revenue: any, cost: any): string {
		const d = {
			dealType: deal.dealType,
			guaranteeAmount: deal.guaranteeAmount,
			dealCurrency: deal.dealCurrency,
			w_tax: deal.w_tax,
			w_tax_amount: deal.w_tax_amount,
			cad_tax_type: deal.cad_tax_type,
			cad_qst: deal.cad_qst,
			cad_gst: deal.cad_gst,
			details: deal.details,
			deposits: deal.deposits,
			description: deal.description
		};
		// The other deals printed as Talent Pay expenses affect the sheet too.
		const others = deals
			.filter(
				(x: Deal) =>
					x.id !== deal.id &&
					!x.isPendingInfoOnly &&
					(x.role === 'Headliner' || x.includeInHeadlinerDeal === true)
			)
			.map((x: Deal) => ({
				id: x.id,
				g: x.guaranteeAmount,
				t: x.dealType,
				c: x.dealCurrency,
				r: Number(resolveDealRate(x).toFixed(6)),
				det: x.details
			}));

		const payload = {
			// Bump when the sheet layout changes so older offers regenerate once.
			v: 6,
			d,
			others,
			rate: Number(resolveDealRate(deal).toFixed(6)),
			tickets: (revenue?.tickets || []).map((t: any) => ({
				n: t.name,
				a: t.allotment,
				c: t.comps,
				k: t.kills,
				p: t.price,
				f: t.ticketFees
			})),
			fin: revenue?.financials || {},
			cost: cost || {},
			support: Number(additionalSupportBudgeted) || 0,
			terms: currentDealData?.termsAndConditions?.content ?? defaultTcContent,
			dealTerms: currentDealData?.dealTerms?.content ?? defaultDealTermsContent
		};
		return hashString(JSON.stringify(payload));
	}

	/** True when the latest generated offer already reflects the current data. */
	function offerUpToDate(deal: Deal, revenue: any, cost: any): boolean {
		const latest = latestOffer(deal);
		return (
			!!latest &&
			!!latest.fingerprint &&
			latest.fingerprint === offerFingerprint(deal, revenue, cost)
		);
	}

	// After the rate question: warn when nothing changed since the last offer,
	// then continue to the overwrite/new choice.
	function nextOfferStep(deal: Deal): OfferStep {
		const latest = latestOffer(deal);
		if (!latest) return 'confirm';
		if (offerUpToDate(deal, offerRevenue, offerCost)) return 'nochange';
		return 'version';
	}

	// Info-only rate prompt: the rate changed since the last offer, but there's
	// nothing to "update" (custom rate / locked) — the user just confirms it.
	let offerRateInfoOnly = false;
	let offerPrevRate: number | null = null;

	function openOfferModal(deal: Deal) {
		activeMenuId = null;
		versionMenuId = null;
		// Refresh in the background so the change-detection step compares
		// against the live DB state, not a stale snapshot.
		loadFreshDeals();
		loadFreshFinancials();
		// In Settlement / Settled: offers are frozen — settlement takes over.
		if (isLockedStage) {
			openSettlementModal(deal);
			return;
		}
		offerDeal = deal;
		offerError = '';
		lastGeneratedPath = null;

		const ratesMatch = Math.abs(resolveDealRate(deal) - markedUpLiveRate(deal)) < 0.00005;
		const noConversion = deal.dealCurrency === venueCurrency;
		// Custom rate set in Settings: it's the chosen rate — nothing to update.
		const rateLocked = (isLockedStage && !!lockedExchangeRate) || useCustomRate;

		// Did the effective rate change since the previous offer was generated?
		// Prompt even when the rate is manually forced (custom / locked).
		const latest = latestOffer(deal);
		offerPrevRate = latest?.rate ?? null;
		const rateChangedSinceLast =
			offerPrevRate != null && Math.abs(resolveDealRate(deal) - offerPrevRate) >= 0.00005;

		const needsUpdatePrompt = !ratesMatch && !noConversion && !rateLocked;
		offerRateInfoOnly = !needsUpdatePrompt && rateChangedSinceLast && !noConversion;

		offerStep = needsUpdatePrompt || offerRateInfoOnly ? 'rate' : nextOfferStep(deal);
		showOfferModal = true;
	}

	function closeOfferModal() {
		showOfferModal = false;
		offerDeal = null;
		offerUpdating = false;
		offerStep = 'confirm';
		offerError = '';
		offerRateInfoOnly = false;
		offerPrevRate = null;
	}

	async function updateOfferRate() {
		if (!offerDeal || offerUpdating) return;
		offerUpdating = true;
		// Map over the displayed (ordered) lists so a rate update never reverts
		// a reorder that's reflected on screen.
		const updatedDeals = [...headlinerDeals, ...supportDeals].map((d) =>
			d.id === offerDeal!.id
				? {
						...d,
						savedExchangeRate: dailyApiRate,
						savedExchangeRateAt: new Date().toISOString()
					}
				: d
		);
		await saveToDatabase(updatedDeals);
		// Point at the refreshed deal so generation uses the new rate.
		offerDeal = updatedDeals.find((d) => d.id === offerDeal!.id) || offerDeal;
		offerUpdating = false;
		offerStep = nextOfferStep(offerDeal!);
	}

	function keepOfferRate() {
		if (!offerDeal) return;
		offerStep = nextOfferStep(offerDeal);
	}

	// ---- Prism-style content builders ----
	function offerHotelText(deal: Deal): string {
		const h = deal.description?.hotels;
		if (!h?.enabled) return '';
		const parts: string[] = [];
		const suites = Number(h.suites) || 0;
		const roomsN = Number(h.rooms) || 0;
		if (suites > 0) parts.push(`${suites} suite${suites === 1 ? '' : 's'}`);
		if (roomsN > 0) parts.push(`${roomsN} room${roomsN === 1 ? '' : 's'}`);
		if (h.custom_room && h.custom_name)
			parts.push(`${Number(h.custom_amount) || 0} ${h.custom_name}`);
		if (parts.length === 0) return '';
		const nights = Number(h.nights) || 0;
		return `${parts.join(' + ')} for ${nights} night${nights === 1 ? '' : 's'}`;
	}

	/** "$25,000.00 Versus 65.00% of Net Revenue after Taxes, Fees, and Agreed
	 *  Expenses (subject to w holding tax) plus 3 rooms for 1 night + ground + exemption" */
	function offerDealParagraph(deal: Deal): string {
		let summary = deal.summaryText || '';
		if (!summary && deal.dealType === 'Flat' && Number(deal.guaranteeAmount) > 0) {
			summary = `$${formatMoney(deal.guaranteeAmount)} Flat`;
		}
		// Prism wording for cost-based split points.
		summary = summary.replace(/after Costs\b/g, 'after Taxes, Fees, and Agreed Expenses');
		// Strip the currency-code prefix ("USD $25,000.00 ..." -> "$25,000.00 ...").
		summary = summary.replace(/^(USD|CAD|EUR|GBP)\s+\$/, '$');

		const parts: string[] = [];
		if (summary) parts.push(summary);

		if (deal.dealCurrency === 'CAD') {
			if (deal.cad_tax_type === 'Taxes') {
				const taxes = [deal.cad_qst ? 'QST' : '', deal.cad_gst ? 'GST' : ''].filter(Boolean);
				if (taxes.length > 0) parts.push(`( +${taxes.join(' & ')} )`);
			}
		} else if (deal.w_tax) {
			parts.push('(subject to w holding tax)');
		}

		const logi: string[] = [];
		const hotel = offerHotelText(deal);
		if (hotel) logi.push(hotel);
		if (deal.description?.groundTransport?.enabled) logi.push('ground');
		if (deal.description?.immigration?.enabled) logi.push('exemption');
		if (logi.length > 0) parts.push(`plus ${logi.join(' + ')}`);

		return parts.join(' ');
	}

	/** Prism-style deposit schedule lines from the deal's deposits. */
	function offerDepositLines(deal: Deal): string[] {
		const deps = Array.isArray(deal.deposits) ? deal.deposits : [];
		return deps.map((d: any, i: number) => {
			const amt =
				d.type === 'Percent'
					? `${d.amount}%`
					: `${deal.dealCurrency || 'USD'} $${formatMoney(Number(d.amount) || 0)}`;
			const due =
				d.dueDateType === 'Specific'
					? d.specificDate
						? ` due ${fmtLongDate(d.specificDate)}`
						: ''
					: d.daysBeforeEvent
						? ` due ${d.daysBeforeEvent} days before the event`
						: ' due on signing';
			return `DEPOSIT ${deps.length > 1 ? `${i + 1} ` : ''}— ${amt}${due}`;
		});
	}

	function fmtLongDate(input: string | Date): string {
		const d =
			typeof input === 'string'
				? new Date(input.length === 10 ? `${input}T12:00:00` : input)
				: input;
		if (!d || isNaN(d.getTime())) return String(input || '');
		return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	/** Sellout walkout for any deal (venue currency). Per-ticket / flat-bonus
	 *  amounts are entered in the deal currency, so they convert at the rate —
	 *  matches the Prism sheet ("Plus $5,000.00" -> CA$6,925.00 @ 1.385). */
	function offerWalkoutVenue(
		d: Deal,
		ctx: { gross: number; netGross: number; costs: number; paidTickets: number; totalAllotment: number },
		rate: number
	): number {
		const guarVenue = (Number(d.guaranteeAmount) || 0) * rate;
		if (d.dealType === 'Flat' || !d.details) return guarVenue;
		const metricType = d.details.metricType || '';
		const convert = metricType === 'Per Ticket' || metricType === 'Flat' ? rate : 1;
		const backend =
			computeBackend(
				{ dealType: d.dealType, guaranteeAmount: d.guaranteeAmount, details: d.details },
				{ ...ctx, exchangeRate: rate }
			) * convert;
		if (d.dealType === 'Versus') return Math.max(guarVenue, backend);
		if (d.dealType === 'Door Deal') return backend;
		if (d.dealType === 'Plus') {
			// Flat bonuses: sum every bonus achieved at sellout. The single-bonus
			// UI stores the amount in details.metricAmount (bonusAmount stays 0).
			if (metricType === 'Flat' && Array.isArray(d.details.bonuses) && d.details.bonuses.length) {
				let sum = 0;
				d.details.bonuses.forEach((b: any, i: number) => {
					const amt =
						Number(b.bonusAmount) || (i === 0 ? Number(d.details!.metricAmount) || 0 : 0);
					const at = Number(b.atAmount) || 0;
					const achieved =
						b.switchesAt === '% Sell Through'
							? ctx.totalAllotment > 0 && (ctx.paidTickets / ctx.totalAllotment) * 100 >= at
							: ctx.paidTickets >= at;
					if (achieved) sum += amt * rate;
				});
				return guarVenue + sum;
			}
			return guarVenue + backend;
		}
		return guarVenue;
	}

	async function generateOffer(mode: 'overwrite' | 'new') {
		if (!offerDeal) return;
		offerStep = 'generating';
		offerError = '';

		try {
			// Always generate from the live DB state, never the page-load snapshot.
			await Promise.all([loadFreshFinancials(), loadFreshDeals()]);

			// Re-point at the refreshed copy of this deal (same id, fresh fields).
			const deal = deals.find((d) => d.id === offerDeal!.id) || offerDeal;
			offerDeal = deal;
			const history = dealOffers(deal);
			const lastN = history.length ? Math.max(...history.map((h) => h.n)) : 0;
			const n = mode === 'overwrite' && lastN > 0 ? lastN : lastN + 1;
			const prevEntry = mode === 'overwrite' ? history.find((h) => h.n === n) : null;
			const rate = resolveDealRate(deal);
			const cur = currencyPrefix(venueCurrency);
			const conversion = deal.dealCurrency !== venueCurrency;
			const dealCur = deal.dealCurrency || 'USD';

			// Prism layout variant: Versus/Door split offers vs Flat/Plus payouts.
			const isSplitDeal = deal.dealType === 'Versus' || deal.dealType === 'Door Deal';
			// Support sheets show the EVENT split point: included support deals
			// (the artist itself among them) — never the headliner's payout.
			const isSupportSheet = deal.role === 'Support';
			const splitPresentation = isSplitDeal || isSupportSheet;

			// ---- Venue settings (address, financials fallback, logo) ----
			let venueName = 'Venue';
			let venueRoom = '';
			let venueAddress: string[] = [];
			let venueParams: any = null;
			try {
				const v = typeof event?.venue === 'string' ? JSON.parse(event.venue) : event?.venue || {};
				venueName = v.category || venueName;
				venueRoom = v.room || '';
				if (v.category) {
					const { data: sd } = await supabase
						.from('calendar_settings')
						.select('setting_params')
						.eq('setting_name', v.category)
						.eq('setting_type', 'VENUE')
						.maybeSingle();
					venueParams =
						typeof sd?.setting_params === 'string'
							? JSON.parse(sd.setting_params)
							: sd?.setting_params;
					const loc = venueParams?.location;
					if (loc) {
						if (loc.street) venueAddress.push(loc.street);
						if (loc.line2) venueAddress.push(loc.line2);
						const cityLine = [loc.city, [loc.state, loc.zip].filter(Boolean).join(' '), loc.country]
							.filter(Boolean)
							.join(', ');
						if (cityLine) venueAddress.push(cityLine);
					}
				}
			} catch {}

			// ---- Ticket scaling at sellout (sellable x price) ----
			const revenue = offerRevenue || {};
			const rawTickets: any[] = Array.isArray(revenue.tickets) ? revenue.tickets : [];
			const fin = revenue.financials || {};
			const vFin = venueParams?.financials || {};
			// The venue settings are the source of truth when the event revenue
			// hasn't stored its own tax setup yet.
			const taxRate = Number(fin.taxRate) || Number(vFin.taxRate) || 0;
			const taxType = fin.taxType || vFin.taxType || 'Divisor';
			const facilityFee = Number(fin.facilityFee ?? vFin.facilityFee) || 0;

			let grossPotential = 0;
			let fees = 0;
			const baseTickets = rawTickets.map((t: any) => {
				const allotment = Number(t.allotment) || 0;
				const comps = Number(t.comps) || 0;
				const kills = Number(t.kills) || 0;
				const sellable = Math.max(0, allotment - comps - kills);
				const price = Number(t.price) || 0;
				const gross = sellable * price;
				grossPotential += gross;
				fees += sellable * ((Number(t.ticketFees) || 0) + facilityFee);
				return {
					name: t.name || 'Ticket',
					allotment,
					comps,
					sellable,
					price,
					perTicketFees: (Number(t.ticketFees) || 0) + facilityFee,
					gross
				};
			});
			const taxable = grossPotential - fees;
			const taxes =
				taxType === 'Multiplier'
					? taxable * (taxRate / 100)
					: taxable - taxable / (1 + taxRate / 100);
			const netGrossPotential = grossPotential - taxes - fees;
			const sellablePotential = baseTickets.reduce((sum, t) => sum + t.sellable, 0);
			const totalAllotment = baseTickets.reduce((sum, t) => sum + t.allotment, 0);
			const selloutCtx = {
				gross: grossPotential,
				netGross: netGrossPotential,
				costs: 0, // set below once expenses are known (split deals)
				paidTickets: sellablePotential,
				totalAllotment
			};

			// ---- Fixed expense groups (offer budget, Category > Type) ----
			const cost = offerCost || {};
			const fixedGroupMap = new Map<
				string,
				{ rows: { name: string; amount: number }[]; total: number }
			>();
			const pushFixed = (key: string, name: string, amount: number) => {
				if (!fixedGroupMap.has(key)) fixedGroupMap.set(key, { rows: [], total: 0 });
				const g = fixedGroupMap.get(key)!;
				g.rows.push({ name, amount });
				g.total += amount;
			};
			(Array.isArray(cost.fixedCosts) ? cost.fixedCosts : []).forEach((g: any) => {
				const key = `${g.category || 'General'} > ${g.type && g.type !== '(No Type)' ? g.type : 'General'}`;
				(Array.isArray(g.costs) ? g.costs : []).forEach((line: any) => {
					if (line.reported === false) return;
					const qty = Number(line.qty) || 0;
					const unit = Number(line.cost) || 0;
					const amount = qty * unit;
					if (amount === 0) return;
					const name =
						qty > 1
							? `${line.name || 'Cost'} (${qty} @ ${cur}${moneyNum(unit)})`
							: line.name || 'Cost';
					pushFixed(key, name, amount);
				});
			});
			const fixedTotal = Array.from(fixedGroupMap.values()).reduce((sum, g) => sum + g.total, 0);

			// ---- Variable expenses (own Prism section) ----
			const variableRows: { name: string; type: string; amount: string; potential: string }[] = [];
			let variableTotal = 0;
			(Array.isArray(cost.variableCosts) ? cost.variableCosts : []).forEach((v: any) => {
				if (v.reported === false) return;
				const m = Number(v.externalAmount ?? v.internalAmount) || 0;
				if (m === 0) return;
				let amount = 0;
				let amountLabel = '';
				switch (v.type) {
					case 'Flat':
						amount = m;
						amountLabel = `$${moneyNum(m)}`;
						break;
					case '% of Gross':
						amount = (m / 100) * grossPotential;
						amountLabel = `${m}%`;
						break;
					case '% of Net Gross':
						amount = (m / 100) * netGrossPotential;
						amountLabel = `${m}%`;
						break;
					case '$ per Paid Ticket':
					case '$ per Attendee':
						amount = m * sellablePotential;
						amountLabel = `$${moneyNum(m)}`;
						break;
				}
				variableRows.push({
					name: v.name || 'Variable Cost',
					type: v.type || 'Flat',
					amount: amountLabel,
					potential: `$${moneyNum(amount)}`
				});
				variableTotal += amount;
			});

			// ---- Talent pay: the other deals on this event (+ additional support) ----
			const otherDeals = deals.filter((d: Deal) => {
				if (d.isPendingInfoOnly || !d.artistName) return false;
				if (isSupportSheet) {
					// Event split point: included support deals only (self included),
					// never the headliner.
					return d.role === 'Support' && d.includeInHeadlinerDeal === true;
				}
				return (
					d.id !== deal.id && (d.role === 'Headliner' || d.includeInHeadlinerDeal === true)
				);
			});
			const talentRows: { name: string; amount: number }[] = [];
			let otherTalentTotal = 0;
			for (const d of otherDeals) {
				const amt = offerWalkoutVenue(d, selloutCtx, resolveDealRate(d));
				if (amt === 0) continue;
				talentRows.push({
					name: `(${d.role === 'Headliner' ? 'H' : 'S'}) ${d.artistName}`,
					amount: amt
				});
				otherTalentTotal += amt;
			}
			const supportBudget = Number(additionalSupportBudgeted) || 0;
			if (supportBudget > 0) {
				talentRows.push({ name: 'Additional Support', amount: supportBudget });
			}

			// Expenses that are NOT this deal's own payout — the split point basis
			// and the Break Even target.
			const expensesExclSelf = fixedTotal + variableTotal + otherTalentTotal + supportBudget;
			selloutCtx.costs = expensesExclSelf;

			// ---- This deal's walkout + offer band rows ----
			const guarVenue = (Number(deal.guaranteeAmount) || 0) * rate;
			const walkout = offerWalkoutVenue(deal, selloutCtx, rate);
			const pair = (venueAmt: number) =>
				conversion
					? `$${moneyNum(rate > 0 ? venueAmt / rate : 0)} | ${cur}${moneyNum(venueAmt)}`
					: `${cur}${moneyNum(venueAmt)}`;

			// "(subject to w holding tax) plus 3 rooms for 1 night + ground + exemption"
			const suffixParts: string[] = [];
			if (dealCur === 'CAD') {
				if (deal.cad_tax_type === 'Taxes') {
					const t = [deal.cad_qst ? 'QST' : '', deal.cad_gst ? 'GST' : ''].filter(Boolean);
					if (t.length > 0) suffixParts.push(`( +${t.join(' & ')} )`);
				}
			} else if (deal.w_tax) {
				suffixParts.push('(subject to w holding tax)');
			}
			const logi: string[] = [];
			const hotel = offerHotelText(deal);
			if (hotel) logi.push(hotel);
			if (deal.description?.groundTransport?.enabled) logi.push('ground');
			if (deal.description?.immigration?.enabled) logi.push('exemption');
			if (logi.length > 0) suffixParts.push(`plus ${logi.join(' + ')}`);
			const dealSuffix = suffixParts.join(' ');

			const fxNote = conversion
				? `(FX RATE ${dealCur} = ${venueCurrency}/${rate.toFixed(4)})`
				: undefined;

			// Offer summary rows (label + gray note + "$USD | CA$CAD" value)
			const offerRows: {
				label: string;
				note?: string;
				value: string;
				accent?: boolean;
				emphasis?: boolean;
			}[] = [];
			if (isSplitDeal) {
				// "$25,000.00 Versus 65.00% of Net Revenue after Taxes, Fees, and
				// Agreed Expenses" with the tax/logistics sentence as the note.
				let summary = deal.summaryText || `${deal.dealType} Deal`;
				summary = summary.replace(/after Costs\b/g, 'after Taxes, Fees, and Agreed Expenses');
				summary = summary.replace(/after (USD|CAD|EUR|GBP)\$[\d,.]+/g, 'after Taxes, Fees, and Agreed Expenses');
				summary = summary.replace(/^(USD|CAD|EUR|GBP)\s+\$/, '$');
				offerRows.push({
					label: summary,
					note: dealSuffix || undefined,
					value: pair(walkout),
					accent: true
				});
			} else {
				offerRows.push({
					label: 'Guarantee',
					note: dealSuffix || undefined,
					value: pair(guarVenue),
					accent: true
				});
				if (deal.dealType === 'Plus' && deal.details) {
					const metricType = deal.details.metricType || '';
					const bonuses =
						metricType === 'Flat' && Array.isArray(deal.details.bonuses)
							? deal.details.bonuses
							: [];
					bonuses.forEach((b: any, i: number) => {
						// Single-bonus deals keep the amount in metricAmount.
						const amt =
							Number(b.bonusAmount) || (i === 0 ? Number(deal.details?.metricAmount) || 0 : 0);
						const at = Number(b.atAmount) || 0;
						const achieved =
							b.switchesAt === '% Sell Through'
								? totalAllotment > 0 && (sellablePotential / totalAllotment) * 100 >= at
								: sellablePotential >= at;
						// Offers translate % sell-through into the actual ticket count:
						// "after 2500 (100%) sold". Deal tab summaries stay untouched.
						const atText =
							b.switchesAt === '% Sell Through'
								? `${Math.round((at / 100) * sellablePotential).toLocaleString('en-US')} (${at}%) sold`
								: `${at} tickets sold`;
						offerRows.push({
							label: `Plus $${moneyNum(amt)} after ${atText}`,
							value: achieved ? pair(amt * rate) : pair(0)
						});
					});
					if (bonuses.length === 0 && walkout > guarVenue) {
						offerRows.push({ label: 'Plus backend at sellout', value: pair(walkout - guarVenue) });
					}
				}
				// Retroactive bonus terms (printed, not added to the total)
				if (deal.details?.retroactiveBonusEnabled && Array.isArray(deal.details.retroactiveBonuses)) {
					for (const rb of deal.details.retroactiveBonuses) {
						const amt = Number(rb.bonusAmount) || 0;
						if (amt === 0) continue;
						const at = Number(rb.atAmount) || 0;
						const isPct = (deal.details.retroactiveSwitchesAt || '% Sell Through') === '% Sell Through';
						const atText = isPct
							? `${Math.round((at / 100) * sellablePotential).toLocaleString('en-US')} (${at}%) sold`
							: `${at} tickets sold`;
						offerRows.push({
							label: `Retroactive: switches to $${moneyNum(amt)} after ${atText}`,
							value: ''
						});
					}
				}
				if (offerRows.length > 1) {
					offerRows.push({
						label: 'Total Potential Payout',
						value: pair(walkout),
						emphasis: true
					});
				}
			}

			// ---- Expense sections (variant-dependent, like Prism) ----
			const expenseGroups: { title: string; rows: { name: string; amount: number }[]; total: number }[] = [];
			let fixedBandLabel: string;
			let fixedBandTotal: number;

			if (splitPresentation) {
				// Split point excludes the headliner's payout (the split recipient).
				fixedBandLabel = 'Fixed Expenses';
				fixedBandTotal = fixedTotal + otherTalentTotal + supportBudget;
				if (talentRows.length > 0) {
					expenseGroups.push({
						title: 'Talent Pay Included in Split Expense',
						rows: talentRows,
						total: otherTalentTotal + supportBudget
					});
				}
			} else {
				// Flat/Plus: this deal's payout is itself an expense line.
				const selfRow = {
					name: `(${deal.role === 'Headliner' ? 'H' : 'S'}) ${deal.artistName}`,
					amount: walkout
				};
				fixedBandLabel = 'Fixed Expenses + Artist Payout';
				fixedBandTotal = fixedTotal + otherTalentTotal + supportBudget + walkout;
				expenseGroups.push({
					title: 'Talent Pay',
					rows: [selfRow, ...talentRows],
					total: otherTalentTotal + supportBudget + walkout
				});
			}
			for (const [title, g] of fixedGroupMap.entries()) {
				expenseGroups.push({ title, rows: g.rows, total: g.total });
			}

			// ---- Break Even: (guarantee + expenses excl. own payout) / net price ----
			const breakEvenTarget = guarVenue + expensesExclSelf;
			const tickets = baseTickets.map((t) => {
				let netUnit = taxType === 'Multiplier' ? t.price : t.price / (1 + taxRate / 100);
				netUnit -= t.perTicketFees;
				return {
					name: t.name,
					allotment: t.allotment,
					comps: t.comps,
					sellable: t.sellable,
					price: t.price,
					breakEven:
						netUnit > 0 && breakEvenTarget > 0 ? Math.round(breakEvenTarget / netUnit) : null,
					gross: t.gross
				};
			});

			// ---- Event Summary rows ----
			const taxLabel = `Ticket Sales Tax (${taxRate}% sales tax)`;
			const summaryRows: { label: string; value: string; strong?: boolean }[] = [
				{ label: 'Gross Potential', value: `${cur}${moneyNum(grossPotential)}` },
				{ label: taxLabel, value: `-${cur}${moneyNum(taxes)}` }
			];
			if (fees > 0) summaryRows.push({ label: 'Ticket Fees', value: `-${cur}${moneyNum(fees)}` });
			summaryRows.push({
				label: 'Net Gross Potential',
				value: `${cur}${moneyNum(netGrossPotential)}`
			});
			if (splitPresentation) {
				summaryRows.push({
					label: 'Fixed Expenses',
					value: `-${cur}${moneyNum(fixedBandTotal + variableTotal)}`
				});
				const netToSplit = netGrossPotential - (fixedBandTotal + variableTotal);
				summaryRows.push({
					label: 'Net Revenue to Split',
					value: `${cur}${moneyNum(netToSplit)}`,
					strong: true
				});
				const pct = Number(deal.details?.metricAmount) || 0;
				if (deal.details?.metricType?.startsWith('%') && pct > 0) {
					summaryRows.push({
						label: `${pct}% of Net Revenue`,
						value: `${cur}${moneyNum((pct / 100) * Math.max(0, netToSplit))}`,
						strong: true
					});
				}
			} else {
				summaryRows.push({
					label: 'Fixed Expenses + Artist Payout',
					value: `-${cur}${moneyNum(fixedBandTotal)}`
				});
				summaryRows.push({
					label: 'Variable Expenses',
					value: `-${cur}${moneyNum(variableTotal)}`
				});
			}

			// ---- Contacts ----
			let contacts: { name: string; role: string; email: string; phone: string }[] = [];
			try {
				const targetId = event?.calendar?.id || event?.group_id || event?.id;
				const { data: cRow } = await supabase
					.from('calendar_data')
					.select('contacts')
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum)
					.maybeSingle();
				contacts = (Array.isArray(cRow?.contacts) ? cRow.contacts : [])
					.filter((c: any) => c?.enabled !== false)
					.map((c: any) => ({
						name: c.fullName || '',
						role: c.role || '',
						email: c.email || '',
						phone: c.phone || ''
					}))
					.filter((c: any) => c.name || c.email);
			} catch {}

			// ---- T&C ----
			const terms = currentDealData?.termsAndConditions?.content ?? defaultTcContent;

			// ---- Multi-date events: one offer covers every show in the group ----
			let eventDates: string[] = eventDate ? [eventDate] : [];
			try {
				const gid = event?.group_id || event?.calendar?.id;
				if (gid) {
					const { data: sibs } = await supabase
						.from('calendar_events')
						.select('start_date, date')
						.eq('group_id', gid);
					const all = (sibs || [])
						.map((r: any) => r.start_date || r.date)
						.filter(Boolean)
						.map((d: string) => d.slice(0, 10));
					if (all.length > 1) eventDates = Array.from(new Set(all)).sort();
				}
			} catch {}
			const dateLabel =
				eventDates.length > 1
					? `${fmtLongDate(eventDates[0])} - ${fmtLongDate(eventDates[eventDates.length - 1])}`
					: eventDate
						? fmtLongDate(eventDate)
						: event?.calendar?.title || '';

			// ---- Event details (Prism: Age Limit, Offer Sent, Date, Doors, Curfew) ----
			let expiryDays = 14;
			const eventDetails: { label: string; value: string }[] = [];
			try {
				const defaults = await getOfferEventDefaults();
				expiryDays = defaults.offerExpiryDays || 14;
				if (defaults.ageLimit) eventDetails.push({ label: 'Age Limit', value: defaults.ageLimit });
			} catch {}
			eventDetails.push({ label: 'Offer Sent', value: fmtLongDate(new Date()) });
			if (eventDates.length > 0)
				eventDetails.push({
					label: 'Event Date(s)',
					value: eventDates.map((d) => fmtLongDate(d)).join('  ·  ')
				});
			try {
				const time = typeof event?.time === 'string' ? JSON.parse(event.time) : event?.time;
				if (time?.start)
					eventDetails.push({
						label: 'Doors Open',
						value: fmtEventTime(time.start, eventDate)
					});
				if (time?.end)
					eventDetails.push({
						label: 'Curfew (Hard)',
						value: fmtEventTime(time.end, eventDate, time.start || null)
					});
			} catch {}
			const st = deal.description?.setTimes;
			if (st?.enabled && st.from)
				eventDetails.push({ label: 'Set Times', value: `${st.from}${st.to ? ` - ${st.to}` : ''}` });

			const fingerprint = offerFingerprint(deal, offerRevenue, offerCost);

			const blob = await buildOfferPdf({
				offerNumber: n,
				generatedAt: new Date(),
				artistName: deal.artistName,
				dateLabel,
				role: deal.role,
				venueName,
				venueRoom,
				venueAddress,
				logoUrl: '/images/NCG-Produkt.png',
				fxNote,
				offerRows,
				eventDetails,
				eventSummary: summaryRows,
				venueCurrency,
				tickets,
				scalingFooter: [
					{ label: taxLabel, value: `-$${moneyNum(taxes)}`, underline: true },
					{ label: 'Net Gross Potential', value: `$${moneyNum(netGrossPotential)}`, strong: true }
				],
				expenseSummaryLabel: splitPresentation ? 'Split Point Summary' : 'Expense Summary',
				expenseSummaryValue: splitPresentation
					? `Total: ${cur}${moneyNum(fixedBandTotal + variableTotal)}`
					: `Total Expenses ${cur}${moneyNum(fixedBandTotal + variableTotal)}`,
				totalExpenses: fixedBandTotal + variableTotal,
				fixedBandLabel,
				fixedBandTotal,
				expenseGroups,
				variableRows,
				variableTotal,
				contacts,
				dealTermsLine: `OFFER EXPIRES ${expiryDays} CALENDAR DAYS FROM "OFFER SENT" DATE.`,
				depositLines: offerDepositLines(deal),
				dealTermsContent: currentDealData?.dealTerms?.content ?? defaultDealTermsContent,
				termsAndConditions: terms,
				logoFallbackUrl: venueParams?.logoUrl || undefined
			});

			const fileName = buildOfferFileName(eventDate, deal.artistName, n);
			const path = await uploadOfferPdf(fileName, blob);
			if (!path) throw new Error('Upload failed');

			// A true overwrite: if the old file for this offer number lived at a
			// different path (old naming scheme, renamed artist), delete it.
			if (prevEntry && prevEntry.path && prevEntry.path !== path) {
				await removeOfferPdf(prevEntry.path);
			}

			// ---- Record history on the deal + persist ----
			const entry: OfferHistoryEntry = {
				n,
				fileName,
				path,
				generatedAt: new Date().toISOString(),
				rate,
				total: walkout, // venue currency — used for version deltas
				fingerprint
			};
			const newHistory =
				mode === 'overwrite' && lastN > 0
					? history.map((h) => (h.n === n ? entry : h))
					: [...history, entry];
			// Stamp the rate that was actually used so every surface (and the next
			// offer) reuses it even when the live rate moves later.
			const sameCurrency = deal.dealCurrency === venueCurrency;
			const usedBaseRate = Number(resolveBaseRate(deal).toFixed(6));
			const updatedDeals = [...headlinerDeals, ...supportDeals].map((d) =>
				d.id === deal.id
					? {
							...d,
							offers: newHistory,
							...(sameCurrency
								? {}
								: {
										savedExchangeRate: usedBaseRate,
										savedExchangeRateAt: new Date().toISOString()
									})
						}
					: d
			);
			await saveToDatabase(updatedDeals);

			lastGeneratedPath = path;
			lastGeneratedNumber = n;
			// Open the PDF right away and dismiss the modal — no done step.
			openOfferPretty(deal.artistName, n);
			closeOfferModal();
		} catch (err) {
			console.error('❌ [offers] Failed to generate offer:', err);
			offerError = 'Something went wrong while generating the offer.';
			offerStep = 'error';
		}
	}

	// --- Settlement sheets (Prism-style: actuals, Budget/Actual/Variance,
	// withholding + manual adjustments, settlement signatures) ---
	let showSettlementModal = false;
	let settlementDeal: Deal | null = null;
	let settlementGenerating = false;
	let settlementError = '';
	let adjDraft: { id: string; label: string; amount: number }[] = [];

	let settlementConfirm: 'external' | 'internal' | null = null;

	function openSettlementModal(deal: Deal) {
		activeMenuId = null;
		settlementDeal = deal;
		settlementError = '';
		settlementConfirm = null;
		adjDraft = JSON.parse(JSON.stringify(deal.settlementAdjustments || []));
		showSettlementModal = true;
	}

	/** Generate, but warn first when nothing changed since the last sheet. */
	function attemptGenerateSettlement(variantMode: 'external' | 'internal') {
		if (!settlementDeal) return;
		const cleanAdj = adjDraft.filter((a) => a.label.trim() !== '' || Number(a.amount) !== 0);
		const existing = dealSettlements(settlementDeal).find((se) => se.variant === variantMode);
		const unchanged =
			!!existing &&
			!!(existing as any).fingerprint &&
			(existing as any).fingerprint === settlementFingerprint(settlementDeal, variantMode, cleanAdj);
		if (unchanged && settlementConfirm !== variantMode) {
			settlementConfirm = variantMode;
			return;
		}
		settlementConfirm = null;
		generateSettlement(variantMode);
	}

	function closeSettlementModal() {
		showSettlementModal = false;
		settlementDeal = null;
		settlementGenerating = false;
		settlementError = '';
	}

	function addAdjustment() {
		adjDraft = [...adjDraft, { id: crypto.randomUUID(), label: '', amount: 0 }];
	}

	function removeAdjustment(id: string) {
		adjDraft = adjDraft.filter((a) => a.id !== id);
	}

	async function generateSettlement(variantMode: 'external' | 'internal') {
		if (!settlementDeal || settlementGenerating) return;
		settlementGenerating = true;
		settlementError = '';
		try {
			await Promise.all([loadFreshFinancials(), loadFreshDeals()]);
			const deal = deals.find((d) => d.id === settlementDeal!.id) || settlementDeal;
			settlementDeal = deal;
			const external = variantMode === 'external';

			// Persist the adjustments on the deal first.
			const cleanAdj = adjDraft.filter((a) => a.label.trim() !== '' || Number(a.amount) !== 0);
			const updatedDeals = [...headlinerDeals, ...supportDeals].map((d) =>
				d.id === deal.id ? { ...d, settlementAdjustments: cleanAdj } : d
			);
			await saveToDatabase(updatedDeals);

			const rate = resolveDealRate(deal);
			const cur = currencyPrefix(venueCurrency);
			const conversion = deal.dealCurrency !== venueCurrency;
			const dealCur = deal.dealCurrency || 'USD';
			const isSplitDeal = deal.dealType === 'Versus' || deal.dealType === 'Door Deal';
			// Support sheets show the EVENT split point (included support deals,
			// the artist itself among them) — never the headliner's payout.
			const isSupportSheet = deal.role === 'Support';
			const splitPresentation = isSplitDeal || isSupportSheet;

			// ---- Venue settings (address / financial fallback / logo) ----
			let venueName = 'Venue';
			let venueRoom = '';
			let venueAddress: string[] = [];
			let venueParams: any = null;
			try {
				const v = typeof event?.venue === 'string' ? JSON.parse(event.venue) : event?.venue || {};
				venueName = v.category || venueName;
				venueRoom = v.room || '';
				if (v.category) {
					const { data: sd } = await supabase
						.from('calendar_settings')
						.select('setting_params')
						.eq('setting_name', v.category)
						.eq('setting_type', 'VENUE')
						.maybeSingle();
					venueParams =
						typeof sd?.setting_params === 'string'
							? JSON.parse(sd.setting_params)
							: sd?.setting_params;
					const loc = venueParams?.location;
					if (loc) {
						if (loc.street) venueAddress.push(loc.street);
						if (loc.line2) venueAddress.push(loc.line2);
						const cityLine = [loc.city, [loc.state, loc.zip].filter(Boolean).join(' '), loc.country]
							.filter(Boolean)
							.join(', ');
						if (cityLine) venueAddress.push(cityLine);
					}
				}
			} catch {}

			// ---- Sales breakdown (actuals; External prefers Ext. Sold) ----
			const revenue = offerRevenue || {};
			const rawTickets: any[] = Array.isArray(revenue.tickets) ? revenue.tickets : [];
			const fin = revenue.financials || {};
			const vFin = venueParams?.financials || {};
			const taxRate = Number(fin.taxRate) || Number(vFin.taxRate) || 0;
			const taxType = fin.taxType || vFin.taxType || 'Divisor';
			const facilityFee = Number(fin.facilityFee ?? vFin.facilityFee) || 0;

			let gross = 0;
			let fees = 0;
			let soldTotal = 0;
			const tickets = rawTickets.map((t: any) => {
				const allotment = Number(t.allotment) || 0;
				const comps = Number(t.comps) || 0;
				const kills = Number(t.kills) || 0;
				const sellable = Math.max(0, allotment - comps - kills);
				const price = Number(t.price) || 0;
				const sold =
					external && t.extSold != null && t.extSold !== ''
						? Number(t.extSold) || 0
						: Number(t.sold) || 0;
				const rowGross = sold * price;
				gross += rowGross;
				soldTotal += sold;
				fees += sold * ((Number(t.ticketFees) || 0) + facilityFee);
				return { name: t.name || 'Ticket', allotment, comps, sellable, sold, price, breakEven: null, gross: rowGross };
			});
			const taxable = gross - fees;
			const taxes =
				taxType === 'Multiplier'
					? taxable * (taxRate / 100)
					: taxable - taxable / (1 + taxRate / 100);
			const netGross = gross - taxes - fees;
			const totalAllotment = rawTickets.reduce((sum, t: any) => sum + (Number(t.allotment) || 0), 0);

			// ---- Fixed expenses: Budget | Actual | Variance groups ----
			const cost = offerCost || {};
			const bavMap = new Map<
				string,
				{ rows: { name: string; amount: number; budget: number; variance: number }[]; budget: number; actual: number }
			>();
			(Array.isArray(cost.fixedCosts) ? cost.fixedCosts : []).forEach((g: any) => {
				const key = `${g.category || 'General'} > ${g.type && g.type !== '(No Type)' ? g.type : 'General'}`;
				(Array.isArray(g.costs) ? g.costs : []).forEach((line: any) => {
					if (line.reported === false && external) return;
					const budget = (Number(line.qty) || 0) * (Number(line.cost) || 0);
					const actual = Number(external ? line.externalSettlement : line.actualInternal) || 0;
					if (budget === 0 && actual === 0) return;
					if (!bavMap.has(key)) bavMap.set(key, { rows: [], budget: 0, actual: 0 });
					const grp = bavMap.get(key)!;
					grp.rows.push({ name: line.name || 'Cost', amount: actual, budget, variance: actual - budget });
					grp.budget += budget;
					grp.actual += actual;
				});
			});
			const fixedActualTotal = Array.from(bavMap.values()).reduce((sum, g) => sum + g.actual, 0);

			// ---- Variable expenses on actual figures ----
			const variableRows: { name: string; type: string; amount: string; potential: string }[] = [];
			let variableTotal = 0;
			(Array.isArray(cost.variableCosts) ? cost.variableCosts : []).forEach((v: any) => {
				if (v.reported === false && external) return;
				const m = Number(external ? (v.externalAmount ?? v.internalAmount) : (v.internalAmount ?? v.externalAmount)) || 0;
				if (m === 0) return;
				let amount = 0;
				let amountLabel = '';
				switch (v.type) {
					case 'Flat': {
						const flatActual = Number(external ? v.externalSettlement : v.actualInternal);
						amount = Number.isFinite(flatActual) && flatActual !== 0 ? flatActual : m;
						amountLabel = `$${moneyNum(m)}`;
						break;
					}
					case '% of Gross':
						amount = (m / 100) * gross;
						amountLabel = `${m}%`;
						break;
					case '% of Net Gross':
						amount = (m / 100) * netGross;
						amountLabel = `${m}%`;
						break;
					case '$ per Paid Ticket':
					case '$ per Attendee':
						amount = m * soldTotal;
						amountLabel = `$${moneyNum(m)}`;
						break;
				}
				if (amount === 0) return;
				variableRows.push({
					name: v.name || 'Variable Cost',
					type: v.type || 'Flat',
					amount: amountLabel,
					potential: `$${moneyNum(amount)}`
				});
				variableTotal += amount;
			});

			// ---- Talent pay (other included deals, settled on actuals) ----
			const selloutCtxActual = {
				gross,
				netGross,
				costs: 0,
				paidTickets: soldTotal,
				totalAllotment,
				exchangeRate: rate
			};
			const otherDeals = deals.filter((d: Deal) => {
				if (d.isPendingInfoOnly || !d.artistName) return false;
				if (isSupportSheet) {
					return d.role === 'Support' && d.includeInHeadlinerDeal === true;
				}
				return (
					d.id !== deal.id && (d.role === 'Headliner' || d.includeInHeadlinerDeal === true)
				);
			});
			const talentRows: { name: string; amount: number }[] = [];
			let otherTalentTotal = 0;
			for (const d of otherDeals) {
				const amt = computeArtistPayout(
					{ dealType: d.dealType, guaranteeAmount: d.guaranteeAmount, details: d.details },
					{ ...selloutCtxActual, exchangeRate: resolveDealRate(d) }
				);
				if (amt === 0) continue;
				talentRows.push({
					name: `(${d.role === 'Headliner' ? 'H' : 'S'}) ${d.artistName}`,
					amount: amt
				});
				otherTalentTotal += amt;
			}
			const supportActual = Number(additionalSupportActual) || 0;
			if (supportActual > 0)
				talentRows.push({ name: 'Additional Support', amount: supportActual });

			const expensesExclSelf = fixedActualTotal + variableTotal + otherTalentTotal + supportActual;

			// ---- Artist payout on actuals ----
			const guarVenue = (Number(deal.guaranteeAmount) || 0) * rate;
			const walkout = computeArtistPayout(
				{ dealType: deal.dealType, guaranteeAmount: deal.guaranteeAmount, details: deal.details },
				{ ...selloutCtxActual, costs: expensesExclSelf }
			);
			const pair = (venueAmt: number, sign = '') =>
				conversion
					? `${sign}$${moneyNum(rate > 0 ? Math.abs(venueAmt) / rate : 0)} | ${cur}${moneyNum(Math.abs(venueAmt))}`
					: `${sign}${cur}${moneyNum(Math.abs(venueAmt))}`;

			// ---- Band: deal sentence + withholding + adjustments + remaining ----
			const suffixParts: string[] = [];
			if (dealCur === 'CAD') {
				if (deal.cad_tax_type === 'Taxes') {
					const t = [deal.cad_qst ? 'QST' : '', deal.cad_gst ? 'GST' : ''].filter(Boolean);
					if (t.length > 0) suffixParts.push(`( +${t.join(' & ')} )`);
				}
			} else if (deal.w_tax) {
				suffixParts.push('(subject to w holding tax)');
			}
			const logi: string[] = [];
			const hotel = offerHotelText(deal);
			if (hotel) logi.push(hotel);
			if (deal.description?.groundTransport?.enabled) logi.push('ground');
			if (deal.description?.immigration?.enabled) logi.push('exemption');
			if (logi.length > 0) suffixParts.push(`plus ${logi.join(' + ')}`);

			let sentence = deal.summaryText || `${deal.dealType} Deal`;
			sentence = sentence.replace(/after Costs\b/g, 'after Taxes, Fees, and Agreed Expenses');
			sentence = sentence.replace(/after (USD|CAD|EUR|GBP)\$[\d,.]+/g, 'after Taxes, Fees, and Agreed Expenses');
			sentence = sentence.replace(/^(USD|CAD|EUR|GBP)\s+\$/, '$');

			const offerRows: any[] = [
				{ label: sentence, note: suffixParts.join(' ') || undefined, value: pair(walkout), accent: true }
			];
			// Withholding is intentionally NOT deducted here (matches Prism): it is
			// part of the artist's earnings, remitted to the tax authority on their
			// behalf at payment time — the deal line already flags "(subject to
			// w holding tax)". Use a manual adjustment if a deduction is needed.
			let remaining = walkout;
			for (const a of cleanAdj) {
				const amtDeal = Number(a.amount) || 0;
				if (amtDeal === 0) continue;
				const amtVenue = amtDeal * rate;
				remaining += amtVenue;
				offerRows.push({
					label: a.label || 'Adjustment',
					value: pair(amtVenue, amtDeal >= 0 ? '+' : '-')
				});
			}
			offerRows.push({ label: 'Total Remaining Payout', value: pair(remaining), emphasis: true });

			// ---- Event Summary (Prism settlement rows) ----
			const netToSplit = netGross - expensesExclSelf;
			const manualAdjVenue = cleanAdj.reduce((sum, a) => sum + (Number(a.amount) || 0) * rate, 0);
			const profitLoss = netToSplit - walkout - manualAdjVenue;
			const signed = (v: number) => `${v < 0 ? '-' : ''}${cur}${moneyNum(Math.abs(v))}`;
			const eventSummary: { label: string; value: string; strong?: boolean; strike?: boolean }[] = [
				{ label: 'Gross', value: `${cur}${moneyNum(gross)}` },
				{ label: `Ticket Sales Tax (${taxRate}% sales tax)`, value: `-${cur}${moneyNum(taxes)}` }
			];
			if (fees > 0) eventSummary.push({ label: 'Ticket Fees', value: `-${cur}${moneyNum(fees)}` });
			eventSummary.push({ label: 'Net Gross', value: `${cur}${moneyNum(netGross)}`, strong: true });
			eventSummary.push({ label: 'Fixed Expenses', value: `-${cur}${moneyNum(fixedActualTotal + otherTalentTotal + supportActual)}` });
			eventSummary.push({ label: 'Variable Expenses', value: `-${cur}${moneyNum(variableTotal)}` });
			eventSummary.push({ label: 'Net Revenue to Split', value: `${cur}${moneyNum(netToSplit)}`, strong: true });
			const pct = Number(deal.details?.metricAmount) || 0;
			const backendShare = (pct / 100) * Math.max(0, netToSplit);
			// Versus: cross out the side that didn't win.
			const versus = deal.dealType === 'Versus' && guarVenue > 0;
			if (isSplitDeal && deal.details?.metricType?.startsWith('%') && pct > 0) {
				eventSummary.push({
					label: `${pct}% of Net Revenue`,
					value: `${cur}${moneyNum(backendShare)}`,
					strike: versus && backendShare < guarVenue
				});
			}
			if (guarVenue > 0 && !isSupportSheet)
				eventSummary.push({
					label: 'Guarantee',
					value: `${cur}${moneyNum(guarVenue)}`,
					strike: versus && backendShare >= guarVenue
				});
			if (!isSupportSheet) {
				eventSummary.push({ label: 'Profit / Loss', value: signed(profitLoss), strong: true });
			}
			if (!isSupportSheet)
				eventSummary.push({ label: 'Attendance', value: soldTotal.toLocaleString('en-US') });

			// ---- Expense groups ----
			const expenseGroups: any[] = [];
			if (talentRows.length > 0) {
				expenseGroups.push({
					title: splitPresentation ? 'Talent Pay Included in Split Expense' : 'Talent Pay',
					mode: 'expense',
					rows: talentRows,
					total: otherTalentTotal + supportActual
				});
			}
			let bavBudgetTotal = 0;
			for (const [title, g] of bavMap.entries()) {
				bavBudgetTotal += g.budget;
				expenseGroups.push({
					title,
					mode: 'bav',
					rows: g.rows,
					total: g.actual,
					budgetTotal: g.budget,
					varianceTotal: g.actual - g.budget
				});
			}
			const splitTotal = expensesExclSelf;

			// ---- Contacts (same as offers) ----
			let contacts: { name: string; role: string; email: string; phone: string }[] = [];
			try {
				const targetId = event?.calendar?.id || event?.group_id || event?.id;
				const { data: cRow } = await supabase
					.from('calendar_data')
					.select('contacts')
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum)
					.maybeSingle();
				contacts = (Array.isArray(cRow?.contacts) ? cRow.contacts : [])
					.filter((c: any) => c?.enabled !== false)
					.map((c: any) => ({
						name: c.fullName || '',
						role: c.role || '',
						email: c.email || '',
						phone: c.phone || ''
					}))
					.filter((c: any) => c.name || c.email);
			} catch {}

			const blob = await buildOfferPdf({
				variant: 'settlement',
				offerNumber: 0,
				generatedAt: new Date(),
				artistName: deal.artistName,
				dateLabel: eventDate ? fmtLongDate(eventDate) : event?.calendar?.title || '',
				role: deal.role,
				venueName,
				venueRoom,
				venueAddress,
				logoUrl: '/images/NCG-Produkt.png',
				logoFallbackUrl: venueParams?.logoUrl || undefined,
				fxNote: conversion
					? `(FX RATE ${dealCur} = ${venueCurrency}/${rate.toFixed(4)})`
					: undefined,
				bandRightHeader: 'Artist Walkout',
				offerRows,
				eventDetails: [],
				eventSummary,
				venueCurrency,
				tickets,
				scalingFooter: [
					{
						label: `Ticket Sales Tax (${taxRate}% sales tax)`,
						value: `-$${moneyNum(taxes)}`,
						underline: true
					},
					{ label: 'Net Gross', value: `$${moneyNum(netGross)}`, strong: true }
				],
				expenseSummaryLabel: splitPresentation ? 'Split Point Summary' : 'Expense Summary',
				expenseSummaryValue: splitPresentation
					? `Total: ${cur}${moneyNum(splitTotal)}`
					: `Total Expenses ${cur}${moneyNum(splitTotal)}`,
				totalExpenses: splitTotal,
				fixedBandLabel: splitPresentation ? 'Fixed Expenses' : 'Fixed Expenses + Artist Payout',
				fixedBandTotal: splitTotal,
				expenseGroups,
				variableRows,
				variableTotal,
				contacts,
				dealTermsLine: '',
				termsAndConditions: ''
			});

			// One settlement per variant — generating again overwrites it.
			const history = dealSettlements(deal);
			const previous = history.filter((se) => se.variant === variantMode);
			const fileName = `${formatOfferDate(eventDate) || 'no-date'}_${deal.artistName
				.replace(/\s+/g, '-')
				.replace(/[^a-zA-Z0-9\-_.]/g, '')}_${external ? 'Ext' : 'Int'}_Settlement.pdf`;
			const path = await uploadOfferPdf(fileName, blob, 'settlements');
			if (!path) throw new Error('Upload failed');

			// Clean up any older files for this variant (old numbered naming).
			for (const se of previous) {
				if (se.path && se.path !== path) removeOfferPdf(se.path);
			}

			const entry: SettlementEntry = {
				n: 1,
				variant: variantMode,
				fileName,
				path,
				generatedAt: new Date().toISOString(),
				fingerprint: settlementFingerprint(deal, variantMode, cleanAdj)
			} as SettlementEntry;
			const sameCurrency = deal.dealCurrency === venueCurrency;
			const usedBaseRate = Number(resolveBaseRate(deal).toFixed(6));
			const withHistory = [...headlinerDeals, ...supportDeals].map((d) =>
				d.id === deal.id
					? {
							...d,
							settlementAdjustments: cleanAdj,
							settlements: [...history.filter((se) => se.variant !== variantMode), entry],
							...(sameCurrency
								? {}
								: {
										savedSettlementRate: usedBaseRate,
										savedSettlementRateAt: new Date().toISOString()
									})
						}
					: d
			);
			await saveToDatabase(withHistory);

			closeSettlementModal();
			openSettlementPretty(deal.artistName, variantMode);
		} catch (err) {
			console.error('❌ [settlement] Failed to generate settlement:', err);
			settlementError = 'Something went wrong while generating the settlement.';
		} finally {
			settlementGenerating = false;
		}
	}

	// --- Reorder mode handlers ---
	function toggleReorderMode(role: DealRole) {
		// Toggling one section automatically exits the other (one at a time).
		reorderMode = reorderMode === role ? null : role;
		draggingId = null;
		activeMenuId = null;
	}

	function handleDragStart(e: DragEvent, deal: Deal) {
		if (reorderMode !== deal.role) {
			e.preventDefault();
			return;
		}
		draggingId = deal.id;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', deal.id);
			// Hide the browser's default drag ghost so the flip animation reads cleanly.
			const ghost = document.createElement('div');
			ghost.style.width = '1px';
			ghost.style.height = '1px';
			ghost.style.position = 'fixed';
			ghost.style.top = '-10px';
			document.body.appendChild(ghost);
			e.dataTransfer.setDragImage(ghost, 0, 0);
			setTimeout(() => document.body.removeChild(ghost), 0);
		}
	}

	function handleDragOver(e: DragEvent, target: Deal) {
		// Only allow reordering within the same category, while in reorder mode.
		if (!draggingId || reorderMode !== target.role) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		if (target.id === draggingId) return;

		const list = target.role === 'Headliner' ? headlinerDeals : supportDeals;
		const ids = list.map((d) => d.id);
		const from = ids.indexOf(draggingId);
		const to = ids.indexOf(target.id);
		if (from === -1 || to === -1 || from === to) return;

		ids.splice(to, 0, ids.splice(from, 1)[0]);
		dragOrder = { ...dragOrder, [target.role]: ids };
	}

	async function handleDragEnd() {
		if (!draggingId) return;
		draggingId = null;
		// Persist the new order. saveToDatabase encodes position via the key
		// suffixes (headliner_name, headliner_name_2, ...), so order is saved.
		await saveToDatabase([...headlinerDeals, ...supportDeals]);
	}

	async function confirmDelete() {
		if (dealToDeleteId) {
			const updatedDeals = deals.filter((d) => d.id !== dealToDeleteId);
			await saveToDatabase(updatedDeals);
		}
		showDeleteModal = false;
		dealToDeleteId = null;
	}

	function cancelDelete() {
		showDeleteModal = false;
		dealToDeleteId = null;
	}

	function getLogisticsText(deal: Deal): string {
		let parts = [];
		// Render tax text based on currency
		if (deal.dealCurrency === 'CAD') {
			if (deal.cad_tax_type === 'Taxes') {
				let taxes = [];
				if (deal.cad_qst) taxes.push(' QST ');
				if (deal.cad_gst) taxes.push(' GST ');
				if (taxes.length > 0) parts.push(`( +${taxes.join(' & ')} )`);
			}
		} else if (deal.w_tax) {
			parts.push(`(subject to ${deal.w_tax_amount || 0}% w holding tax)`);
		}

		let logi = [];
		if (deal.description?.hotels?.enabled) {
			const h = deal.description.hotels;
			const rooms = h.rooms || 0;
			const suites = h.suites || 0;
			const nights = h.nights || 0;
			let hotelParts = [];

			if (suites > 0) hotelParts.push(`${suites}x Suite${suites === 1 ? '' : 's'}`);
			if (rooms > 0) hotelParts.push(`${rooms}x Room${rooms === 1 ? '' : 's'}`);

			const nightText = `${nights}x Night${nights === 1 ? '' : 's'}`;

			if (hotelParts.length > 0) {
				logi.push(`${hotelParts.join(' + ')} for ${nightText}`);
			} else {
				logi.push(`0x Rooms for ${nightText}`);
			}
		}
		if (deal.description?.groundTransport?.enabled) logi.push('ground');
		if (deal.description?.immigration?.enabled) logi.push('exemption');

		if (logi.length > 0) {
			let logiStr = logi.join(' + ');
			if (parts.length > 0) parts.push(`plus ${logiStr}`);
			else parts.push(`Plus ${logiStr}`);
		}

		if (deal.description?.other?.enabled && deal.description.other.notes) {
			parts.push(deal.description.other.notes);
		}

		return parts.join(' ');
	}

	async function saveToDatabase(updatedDeals: Deal[]) {
		if (isViewOnly) return;

		let dbPayload: any = {};
		const hList = updatedDeals.filter((d) => d.role === 'Headliner');
		const sList = updatedDeals.filter((d) => d.role === 'Support');

		hList.forEach((h, index) => {
			let sfx = index === 0 ? '' : `_${index + 1}`;
			dbPayload[`headliner_id${sfx}`] = h.artistId || 'NULL';
			dbPayload[`headliner_name${sfx}`] = h.artistName || 'NULL';
			dbPayload[`headliner_pic${sfx}`] = h.artistPic || 'NULL';
			const { role, artistId, artistName, artistPic, isPendingInfoOnly, ...cleanDealObj } = h;
			dbPayload[`headliner_deal${sfx}`] = h.isPendingInfoOnly ? {} : cleanDealObj;
		});

		sList.forEach((s, index) => {
			let sfx = index === 0 ? '' : `_${index + 1}`;
			dbPayload[`support_id${sfx}`] = s.artistId || 'NULL';
			dbPayload[`support_name${sfx}`] = s.artistName || 'NULL';
			dbPayload[`support_pic${sfx}`] = s.artistPic || 'NULL';
			const { role, artistId, artistName, artistPic, isPendingInfoOnly, ...cleanDealObj } = s;
			dbPayload[`support_deal${sfx}`] = s.isPendingInfoOnly ? {} : cleanDealObj;
		});

		if (Object.keys(dbPayload).length === 0) {
			dbPayload = {
				headliner_id: 'NULL',
				headliner_name: 'NULL',
				headliner_pic: 'NULL'
			};
		}

		dbPayload.additional_support_budgeted = Number(additionalSupportBudgeted) || 0;
		dbPayload.additional_support_actual = Number(additionalSupportActual) || 0;

		dbPayload.useCustomRate = useCustomRate;
		dbPayload.customRate = customRate;
		dbPayload.customSettlementRate = customSettlementRate;
		dbPayload.fxMarkupEnabled = fxMarkupEnabled;
		dbPayload.fxMarkupPercent = fxMarkupPercent;

		// Frozen rate once the event reaches Settlement/Settled.
		if (lockedExchangeRate != null) {
			dbPayload.lockedExchangeRate = lockedExchangeRate;
			dbPayload.lockedExchangeRateAt = lockedExchangeRateAt;
		}

		const targetId = event?.calendar?.id || event?.group_id || event?.id;

		if (targetId) {
			try {
				const { error } = await supabase
					.from('calendar_data')
					.update({ event_deal: dbPayload })
					.eq('calendar_id', targetId)
					.eq('version_number', viewedVersionNum);

				if (error) throw error;
				eventDealData = dbPayload;

				// Survives this component being destroyed on a tab switch.
				setCachedDealPayload(event, viewedVersionNum, dbPayload);

				// Also keep the objects the parent reads event_deal off in sync, so
				// the rest of the page (and any tab remount) sees the saved state.
				if (overrideCalendarData) overrideCalendarData.event_deal = dbPayload;
				if (event?.calendar_data) event.calendar_data.event_deal = dbPayload;
			} catch (err) {
				console.error('❌ [DealsTab] Failed to save deals to the database:', err);
			}
		} else {
			console.error('❌ [DealsTab] Could not save: Missing event ID target');
		}
	}

	async function handleSaveDeal(eventObj: CustomEvent<Deal>) {
		const savedDeal = eventObj.detail;
		let updatedDeals;

		if (dealToEdit) {
			updatedDeals = deals.map((d) => (d.id === savedDeal.id ? savedDeal : d));
		} else {
			updatedDeals = [...deals, savedDeal];
		}

		await saveToDatabase(updatedDeals);

		// One-way sync: deal set times -> linked show timetable (events.timetable).
		// Only runs when the deal's Set Times section is enabled with a start time.
		if (!isViewOnly) {
			const groupId = event?.calendar?.id || event?.group_id;
			if (groupId) {
				await syncDealSetTimesToTimetable(groupId, savedDeal);
			}
		}

		isCreatingDeal = false;
		dealToEdit = null;
	}

	function handleCancelDeal() {
		isCreatingDeal = false;
		dealToEdit = null;
	}

	function clickOutsideMenu(node: HTMLElement) {
		const handleClick = (e: MouseEvent) => {
			if (node && !node.contains(e.target as Node)) {
				activeMenuId = null;
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	function formatMoney(amount: number | string) {
		const num = Number(amount);
		if (isNaN(num)) return amount;

		return new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(num);
	}

	$: totalHeadlinerPayout = headlinerDeals.reduce((sum, deal) => {
		if (deal.isPendingInfoOnly) return sum;
		return sum + resolveDealPayout(deal);
	}, 0);

	$: totalSupportPayout =
		supportDeals.reduce((sum, deal) => {
			if (deal.isPendingInfoOnly) return sum;
			return sum + resolveDealPayout(deal);
		}, 0) + (Number(additionalSupportActual) || 0);

</script>

{#if !hasAnyAccess}
	<div class="p-4 text-gray2 font-bold bg-navbar h-full">
		You do not have permission to view deals.
	</div>
{:else}
	<div class="flex flex-col h-full bg-navbar text-white relative">
		{#if !isCreatingDeal}
			<div class="px-8 pt-6 pb-3 flex justify-between items-center shrink-0">
				<h2 class="text-xl font-black uppercase tracking-wide text-lime">Deals</h2>
				<div class="flex items-center gap-4">
					{#if canEditAndManage}
						<button
							class="px-6 py-2 bg-navbar border-2 border-gray1 text-gray1 font-bold rounded-full hover:cursor-not-allowed text-sm cursor-pointer"
						>
							Create Partner Deal
						</button>
						<button
							on:click={openCreateDeal}
							class="px-6 py-2 bg-lime text-black font-bold rounded-full hover:opacity-90 transition-opacity text-sm cursor-pointer"
						>
							Create Artist Deal
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="px-8 pt-4 pb-24 flex-1 overflow-y-auto">
			{#if isCreatingDeal && canEditAndManage}
				<DealCreator
					on:save={handleSaveDeal}
					on:cancel={handleCancelDeal}
					existingDeal={dealToEdit}
					event_date={eventDate}
					eventCost={offerCost}
					eventRevenue={offerRevenue}
					additionalSupport={additionalSupportActual}
					currentExchangeRate={activeExchangeRate}
					{venueCurrency}
				/>
			{:else}
				<div class="flex flex-col gap-8">
					<div>
						<div class="rounded-2xl bg-gray1">
							<div
								class="bg-black/40 px-4 py-3 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar rounded-t-2xl flex justify-between items-center"
							>
								<span>Headliners</span>
								{#if reorderMode === 'Headliner'}
									<button
										on:click={() => toggleReorderMode('Headliner')}
										transition:fade={{ duration: 150 }}
										class="px-4 py-1 bg-lime text-black text-xs font-black uppercase tracking-wide rounded-full hover:opacity-90 transition-opacity cursor-pointer"
									>
										Done
									</button>
								{/if}
							</div>
							<div class="p-4">
								{#if headlinerDeals.length === 0}
									<p class="text-gray2 font-medium">
										To add an artist click the "Create Artist Deal" button in the top right.
									</p>
								{:else}
									{#each headlinerDeals as deal (deal.id)}
										<div
											animate:flip={{ duration: 250 }}
											draggable={reorderMode === 'Headliner'}
											on:dragstart={(e) => handleDragStart(e, deal)}
											on:dragover={(e) => handleDragOver(e, deal)}
											on:dragend={handleDragEnd}
											on:drop|preventDefault={() => {}}
											role="listitem"
											class="flex justify-between items-center mb-3 last:mb-0 border-b-2 border-navbar pb-3 last:border-0 last:pb-0 rounded-xl transition-[background-color,opacity,box-shadow] duration-200
												{reorderMode === 'Headliner' ? 'cursor-grab active:cursor-grabbing select-none px-2 -mx-2 hover:bg-white/5' : ''}
												{draggingId === deal.id ? 'opacity-40 scale-[0.99] bg-white/5' : ''}"
										>
											<div class="flex items-center gap-4 min-w-0 flex-1 pr-4">
												<div class="relative w-16 h-16 shrink-0">
													<img
														src={deal.artistPic && deal.artistPic !== 'NULL'
															? deal.artistPic
															: 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png'}
														alt={deal.artistName}
														class="w-16 h-16 rounded-full object-cover bg-black transition-all duration-300 {reorderMode ===
														'Headliner'
															? 'grayscale brightness-[0.35]'
															: ''}"
													/>
													{#if reorderMode === 'Headliner'}
														<div
															class="absolute inset-0 flex items-center justify-center pointer-events-none"
															transition:fade={{ duration: 150 }}
														>
															<svg
																class="w-7 h-7 text-white drop-shadow-lg"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.5"
																stroke-linecap="round"
															>
																<line x1="4" y1="7" x2="20" y2="7"></line>
																<line x1="4" y1="12" x2="20" y2="12"></line>
																<line x1="4" y1="17" x2="20" y2="17"></line>
															</svg>
														</div>
													{/if}
												</div>
												<div class="min-w-0">
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														{#if deal.isPendingInfoOnly}
															<p class="text-sm text-gray2 font-bold mt-1">No deal setup</p>
														{:else}
															{#if formatDealSummary(deal, dealContext.costs + includedTalentCostFor(deal), venueCurrency)}
																<p class="text-sm text-lime font-bold mt-1">
																	{formatDealSummary(deal, dealContext.costs + includedTalentCostFor(deal), venueCurrency)}
																</p>
															{/if}
															{#if getLogisticsText(deal)}
																<p class="text-xs text-gray2 font-medium mt-1">
																	{getLogisticsText(deal)}
																</p>
															{/if}
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4 shrink-0">
												{#if canViewDetails}
													{@const latest = latestOffer(deal)}
													{@const upToDate =
														latest && offerUpToDate(deal, offerRevenue, offerCost)}
													<div class="flex items-center gap-2">
														<!-- Offer pill: view latest (or generate the first); ▾ opens versions -->
														<div class="relative" use:clickOutsideVersions>
															<div
																class="flex items-center bg-navbar border rounded-3xl transition-colors {deal.isPendingInfoOnly ||
																(!latest && !canEditAndManage)
																	? 'border-gray2/20 text-gray2 opacity-50'
																	: 'border-lime/40 text-lime'}"
															>
																<button
																	disabled={deal.isPendingInfoOnly || (!latest && !canEditAndManage)}
																			on:click={() => {
																		if (isLockedStage) {
																			const se = latestSettlement(deal);
																			se ? openSettlementPretty(deal.artistName, se.variant) : openSettlementModal(deal);
																		} else if (latest) {
																			openOfferPretty(deal.artistName, latest.n);
																		} else {
																			openOfferModal(deal);
																		}
																	}}
																	title={isLockedStage
																		? latestSettlement(deal)
																			? 'View the latest settlement sheet'
																			: 'Generate the settlement sheet'
																		: latest
																			? `View Offer ${latest.n} (${formatOfferDate(latest.generatedAt)})`
																			: 'Generate the first offer'}
																	class="flex items-center gap-2 whitespace-nowrap pl-4 {(
																	isLockedStage ? dealSettlements(deal).length > 0 : latest
																	)
																		? 'pr-1.5'
																		: 'pr-4'} py-2 text-sm font-bold {deal.isPendingInfoOnly ||
																	(!latest && !canEditAndManage)
																		? 'cursor-not-allowed'
																		: 'hover:opacity-80 cursor-pointer'}"
																>
																	<svg
																		class="w-4 h-4"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2"
																		stroke-linecap="round"
																		stroke-linejoin="round"
																	>
																		<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
																		<circle cx="12" cy="12" r="3"></circle>
																	</svg>
																	{isLockedStage ? 'Settlement' : latest ? `Offer ${latest.n}` : 'Offer'}
																</button>
																{#if isLockedStage ? dealSettlements(deal).length > 0 : latest}
																	<button
																		on:click={() => toggleVersionMenu(deal.id)}
																		class="pl-1 pr-3 py-2 hover:opacity-80 cursor-pointer border-l border-lime/20"
																		aria-label="Offer versions"
																		title="Offer versions"
																	>
																		<svg
																			class="w-3.5 h-3.5 transition-transform {versionMenuId === deal.id
																				? 'rotate-180'
																				: ''}"
																			viewBox="0 0 24 24"
																			fill="none"
																			stroke="currentColor"
																			stroke-width="2.5"
																			stroke-linecap="round"
																			stroke-linejoin="round"
																		>
																			<polyline points="6 9 12 15 18 9"></polyline>
																		</svg>
																	</button>
																{/if}
															</div>

															{#if (isLockedStage ? dealSettlements(deal).length > 0 : latest) && versionMenuId === deal.id}
																<div
																	class="absolute right-0 top-full mt-1 w-64 bg-navbar border border-gray2/20 rounded-xl shadow-2xl z-[80]"
																	transition:fade={{ duration: 100 }}
																>
																	<div class="p-2 border-b border-gray2/10">
																		<input
																			type="text"
																			placeholder={isLockedStage ? 'Search settlements...' : 'Search offers...'}
																			bind:value={offerSearch}
																			class="w-full bg-gray1 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray2 focus:outline-none"
																		/>
																	</div>
																	<div class="max-h-56 overflow-y-auto custom-scrollbar">
																		{#if isLockedStage}
																			{#each settlementsFor(deal, offerSearch) as se (`${se.variant}-${se.generatedAt}`)}
																				<div
																					class="flex items-center gap-1 pr-1 hover:bg-lime/10 transition-colors group/serow"
																				>
																					<button
																						on:click={() => {
																							openSettlementPretty(deal.artistName, se.variant);
																							versionMenuId = null;
																						}}
																						class="flex-1 text-left px-3 py-2 text-sm font-bold text-white group-hover/serow:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer min-w-0"
																					>
																						<span class="truncate">{settlementLabel(se)}</span>
																						<span class="text-[10px] text-gray2 font-bold shrink-0"
																							>{formatOfferDate(se.generatedAt)}</span
																						>
																					</button>
																					{#if canEditAndManage}
																						<button
																							type="button"
																							on:click|stopPropagation={() => requestDeleteSettlement(deal, se)}
																							disabled={offerDeleting}
																							title={`Delete ${settlementLabel(se)}`}
																							class="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-gray2 hover:text-problem hover:bg-problem/10 disabled:opacity-40"
																							aria-label="Delete settlement"
																						>
																							<svg
																								class="w-3.5 h-3.5 pointer-events-none"
																								viewBox="0 0 24 24"
																								fill="none"
																								stroke="currentColor"
																								stroke-width="2"
																								stroke-linecap="round"
																								stroke-linejoin="round"
																							>
																								<polyline points="3 6 5 6 21 6"></polyline>
																								<path
																									d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
																								></path>
																							</svg>
																						</button>
																					{/if}
																				</div>
																			{:else}
																				<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																					No matching settlements
																				</p>
																			{/each}
																		{:else}
																		{#each offerVersionsFor(deal, offerSearch) as o (o.n)}
																			{@const delta = offerDelta(deal, o)}
																			<div
																				class="flex items-center gap-1 pr-1 hover:bg-lime/10 transition-colors group/offerrow"
																			>
																				<button
																					on:click={() => {
																						openOfferPretty(deal.artistName, o.n);
																						versionMenuId = null;
																					}}
																					class="flex-1 text-left px-3 py-2 text-sm font-bold text-white group-hover/offerrow:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer min-w-0"
																				>
																					<span class="truncate flex items-center gap-1.5"
																						>Offer {o.n}{latest && o.n === latest.n ? ' · latest' : ''}{#if delta !== null && Math.abs(delta) >= 0.01}<span
																								class="text-[10px] font-black {delta > 0
																									? 'text-lime'
																									: 'text-problem'}"
																								>{delta > 0 ? '+' : '-'}{currencyPrefix(venueCurrency)}{moneyNum(
																									Math.abs(delta)
																								)}</span
																							>{/if}</span
																					>
																					<span class="text-[10px] text-gray2 font-bold shrink-0"
																						>{formatOfferDate(o.generatedAt)}</span
																					>
																				</button>
																				{#if canEditAndManage}
																					<button
																						type="button"
																						on:click|stopPropagation={() => requestDeleteOffer(deal, o)}
																						disabled={offerDeleting}
																						title={`Delete Offer ${o.n}`}
																						class="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-gray2 hover:text-problem hover:bg-problem/10 disabled:opacity-40"
																						aria-label="Delete offer"
																					>
																						<svg
																							class="w-3.5 h-3.5 pointer-events-none"
																							viewBox="0 0 24 24"
																							fill="none"
																							stroke="currentColor"
																							stroke-width="2"
																							stroke-linecap="round"
																							stroke-linejoin="round"
																						>
																							<polyline points="3 6 5 6 21 6"></polyline>
																							<path
																								d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
																							></path>
																						</svg>
																					</button>
																				{/if}
																			</div>
																		{:else}
																			<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																				No matching offers
																			</p>
																		{/each}
																		{/if}
																	</div>
																</div>
															{/if}
														</div>

														<!-- Round regenerate button -->
														{#if canEditAndManage && !deal.isPendingInfoOnly && (isLockedStage || latest)}
															<button
																title={isLockedStage
																	? 'Generate / update the settlement sheet'
																	: upToDate && latest
																		? `Generate again (no changes since Offer ${latest.n})`
																		: 'Generate a new offer'}
																on:click={() => openOfferModal(deal)}
																class="w-9 h-9 flex items-center justify-center bg-navbar border border-lime/40 text-lime hover:bg-lime/10 cursor-pointer transition-colors rounded-full"
																aria-label="Generate new offer"
															>
																<svg
																	class="w-4 h-4"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																>
																	<polyline points="23 4 23 10 17 10"></polyline>
																	<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
																</svg>
															</button>
														{/if}
													</div>
												{/if}

												{#if canEditAndManage}
													<div
														class="relative {activeMenuId === deal.id ? 'z-50' : 'z-10'}"
														use:clickOutsideMenu
													>
														<button
															on:click={() =>
																(activeMenuId = activeMenuId === deal.id ? null : deal.id)}
															class="w-10 h-10 flex items-center justify-center text-gray2 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10"
															aria-label="Deal Options"
														>
															<svg
																class="w-7 h-7"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"
																></circle><circle cx="12" cy="19" r="1"></circle></svg
															>
														</button>
														{#if activeMenuId === deal.id}
															<div
																class="absolute right-0 top-full mt-1 w-32 bg-navbar border border-gray2/20 rounded-xl shadow-2xl"
															>
																<button
																	on:click={() => editDeal(deal)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																	>{deal.isPendingInfoOnly ? 'Create' : 'Edit'}</button
																>
																<button
																	on:click={() => toggleReorderMode(deal.role)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																	>{reorderMode === deal.role ? 'Done Ordering' : 'Re-order'}</button
																>
																{#if !deal.isPendingInfoOnly}
																	{#if isLockedStage}
																		<!-- In settlement mode the pill shows settlements; offers
																		     history moves here (opens left so it fits the window). -->
																		<div class="relative group/offhist">
																			<button
																				class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors flex items-center justify-between gap-1 cursor-default"
																			>
																				Offer
																				<svg
																					class="w-3.5 h-3.5"
																					viewBox="0 0 24 24"
																					fill="none"
																					stroke="currentColor"
																					stroke-width="2.5"
																					stroke-linecap="round"
																					stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg
																				>
																			</button>
																			<div
																				class="absolute right-full top-0 pr-1 w-60 hidden group-hover/offhist:block z-[80]"
																			>
																				<div
																					class="bg-navbar border border-gray2/20 rounded-xl shadow-2xl overflow-hidden"
																				>
																					<div class="max-h-56 overflow-y-auto custom-scrollbar">
																						{#each offerVersionsFor(deal, '') as o (o.n)}
																							<button
																								on:click={() => {
																									openOfferPretty(deal.artistName, o.n);
																									activeMenuId = null;
																								}}
																								class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer"
																							>
																								<span>Offer {o.n}</span>
																								<span class="text-[10px] text-gray2 font-bold shrink-0"
																									>{formatOfferDate(o.generatedAt)}</span
																								>
																							</button>
																						{:else}
																							<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																								No offers
																							</p>
																						{/each}
																					</div>
																				</div>
																			</div>
																		</div>
																	{:else}
																		<button
																			on:click={() => openSettlementModal(deal)}
																			class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																			>Settlement</button
																		>
																	{/if}
																{/if}
																<button
																	on:click={() => deleteDeal(deal.id)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-problem hover:bg-problem/10 transition-colors"
																	>Remove</button
																>
															</div>
														{/if}
													</div>
												{/if}

												{#if canViewDetails && !deal.isPendingInfoOnly}
													<div
														class="flex flex-col items-end pl-4 ml-2 min-w-[80px] relative group/rate"
													>
														<span class="text-[10px] text-gray2 font-bold uppercase tracking-widest"
															>Payout</span
														>
														<span class="text-lg rounded-3xl font-gray1 text-white cursor-default">
															{venueCurrency}
															{formatMoney(resolveDealPayout(deal))}
														</span>

														{#if venueCurrency !== 'USD'}
															<div
																class="absolute bottom-full rounded-3xl right-0 mb-1 hidden group-hover/rate:block bg-navbar text-lime text-[10px] uppercase tracking-widest font-bold px-2 py-1 whitespace-nowrap shadow-xl z-50"
															>
																Rate {resolveDealRate(deal).toFixed(4)}{markupAppliesTo(deal)
													? ` (+${fxMarkupPercent}%)`
													: ''}{isLockedStage && lockedExchangeRate ? ' (locked)' : ''}
															</div>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									{/each}
								{/if}
							</div>
						</div>

						{#if canViewDetails && headlinerDeals.length > 0}
							<div class="mt-2 pr-4 flex justify-end items-center gap-4">
								<span class="text-[15px] text-gray2 font-bold uppercase tracking-widest"
									>Total Headliner Payout:</span
								>
								<span class="text-lg font-black text-white"
									>{venueCurrency}$ {formatMoney(totalHeadlinerPayout)}</span
								>
							</div>
						{/if}
					</div>

					<div>
						<div class="rounded-2xl bg-gray1">
							<div
								class="bg-black/40 px-4 py-3 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar rounded-t-2xl flex justify-between items-center"
							>
								<span>Support</span>
								{#if reorderMode === 'Support'}
									<button
										on:click={() => toggleReorderMode('Support')}
										transition:fade={{ duration: 150 }}
										class="px-4 py-1 bg-lime text-black text-xs font-black uppercase tracking-wide rounded-full hover:opacity-90 transition-opacity cursor-pointer"
									>
										Done
									</button>
								{/if}
							</div>
							<div class="p-4">
								{#if supportDeals.length === 0}
									<p class="text-gray2 pb-4 pl-6 border-b-2 border-navbar mb-4">
										No support deals added yet.
									</p>
								{:else}
									{#each supportDeals as deal (deal.id)}
										<div
											animate:flip={{ duration: 250 }}
											draggable={reorderMode === 'Support'}
											on:dragstart={(e) => handleDragStart(e, deal)}
											on:dragover={(e) => handleDragOver(e, deal)}
											on:dragend={handleDragEnd}
											on:drop|preventDefault={() => {}}
											role="listitem"
											class="flex justify-between items-center mb-4 pb-4 border-b-2 border-navbar rounded-xl transition-[background-color,opacity,box-shadow] duration-200
												{reorderMode === 'Support' ? 'cursor-grab active:cursor-grabbing select-none px-2 -mx-2 hover:bg-white/5' : ''}
												{draggingId === deal.id ? 'opacity-40 scale-[0.99] bg-white/5' : ''}"
										>
											<div class="flex items-center gap-4 min-w-0 flex-1 pr-4">
												<div class="relative w-16 h-16 shrink-0">
													<img
														src={deal.artistPic && deal.artistPic !== 'NULL'
															? deal.artistPic
															: 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png'}
														alt={deal.artistName}
														class="w-16 h-16 rounded-full object-cover bg-black transition-all duration-300 {reorderMode ===
														'Support'
															? 'grayscale brightness-[0.35]'
															: ''}"
													/>
													{#if reorderMode === 'Support'}
														<div
															class="absolute inset-0 flex items-center justify-center pointer-events-none"
															transition:fade={{ duration: 150 }}
														>
															<svg
																class="w-7 h-7 text-white drop-shadow-lg"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2.5"
																stroke-linecap="round"
															>
																<line x1="4" y1="7" x2="20" y2="7"></line>
																<line x1="4" y1="12" x2="20" y2="12"></line>
																<line x1="4" y1="17" x2="20" y2="17"></line>
															</svg>
														</div>
													{/if}
												</div>
												<div class="min-w-0">
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														{#if deal.isPendingInfoOnly}
															<p class="text-sm text-gray2 font-bold mt-1">No deal setup</p>
														{:else}
															{#if formatDealSummary(deal, dealContext.costs + includedTalentCostFor(deal), venueCurrency)}
																<p class="text-sm text-lime font-bold mt-1">
																	{formatDealSummary(deal, dealContext.costs + includedTalentCostFor(deal), venueCurrency)}
																</p>
															{/if}
															{#if getLogisticsText(deal)}
																<p class="text-xs text-gray2 font-medium mt-1">
																	{getLogisticsText(deal)}
																</p>
															{/if}
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4 shrink-0">
												{#if canViewDetails}
													{@const latest = latestOffer(deal)}
													{@const upToDate =
														latest && offerUpToDate(deal, offerRevenue, offerCost)}
													<div class="flex items-center gap-2">
														<!-- Offer pill: view latest (or generate the first); ▾ opens versions -->
														<div class="relative" use:clickOutsideVersions>
															<div
																class="flex items-center bg-navbar border rounded-3xl transition-colors {deal.isPendingInfoOnly ||
																(!latest && !canEditAndManage)
																	? 'border-gray2/20 text-gray2 opacity-50'
																	: 'border-lime/40 text-lime'}"
															>
																<button
																	disabled={deal.isPendingInfoOnly || (!latest && !canEditAndManage)}
																			on:click={() => {
																		if (isLockedStage) {
																			const se = latestSettlement(deal);
																			se ? openSettlementPretty(deal.artistName, se.variant) : openSettlementModal(deal);
																		} else if (latest) {
																			openOfferPretty(deal.artistName, latest.n);
																		} else {
																			openOfferModal(deal);
																		}
																	}}
																	title={isLockedStage
																		? latestSettlement(deal)
																			? 'View the latest settlement sheet'
																			: 'Generate the settlement sheet'
																		: latest
																			? `View Offer ${latest.n} (${formatOfferDate(latest.generatedAt)})`
																			: 'Generate the first offer'}
																	class="flex items-center gap-2 whitespace-nowrap pl-4 {(
																	isLockedStage ? dealSettlements(deal).length > 0 : latest
																	)
																		? 'pr-1.5'
																		: 'pr-4'} py-2 text-sm font-bold {deal.isPendingInfoOnly ||
																	(!latest && !canEditAndManage)
																		? 'cursor-not-allowed'
																		: 'hover:opacity-80 cursor-pointer'}"
																>
																	<svg
																		class="w-4 h-4"
																		viewBox="0 0 24 24"
																		fill="none"
																		stroke="currentColor"
																		stroke-width="2"
																		stroke-linecap="round"
																		stroke-linejoin="round"
																	>
																		<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
																		<circle cx="12" cy="12" r="3"></circle>
																	</svg>
																	{isLockedStage ? 'Settlement' : latest ? `Offer ${latest.n}` : 'Offer'}
																</button>
																{#if isLockedStage ? dealSettlements(deal).length > 0 : latest}
																	<button
																		on:click={() => toggleVersionMenu(deal.id)}
																		class="pl-1 pr-3 py-2 hover:opacity-80 cursor-pointer border-l border-lime/20"
																		aria-label="Offer versions"
																		title="Offer versions"
																	>
																		<svg
																			class="w-3.5 h-3.5 transition-transform {versionMenuId === deal.id
																				? 'rotate-180'
																				: ''}"
																			viewBox="0 0 24 24"
																			fill="none"
																			stroke="currentColor"
																			stroke-width="2.5"
																			stroke-linecap="round"
																			stroke-linejoin="round"
																		>
																			<polyline points="6 9 12 15 18 9"></polyline>
																		</svg>
																	</button>
																{/if}
															</div>

															{#if (isLockedStage ? dealSettlements(deal).length > 0 : latest) && versionMenuId === deal.id}
																<div
																	class="absolute right-0 top-full mt-1 w-64 bg-navbar border border-gray2/20 rounded-xl shadow-2xl z-[80]"
																	transition:fade={{ duration: 100 }}
																>
																	<div class="p-2 border-b border-gray2/10">
																		<input
																			type="text"
																			placeholder={isLockedStage ? 'Search settlements...' : 'Search offers...'}
																			bind:value={offerSearch}
																			class="w-full bg-gray1 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray2 focus:outline-none"
																		/>
																	</div>
																	<div class="max-h-56 overflow-y-auto custom-scrollbar">
																		{#if isLockedStage}
																			{#each settlementsFor(deal, offerSearch) as se (`${se.variant}-${se.generatedAt}`)}
																				<div
																					class="flex items-center gap-1 pr-1 hover:bg-lime/10 transition-colors group/serow"
																				>
																					<button
																						on:click={() => {
																							openSettlementPretty(deal.artistName, se.variant);
																							versionMenuId = null;
																						}}
																						class="flex-1 text-left px-3 py-2 text-sm font-bold text-white group-hover/serow:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer min-w-0"
																					>
																						<span class="truncate">{settlementLabel(se)}</span>
																						<span class="text-[10px] text-gray2 font-bold shrink-0"
																							>{formatOfferDate(se.generatedAt)}</span
																						>
																					</button>
																					{#if canEditAndManage}
																						<button
																							type="button"
																							on:click|stopPropagation={() => requestDeleteSettlement(deal, se)}
																							disabled={offerDeleting}
																							title={`Delete ${settlementLabel(se)}`}
																							class="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-gray2 hover:text-problem hover:bg-problem/10 disabled:opacity-40"
																							aria-label="Delete settlement"
																						>
																							<svg
																								class="w-3.5 h-3.5 pointer-events-none"
																								viewBox="0 0 24 24"
																								fill="none"
																								stroke="currentColor"
																								stroke-width="2"
																								stroke-linecap="round"
																								stroke-linejoin="round"
																							>
																								<polyline points="3 6 5 6 21 6"></polyline>
																								<path
																									d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
																								></path>
																							</svg>
																						</button>
																					{/if}
																				</div>
																			{:else}
																				<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																					No matching settlements
																				</p>
																			{/each}
																		{:else}
																		{#each offerVersionsFor(deal, offerSearch) as o (o.n)}
																			{@const delta = offerDelta(deal, o)}
																			<div
																				class="flex items-center gap-1 pr-1 hover:bg-lime/10 transition-colors group/offerrow"
																			>
																				<button
																					on:click={() => {
																						openOfferPretty(deal.artistName, o.n);
																						versionMenuId = null;
																					}}
																					class="flex-1 text-left px-3 py-2 text-sm font-bold text-white group-hover/offerrow:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer min-w-0"
																				>
																					<span class="truncate flex items-center gap-1.5"
																						>Offer {o.n}{latest && o.n === latest.n ? ' · latest' : ''}{#if delta !== null && Math.abs(delta) >= 0.01}<span
																								class="text-[10px] font-black {delta > 0
																									? 'text-lime'
																									: 'text-problem'}"
																								>{delta > 0 ? '+' : '-'}{currencyPrefix(venueCurrency)}{moneyNum(
																									Math.abs(delta)
																								)}</span
																							>{/if}</span
																					>
																					<span class="text-[10px] text-gray2 font-bold shrink-0"
																						>{formatOfferDate(o.generatedAt)}</span
																					>
																				</button>
																				{#if canEditAndManage}
																					<button
																						type="button"
																						on:click|stopPropagation={() => requestDeleteOffer(deal, o)}
																						disabled={offerDeleting}
																						title={`Delete Offer ${o.n}`}
																						class="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg transition-colors cursor-pointer text-gray2 hover:text-problem hover:bg-problem/10 disabled:opacity-40"
																						aria-label="Delete offer"
																					>
																						<svg
																							class="w-3.5 h-3.5 pointer-events-none"
																							viewBox="0 0 24 24"
																							fill="none"
																							stroke="currentColor"
																							stroke-width="2"
																							stroke-linecap="round"
																							stroke-linejoin="round"
																						>
																							<polyline points="3 6 5 6 21 6"></polyline>
																							<path
																								d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
																							></path>
																						</svg>
																					</button>
																				{/if}
																			</div>
																		{:else}
																			<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																				No matching offers
																			</p>
																		{/each}
																		{/if}
																	</div>
																</div>
															{/if}
														</div>

														<!-- Round regenerate button -->
														{#if canEditAndManage && !deal.isPendingInfoOnly && (isLockedStage || latest)}
															<button
																title={isLockedStage
																	? 'Generate / update the settlement sheet'
																	: upToDate && latest
																		? `Generate again (no changes since Offer ${latest.n})`
																		: 'Generate a new offer'}
																on:click={() => openOfferModal(deal)}
																class="w-9 h-9 flex items-center justify-center bg-navbar border border-lime/40 text-lime hover:bg-lime/10 cursor-pointer transition-colors rounded-full"
																aria-label="Generate new offer"
															>
																<svg
																	class="w-4 h-4"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																>
																	<polyline points="23 4 23 10 17 10"></polyline>
																	<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
																</svg>
															</button>
														{/if}
													</div>
												{/if}

												{#if canEditAndManage}
													<div
														class="relative {activeMenuId === deal.id ? 'z-50' : 'z-10'}"
														use:clickOutsideMenu
													>
														<button
															on:click={() =>
																(activeMenuId = activeMenuId === deal.id ? null : deal.id)}
															class="w-10 h-10 flex items-center justify-center text-gray2 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/10"
															aria-label="Deal Options"
														>
															<svg
																class="w-7 h-7"
																viewBox="0 0 24 24"
																fill="none"
																stroke="currentColor"
																stroke-width="2"
																><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"
																></circle><circle cx="12" cy="19" r="1"></circle></svg
															>
														</button>
														{#if activeMenuId === deal.id}
															<div
																class="absolute right-0 top-full mt-1 w-32 bg-navbar border border-gray2/20 rounded-xl shadow-2xl"
															>
																<button
																	on:click={() => editDeal(deal)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																	>{deal.isPendingInfoOnly ? 'Create' : 'Edit'}</button
																>
																<button
																	on:click={() => toggleReorderMode(deal.role)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																	>{reorderMode === deal.role ? 'Done Ordering' : 'Re-order'}</button
																>
																{#if !deal.isPendingInfoOnly}
																	{#if isLockedStage}
																		<!-- In settlement mode the pill shows settlements; offers
																		     history moves here (opens left so it fits the window). -->
																		<div class="relative group/offhist">
																			<button
																				class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors flex items-center justify-between gap-1 cursor-default"
																			>
																				Offer
																				<svg
																					class="w-3.5 h-3.5"
																					viewBox="0 0 24 24"
																					fill="none"
																					stroke="currentColor"
																					stroke-width="2.5"
																					stroke-linecap="round"
																					stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg
																				>
																			</button>
																			<div
																				class="absolute right-full top-0 pr-1 w-60 hidden group-hover/offhist:block z-[80]"
																			>
																				<div
																					class="bg-navbar border border-gray2/20 rounded-xl shadow-2xl overflow-hidden"
																				>
																					<div class="max-h-56 overflow-y-auto custom-scrollbar">
																						{#each offerVersionsFor(deal, '') as o (o.n)}
																							<button
																								on:click={() => {
																									openOfferPretty(deal.artistName, o.n);
																									activeMenuId = null;
																								}}
																								class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors flex items-center justify-between gap-2 cursor-pointer"
																							>
																								<span>Offer {o.n}</span>
																								<span class="text-[10px] text-gray2 font-bold shrink-0"
																									>{formatOfferDate(o.generatedAt)}</span
																								>
																							</button>
																						{:else}
																							<p class="px-3 py-3 text-xs text-gray2 font-bold text-center">
																								No offers
																							</p>
																						{/each}
																					</div>
																				</div>
																			</div>
																		</div>
																	{:else}
																		<button
																			on:click={() => openSettlementModal(deal)}
																			class="w-full text-left px-3 py-2 text-sm font-bold text-white hover:bg-lime/10 hover:text-lime transition-colors"
																			>Settlement</button
																		>
																	{/if}
																{/if}
																<button
																	on:click={() => deleteDeal(deal.id)}
																	class="w-full text-left px-3 py-2 text-sm font-bold text-problem hover:bg-problem/10 transition-colors"
																	>Remove</button
																>
															</div>
														{/if}
													</div>
												{/if}

												{#if canViewDetails && !deal.isPendingInfoOnly}
													<div
														class="flex flex-col items-end pl-4 ml-2 min-w-[80px] relative group/rate"
													>
														<span class="text-[10px] text-gray2 font-bold uppercase tracking-widest"
															>Payout</span
														>
														<span class="text-lg rounded-3xl font-gray1 text-white cursor-default">
															{venueCurrency}
															{formatMoney(resolveDealPayout(deal))}
														</span>

														{#if venueCurrency !== 'USD'}
															<div
																class="absolute bottom-full rounded-3xl right-0 mb-1 hidden group-hover/rate:block bg-navbar text-lime text-[10px] uppercase tracking-widest font-bold px-2 py-1 whitespace-nowrap shadow-xl z-50"
															>
																Rate {resolveDealRate(deal).toFixed(4)}{markupAppliesTo(deal)
													? ` (+${fxMarkupPercent}%)`
													: ''}{isLockedStage && lockedExchangeRate ? ' (locked)' : ''}
															</div>
														{/if}
													</div>
												{/if}
											</div>
										</div>
									{/each}
								{/if}

								<div class="pt-2 flex justify-between items-center">
									<div>
										<p class="font-black text-xl pl-6 text-white">Additional Support</p>
									</div>

									<div class="flex items-center gap-6">
										{#if canEditAndManage}
											<div class="flex flex-col items-end">
												<label
													for="budgeted-input"
													class="text-[10px] text-gray2 font-bold uppercase pr-2 tracking-widest mb-1"
													>Budgeted</label
												>
												<div
													class="flex items-center bg-navbar rounded-3xl px-3 py-1.5 focus-within:border-lime transition-colors h-10"
												>
													<span class="text-gray2 font-bold text-sm mr-2">{venueCurrency}$</span>
													<input
														id="budgeted-input"
														type="text"
														value={Number(additionalSupportBudgeted) === 0
															? '0'
															: String(formatMoney(additionalSupportBudgeted))}
														on:focus={(e) => {
															const target = e.currentTarget as HTMLInputElement;
															target.value =
																Number(additionalSupportBudgeted) === 0
																	? ''
																	: String(additionalSupportBudgeted);
														}}
														on:blur={(e) => {
															const target = e.currentTarget as HTMLInputElement;
															let val = target.value.replace(/[^0-9.]/g, '');
															additionalSupportBudgeted = Number(val) || 0;
															target.value =
																Number(additionalSupportBudgeted) === 0
																	? '0'
																	: String(formatMoney(additionalSupportBudgeted));
															saveToDatabase(deals);
														}}
														class="bg-transparent text-white font-bold w-24 outline-none text-right"
														placeholder=""
													/>
												</div>
											</div>
											<div class="flex flex-col items-end">
												<label
													for="actual-input"
													class="text-[10px] text-gray2 font-bold uppercase pr-2 tracking-widest mb-1"
													>Actual</label
												>
												<div
													class="flex items-center bg-navbar rounded-3xl px-3 py-1.5 focus-within:border-lime transition-colors h-10"
												>
													<span class="text-gray2 font-bold text-sm mr-2">{venueCurrency}$</span>
													<input
														id="actual-input"
														type="text"
														value={Number(additionalSupportActual) === 0
															? '0'
															: String(formatMoney(additionalSupportActual))}
														on:focus={(e) => {
															const target = e.currentTarget as HTMLInputElement;
															target.value =
																Number(additionalSupportActual) === 0
																	? ''
																	: String(additionalSupportActual);
														}}
														on:blur={(e) => {
															const target = e.currentTarget as HTMLInputElement;
															let val = target.value.replace(/[^0-9.]/g, '');
															additionalSupportActual = Number(val) || 0;
															target.value =
																Number(additionalSupportActual) === 0
																	? '0'
																	: String(formatMoney(additionalSupportActual));
															saveToDatabase(deals);
														}}
														class="bg-transparent text-white font-bold w-24 outline-none text-right"
														placeholder=""
													/>
												</div>
											</div>
										{:else if canViewDetails}
											<div class="flex items-center gap-6 mr-4">
												<div class="flex flex-col items-end">
													<span
														class="text-[10px] text-gray2 font-bold uppercase pr-2 tracking-widest"
														>Budgeted</span
													>
													<span class="text-lg font-black text-white"
														>{venueCurrency}$ {Number(additionalSupportBudgeted) === 0
															? '0'
															: String(formatMoney(additionalSupportBudgeted))}</span
													>
												</div>
												<div class="flex flex-col items-end">
													<span
														class="text-[10px] text-gray2 font-bold uppercase pr-2 tracking-widest"
														>Actual</span
													>
													<span class="text-lg font-black text-white"
														>{venueCurrency}$ {Number(additionalSupportActual) === 0
															? '0'
															: String(formatMoney(additionalSupportActual))}</span
													>
												</div>
											</div>
										{/if}
									</div>
								</div>
							</div>
						</div>

						{#if canViewDetails && (supportDeals.length > 0 || Number(additionalSupportActual) > 0)}
							<div class="mt-2 pr-4 flex justify-end items-center gap-4">
								<span class="text-[15px] text-gray2 font-bold uppercase tracking-widest"
									>Total Actual Support Cost:</span
								>
								<span class="text-lg font-black text-white"
									>{venueCurrency}$ {formatMoney(totalSupportPayout)}</span
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
		{#if showDeleteModal}
			<div
				use:portal
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
				transition:fade={{ duration: 150 }}
			>
				<div
					class="bg-navbar rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden"
					transition:fly={{ y: 20, duration: 200 }}
				>
					<div class="p-8 text-center flex-1">
						<div
							class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-5"
						>
							<svg
								class="w-8 h-8 text-problem"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								/>
							</svg>
						</div>

						<h3 class="text-xl font-black text-white mb-3 tracking-wide">Delete Artist Deal?</h3>

						<p class="text-gray2 text-sm font-bold leading-relaxed">
							Are you sure you wanna delete this deal?<br />
							<span class="text-problem">This action cannot be undone!</span>
						</p>
					</div>

					<div class="p-6 flex gap-4 justify-center bg-black/20">
						<button
							type="button"
							class="px-8 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
							on:click={cancelDelete}
						>
							Cancel
						</button>
						<button
							type="button"
							class="px-8 py-3 bg-problem text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
							on:click={confirmDelete}
						>
							Confirm
						</button>
					</div>
				</div>
			</div>
		{/if}
		{#if showSettlementModal && settlementDeal}
			<div
				use:portal
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
				transition:fade={{ duration: 150 }}
			>
				<div
					class="bg-navbar rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[85vh]"
					transition:fly={{ y: 20, duration: 200 }}
				>
					<div class="p-6 border-b border-gray2/10 flex justify-between items-center shrink-0">
						<div>
							<h2 class="text-xl font-bold text-white tracking-wide">Settlement Sheet</h2>
							<p class="text-gray2 text-xs font-bold mt-0.5">{settlementDeal.artistName}</p>
						</div>
						<button
							type="button"
							class="text-gray2 hover:text-white transition-colors cursor-pointer"
							on:click={closeSettlementModal}
							aria-label="Close"
						>
							<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					</div>

					<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3">
						{#if settlementDeal.w_tax && Number(settlementDeal.w_tax_amount) > 0}
							<div class="flex items-center justify-between bg-gray1/60 rounded-xl px-4 py-2.5">
								<span class="text-sm font-bold text-gray3"
									>Tax Withholding ({settlementDeal.w_tax_amount}% of artist earnings)</span
								>
								<span class="text-xs font-black uppercase tracking-widest text-gray2">Auto</span>
							</div>
						{/if}

						<div class="flex items-center justify-between mt-1">
							<span class="text-xs font-black uppercase tracking-widest text-gray3">Adjustments</span>
							<button
								type="button"
								on:click={addAdjustment}
								class="text-lime text-xs font-bold hover:opacity-80 cursor-pointer">+ Add Adjustment</button
							>
						</div>
						<p class="text-[11px] text-gray2 font-medium -mt-1">
							Amounts in {settlementDeal.dealCurrency || 'USD'} — positive adds to the artist payout,
							negative deducts (e.g. "Lighting rental" +1,432.18).
						</p>

						{#each adjDraft as adj (adj.id)}
							<div class="flex items-center gap-2">
								<input
									type="text"
									bind:value={adj.label}
									placeholder="Label (e.g. Lighting rental)"
									class="flex-1 bg-gray1 rounded-xl px-3 py-2 text-sm text-white placeholder-gray2 focus:outline-none"
								/>
								<input
									type="number"
									step="0.01"
									bind:value={adj.amount}
									class="w-32 bg-gray1 rounded-xl px-3 py-2 text-sm text-white text-right focus:outline-none"
								/>
								<button
									type="button"
									on:click={() => removeAdjustment(adj.id)}
									class="text-gray2 hover:text-problem font-bold cursor-pointer px-1">×</button
								>
							</div>
						{:else}
							<p class="text-gray2 text-xs font-bold py-2 text-center">No manual adjustments.</p>
						{/each}

						{#if settlementConfirm}
							<p class="text-problem text-xs font-black mt-1">
								No changes since the last {settlementConfirm === 'external' ? 'Ext.' : 'Int.'}
								Settlement — click again to overwrite it anyway.
							</p>
						{/if}
						{#if settlementError}
							<p class="text-problem text-xs font-bold">{settlementError}</p>
						{/if}
					</div>

					<div class="p-5 border-t border-gray2/10 flex gap-3 justify-end shrink-0">
						<button
							type="button"
							on:click={closeSettlementModal}
							class="px-5 py-2.5 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={settlementGenerating}
							on:click={() => attemptGenerateSettlement('internal')}
							class="px-5 py-2.5 text-sm font-bold rounded-full transition-colors cursor-pointer disabled:opacity-50 {settlementConfirm ===
							'internal'
								? 'bg-problem text-black'
								: 'bg-gray1 text-white hover:text-lime'}"
						>
							{settlementConfirm === 'internal' ? 'Overwrite Internal?' : 'Internal'}
						</button>
						<button
							type="button"
							disabled={settlementGenerating}
							on:click={() => attemptGenerateSettlement('external')}
							class="px-5 py-2.5 text-sm font-black rounded-full transition-opacity cursor-pointer disabled:opacity-50 {settlementConfirm ===
							'external'
								? 'bg-problem text-black'
								: 'bg-lime text-black hover:opacity-80'}"
						>
							{settlementGenerating
								? 'Generating...'
								: settlementConfirm === 'external'
									? 'Overwrite External?'
									: 'External (Artist)'}
						</button>
					</div>
				</div>
			</div>
		{/if}
		{#if offerDeleteTarget}
			<div
				use:portal
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
				transition:fade={{ duration: 150 }}
			>
				<div
					class="bg-navbar rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden"
					transition:fly={{ y: 20, duration: 200 }}
				>
					<div class="p-8 text-center">
						<div class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-5">
							<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"></polyline>
								<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
							</svg>
						</div>
						<h3 class="text-xl font-black text-white mb-2 tracking-wide">
							Delete {offerDeleteTarget.kind === 'settlement' && offerDeleteTarget.se
								? settlementLabel(offerDeleteTarget.se)
								: `Offer ${offerDeleteTarget.o?.n}`}?
						</h3>
						<p class="text-gray2 text-sm font-bold leading-relaxed">
							<span class="text-white">{offerDeleteTarget.deal.artistName}</span> —
							generated {formatOfferDate(
								(offerDeleteTarget.se || offerDeleteTarget.o)?.generatedAt || ''
							)}.<br />
							The PDF will be <span class="text-problem">permanently deleted</span>.
						</p>
					</div>
					<div class="p-6 flex gap-3 justify-center bg-black/20">
						<button
							type="button"
							class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
							on:click={() => (offerDeleteTarget = null)}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={offerDeleting}
							class="px-6 py-3 bg-problem text-black font-black rounded-full hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
							on:click={confirmDeleteOffer}
						>
							{offerDeleting
								? 'Deleting...'
								: offerDeleteTarget.kind === 'settlement'
									? 'Delete Settlement'
									: 'Delete Offer'}
						</button>
					</div>
				</div>
			</div>
		{/if}
		{#if showOfferModal && offerDeal}
			<div
				use:portal
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
				transition:fade={{ duration: 150 }}
			>
				<div
					class="bg-navbar rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden"
					transition:fly={{ y: 20, duration: 200 }}
				>
					<div class="p-8 text-center flex-1">
						<div
							class="w-16 h-16 {offerStep === 'nochange'
								? 'bg-problem/10'
								: 'bg-lime/10'} rounded-full flex items-center justify-center mx-auto mb-5"
						>
							{#if offerStep === 'nochange'}
								<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
									<line x1="12" y1="9" x2="12" y2="13"></line>
									<line x1="12" y1="17" x2="12.01" y2="17"></line>
								</svg>
							{:else if offerStep === 'generating'}
								<svg class="w-8 h-8 text-lime animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
									<path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
								</svg>
							{:else if offerStep === 'done'}
								<svg class="w-8 h-8 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"></polyline>
								</svg>
							{:else if offerStep === 'rate'}
								<svg class="w-8 h-8 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M17 1l4 4-4 4"></path>
									<path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
									<path d="M7 23l-4-4 4-4"></path>
									<path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
								</svg>
							{:else}
								<svg class="w-8 h-8 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
									<line x1="16" y1="13" x2="8" y2="13"></line>
									<line x1="16" y1="17" x2="8" y2="17"></line>
								</svg>
							{/if}
						</div>

						<h3 class="text-xl font-black text-white mb-2 tracking-wide">
							{offerStep === 'nochange' ? 'No Changes Detected' : 'Generating Offer'}
						</h3>
						<p class="text-gray2 text-sm font-bold mb-6">
							{offerDeal.artistName}
						</p>

						{#if offerStep === 'rate'}
							{#if offerRateInfoOnly}
								<p class="text-gray2 text-sm font-bold leading-relaxed mb-6">
									The exchange rate changed since the last offer{useCustomRate
										? ' (custom rate set in Settings)'
										: ''}. Continue with the new rate?
								</p>

								<div class="flex items-center justify-center gap-4">
									<div class="bg-black/30 rounded-2xl px-5 py-4 flex-1 max-w-[150px]">
										<span
											class="text-[10px] text-gray2 font-bold uppercase tracking-widest block mb-1"
											>Last Offer</span
										>
										<span class="text-xl font-black text-white"
											>{(offerPrevRate ?? 0).toFixed(4)}</span
										>
									</div>

									<svg
										class="w-6 h-6 text-lime shrink-0"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2.5"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<line x1="5" y1="12" x2="19" y2="12"></line>
										<polyline points="12 5 19 12 12 19"></polyline>
									</svg>

									<div
										class="bg-lime/10 border border-lime/30 rounded-2xl px-5 py-4 flex-1 max-w-[150px]"
									>
										<span
											class="text-[10px] text-lime/70 font-bold uppercase tracking-widest block mb-1"
											>Current</span
										>
										<span class="text-xl font-black text-lime"
											>{resolveDealRate(offerDeal).toFixed(4)}</span
										>
									</div>
								</div>
							{:else}
							<p class="text-gray2 text-sm font-bold leading-relaxed mb-6">
								Update the exchange rate to the most recent before generating the offer?
							</p>

							<div class="flex items-center justify-center gap-4">
								<div class="bg-black/30 rounded-2xl px-5 py-4 flex-1 max-w-[150px]">
									<span
										class="text-[10px] text-gray2 font-bold uppercase tracking-widest block mb-1"
										>Current</span
									>
									<span class="text-xl font-black text-white"
										>{resolveDealRate(offerDeal).toFixed(4)}</span
									>
								</div>

								<svg
									class="w-6 h-6 text-lime shrink-0"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<line x1="5" y1="12" x2="19" y2="12"></line>
									<polyline points="12 5 19 12 12 19"></polyline>
								</svg>

								<div
									class="bg-lime/10 border border-lime/30 rounded-2xl px-5 py-4 flex-1 max-w-[150px]"
								>
									<span
										class="text-[10px] text-lime/70 font-bold uppercase tracking-widest block mb-1"
										>Most Recent</span
									>
									<span class="text-xl font-black text-lime">{markedUpLiveRate(offerDeal).toFixed(4)}</span>
								</div>
							</div>

							{#if markupAppliesTo(offerDeal)}
								<p class="text-gray2 text-xs font-bold mt-4">
									Both rates include the +{fxMarkupPercent}% FX markup.
								</p>
							{/if}
							{/if}
						{:else if offerStep === 'nochange'}
							{@const latestN = dealOffers(offerDeal).length
								? Math.max(...dealOffers(offerDeal).map((o) => o.n))
								: 0}
							<p class="text-problem text-base font-black leading-relaxed">Are you sure?</p>
							<p class="text-gray3 text-sm font-bold leading-relaxed mt-2">
								There was <span class="text-problem">no change</span> since
								<span class="text-white">Offer {latestN}</span> — generating again will produce an
								identical sheet.
							</p>
						{:else if offerStep === 'version'}
							{@const latestN = dealOffers(offerDeal).length
								? Math.max(...dealOffers(offerDeal).map((o) => o.n))
								: 0}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								An offer already exists for this deal. Overwrite
								<span class="text-white">Offer {latestN}</span> or save this one as
								<span class="text-lime">Offer {latestN + 1}</span>?
							</p>
						{:else if offerStep === 'confirm'}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								This will generate <span class="text-lime">Offer 1</span> for
								<span class="text-white">{offerDeal.artistName}</span> as a PDF and store it in
								the offer history.
							</p>
							{#if isLockedStage && lockedExchangeRate}
								<p class="text-gray2 text-xs font-bold mt-4">
									Rate locked at {lockedExchangeRate.toFixed(4)} ({effectiveStatus}).
								</p>
							{/if}
						{:else if offerStep === 'generating'}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								Building the offer sheet PDF...
							</p>
						{:else if offerStep === 'done'}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								<span class="text-lime">Offer {lastGeneratedNumber}</span> was generated and saved
								to the offer history.
							</p>
						{:else if offerStep === 'error'}
							<p class="text-problem text-sm font-bold leading-relaxed">{offerError}</p>
						{/if}
					</div>

					<div class="p-6 flex gap-3 justify-center items-center bg-black/20 flex-nowrap">
						{#if offerStep === 'rate'}
							{#if offerRateInfoOnly}
								<button
									type="button"
									class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
									on:click={closeOfferModal}
								>
									Cancel
								</button>
								<button
									type="button"
									class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
									on:click={keepOfferRate}
								>
									Continue
								</button>
							{:else}
								<button
									type="button"
									class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
									on:click={keepOfferRate}
								>
									Keep Rate
								</button>
								<button
									type="button"
									disabled={offerUpdating}
									class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-wait"
									on:click={updateOfferRate}
								>
									{offerUpdating ? 'Updating...' : 'Update Rate'}
								</button>
							{/if}
						{:else if offerStep === 'nochange'}
							{@const latestEntry = latestOffer(offerDeal)}
							<button
								type="button"
								class="px-4 py-2.5 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
								on:click={closeOfferModal}
							>
								Cancel
							</button>
							{#if latestEntry}
								<button
									type="button"
									class="px-4 py-2.5 bg-gray1 text-white text-sm font-bold rounded-full hover:text-lime transition-colors cursor-pointer whitespace-nowrap"
									on:click={() => {
										const d = offerDeal;
										closeOfferModal();
										if (latestEntry && d) openOfferPretty(d.artistName, latestEntry.n);
									}}
								>
									View Offer {latestEntry.n}
								</button>
							{/if}
							<button
								type="button"
								class="px-4 py-2.5 bg-lime text-black text-sm font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
								on:click={() => (offerStep = 'version')}
							>
								Generate Anyway
							</button>
						{:else if offerStep === 'version'}
							{@const latestN = dealOffers(offerDeal).length
								? Math.max(...dealOffers(offerDeal).map((o) => o.n))
								: 0}
							<button
								type="button"
								class="px-4 py-2.5 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
								on:click={closeOfferModal}
							>
								Cancel
							</button>
							<button
								type="button"
								class="px-4 py-2.5 bg-gray1 text-white text-sm font-bold rounded-full hover:text-lime transition-colors cursor-pointer whitespace-nowrap"
								on:click={() => generateOffer('overwrite')}
							>
								Overwrite Offer {latestN}
							</button>
							<button
								type="button"
								class="px-4 py-2.5 bg-lime text-black text-sm font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap"
								on:click={() => generateOffer('new')}
							>
								Save as Offer {latestN + 1}
							</button>
						{:else if offerStep === 'confirm'}
							<button
								type="button"
								class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
								on:click={closeOfferModal}
							>
								Cancel
							</button>
							<button
								type="button"
								class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
								on:click={() => generateOffer('new')}
							>
								Generate Offer
							</button>
						{:else if offerStep === 'done'}
							<button
								type="button"
								class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
								on:click={closeOfferModal}
							>
								Close
							</button>
							{#if lastGeneratedPath}
								<button
									type="button"
									class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
									on:click={() =>
										offerDeal && openOfferPretty(offerDeal.artistName, lastGeneratedNumber)}
								>
									Open PDF
								</button>
							{/if}
						{:else if offerStep === 'error'}
							<button
								type="button"
								class="px-6 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
								on:click={closeOfferModal}
							>
								Close
							</button>
							<button
								type="button"
								class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer"
								on:click={() => offerDeal && (offerStep = nextOfferStep(offerDeal))}
							>
								Retry
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}