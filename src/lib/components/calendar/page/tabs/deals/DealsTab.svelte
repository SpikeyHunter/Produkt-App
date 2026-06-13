<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import DealCreator from './DealCreator.svelte';
	import { fade, fly } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import {
		computeArtistPayout,
		computeEventCosts,
		formatDealSummary
	} from '$lib/components/calendar/page/tabs/deals/dealEngine';
	import type { DealRole, DealTypeOption, Deposit } from '../../../../../types/tabs/deals';

	let dailyApiRate = 1;
	let activeExchangeRate = 1;
	let useCustomRate = false;
	let customRate = 1.3832;

	// --- FX offer markup (event-level, set in OffersModal) ---
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

	$: effectiveStatus = String(
		eventStatus ||
			event?.status ||
			event?.calendar?.status ||
			event?.event_status ||
			event?.calendar_data?.status ||
			''
	).toLowerCase();
	$: isLockedStage = effectiveStatus === 'settlement' || effectiveStatus === 'settled';
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
		const cb = computeEventCosts(
			parsedEventCost,
			parsedEventRevenue,
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
		if (isLockedStage && lockedExchangeRate) return lockedExchangeRate;
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

	function resolveDealPayout(deal: any): number {
		if (deal.isPendingInfoOnly) return 0;
		const hd = {
			dealType: deal.dealType,
			guaranteeAmount: deal.guaranteeAmount,
			details: deal.details
		};
		return computeArtistPayout(hd, { ...dealContext, exchangeRate: resolveDealRate(deal) });
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

	onMount(async () => {
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

	// --- Offer flow (exchange rate check popup; no offer generation yet) ---
	let showOfferModal = false;
	let offerDeal: Deal | null = null;
	let offerUpdating = false;

	function openOfferModal(deal: Deal) {
		activeMenuId = null;

		const ratesMatch = Math.abs(resolveDealRate(deal) - markedUpLiveRate(deal)) < 0.00005;
		const noConversion = deal.dealCurrency === venueCurrency;

		// Nothing to ask: rate already current, no conversion, or locked at settlement.
		if (ratesMatch || noConversion || (isLockedStage && lockedExchangeRate)) {
			// TODO: proceed directly to offer generation when that's built.
			return;
		}

		offerDeal = deal;
		showOfferModal = true;
	}

	function closeOfferModal() {
		showOfferModal = false;
		offerDeal = null;
		offerUpdating = false;
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
		closeOfferModal();
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
					eventCost={overrideCalendarData
						? overrideCalendarData.event_cost
						: event?.calendar_data?.event_cost || event?.event_cost || null}
					eventRevenue={overrideCalendarData
						? overrideCalendarData.event_revenue
						: event?.calendar_data?.event_revenue || event?.event_revenue || null}
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
											<div class="flex items-center gap-4">
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
												<div>
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														{#if deal.isPendingInfoOnly}
															<p class="text-sm text-gray2 font-bold mt-1">No deal setup</p>
														{:else}
															<p class="text-sm text-lime font-bold mt-1">
																{formatDealSummary(deal, dealContext.costs, venueCurrency)}
															</p>
															{#if getLogisticsText(deal)}
																<p class="text-xs text-gray2 font-medium mt-1">
																	{getLogisticsText(deal)}
																</p>
															{/if}
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4">
												{#if canViewDetails}
													<button
														disabled={deal.isPendingInfoOnly || !canEditAndManage}
														on:click={() => openOfferModal(deal)}
														class="flex items-center gap-2 px-4 py-2 bg-navbar border rounded-3xl text-sm font-bold transition-colors {deal.isPendingInfoOnly ||
														!canEditAndManage
															? 'border-gray2/20 text-gray2 opacity-50 cursor-not-allowed'
															: 'border-lime/40 text-lime hover:bg-lime/10 cursor-pointer'}"
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
														Offer
													</button>
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
																class="absolute right-0 top-full mt-1 w-32 bg-navbar border border-gray2/20 rounded-xl shadow-2xl overflow-hidden"
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
											<div class="flex items-center gap-4">
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
												<div>
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														{#if deal.isPendingInfoOnly}
															<p class="text-sm text-gray2 font-bold mt-1">No deal setup</p>
														{:else}
															<p class="text-sm text-lime font-bold mt-1">
																{formatDealSummary(deal, dealContext.costs, venueCurrency)}
															</p>
															{#if getLogisticsText(deal)}
																<p class="text-xs text-gray2 font-medium mt-1">
																	{getLogisticsText(deal)}
																</p>
															{/if}
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4">
												{#if canViewDetails}
													<button
														disabled={deal.isPendingInfoOnly || !canEditAndManage}
														on:click={() => openOfferModal(deal)}
														class="flex items-center gap-2 px-4 py-2 bg-navbar border rounded-3xl text-sm font-bold transition-colors {deal.isPendingInfoOnly ||
														!canEditAndManage
															? 'border-gray2/20 text-gray2 opacity-50 cursor-not-allowed'
															: 'border-lime/40 text-lime hover:bg-lime/10 cursor-pointer'}"
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
														Offer
													</button>
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
																class="absolute right-0 top-full mt-1 w-32 bg-navbar border border-gray2/20 rounded-xl shadow-2xl overflow-hidden"
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
							class="w-16 h-16 bg-lime/10 rounded-full flex items-center justify-center mx-auto mb-5"
						>
							<svg
								class="w-8 h-8 text-lime"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M17 1l4 4-4 4"></path>
								<path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
								<path d="M7 23l-4-4 4-4"></path>
								<path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
							</svg>
						</div>

						<h3 class="text-xl font-black text-white mb-2 tracking-wide">Generating Offer</h3>
						<p class="text-gray2 text-sm font-bold mb-6">
							{offerDeal.artistName}
						</p>

						{#if isLockedStage && lockedExchangeRate}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								This event is in <span class="text-lime">{effectiveStatus}</span>. The exchange
								rate is locked and cannot be updated.
							</p>
							<div class="mt-5 bg-black/30 rounded-2xl px-5 py-4 inline-block">
								<span class="text-[10px] text-gray2 font-bold uppercase tracking-widest block mb-1"
									>Locked Rate (USD &gt; {venueCurrency})</span
								>
								<span class="text-2xl font-black text-lime">{lockedExchangeRate.toFixed(4)}</span>
							</div>
						{:else if offerDeal.dealCurrency === venueCurrency}
							<p class="text-gray2 text-sm font-bold leading-relaxed">
								This deal is denominated in <span class="text-lime">{venueCurrency}</span> — no
								currency conversion applies.
							</p>
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

							{#if Math.abs(resolveDealRate(offerDeal) - markedUpLiveRate(offerDeal)) < 0.00005}
								<p class="text-gray2 text-xs font-bold mt-4">
									Rate is already up to date.
								</p>
							{:else if markupAppliesTo(offerDeal)}
								<p class="text-gray2 text-xs font-bold mt-4">
									Both rates include the +{fxMarkupPercent}% FX markup.
								</p>
							{/if}
						{/if}
					</div>

					<div class="p-6 flex gap-4 justify-center bg-black/20">
						<button
							type="button"
							class="px-8 py-3 bg-gray3 text-black font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
							on:click={closeOfferModal}
						>
							{(isLockedStage && lockedExchangeRate) || offerDeal.dealCurrency === venueCurrency
								? 'Close'
								: 'Keep Rate'}
						</button>
						{#if !(isLockedStage && lockedExchangeRate) && offerDeal.dealCurrency !== venueCurrency}
							<button
								type="button"
								disabled={offerUpdating}
								class="px-8 py-3 bg-lime text-black font-bold rounded-full hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-wait"
								on:click={updateOfferRate}
							>
								{offerUpdating ? 'Updating...' : 'Update Rate'}
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}