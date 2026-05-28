<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import DealCreator from './DealCreator.svelte';
	import { fade, fly } from 'svelte/transition';
	import { computeArtistPayout } from '$lib/components/calendar/page/tabs/deals/dealEngine';
	import type { DealRole, DealTypeOption, Deposit } from '../../../../../types/tabs/deals';

	let dailyApiRate = 1;
	let activeExchangeRate = 1;
	let useCustomRate = false;
	let customRate = 1.3832;

	// --- Types ---
	interface Deal {
		id: string;
		artistName: string;
		artistId?: string;
		artistPic?: string;
		summaryText?: string;
		w_tax?: boolean;
		w_tax_amount?: number;
		description?: any;
		role: DealRole;
		dealType: DealTypeOption;
		deposits: Deposit[];
		[key: string]: any;
	}

	export let userRole = 'Email Only';
	export let eventDealData: any;
	export let eventDate: string = '';
	export let event: any = null;
	export let venueCurrency: string = 'CAD';

	// --- Aggressive Data Parsing ---
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
		const rawCost = event?.calendar_data?.event_cost || event?.event_cost || event?.event_costs;
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

	// Parse event revenue (tickets + financials), mirroring parsedEventCost.
	$: parsedEventRevenue = (() => {
		const raw =
			event?.calendar_data?.event_revenue || event?.event_revenue || event?.event_revenues;
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

	// Build the revenue/cost context the deal engine needs to resolve
	// Versus / Plus / Door backends. Uses ACTUAL figures (sold + actualInternal),
	// falling back gracefully to 0 when data is missing.
	$: dealContext = (() => {
		const rev = parsedEventRevenue || {};
		const tickets: any[] = Array.isArray(rev.tickets) ? rev.tickets : [];
		const fin = rev.financials || {};
		const taxRate = Number(fin.taxRate) || 0;
		const taxType = fin.taxType || 'Divisor';
		const facilityFee = Number(fin.facilityFee) || 0;

		let gross = 0,
			paidTickets = 0,
			totalAllotment = 0,
			fees = 0;
		for (const t of tickets) {
			const sold = Number(t.sold) || 0;
			gross += sold * (Number(t.price) || 0);
			paidTickets += sold;
			totalAllotment += Number(t.allotment) || 0;
			fees += sold * (Number(t.ticketFees) || 0) + sold * facilityFee;
		}
		const taxable = gross - fees;
		const taxes =
			taxType === 'Multiplier'
				? taxable * (taxRate / 100)
				: taxable - taxable / (1 + taxRate / 100);
		const netGross = gross - taxes - fees;

		// Non-artist costs: fixed (actualInternal) + variable + support.
		const cost = parsedEventCost || {};
		let fixed = 0;
		(Array.isArray(cost.fixedCosts) ? cost.fixedCosts : []).forEach((g: any) => {
			(Array.isArray(g.costs) ? g.costs : []).forEach((c: any) => {
				fixed += Number(c.actualInternal) || 0;
			});
		});
		let variable = 0;
		(Array.isArray(cost.variableCosts) ? cost.variableCosts : []).forEach((v: any) => {
			const m = Number(v.internalAmount) || 0;
			switch (v.type) {
				case 'Flat':
					variable += Number(v.actualInternal) || m;
					break;
				case '% of Gross':
					variable += (m / 100) * gross;
					break;
				case '% of Net Gross':
					variable += (m / 100) * netGross;
					break;
				case '$ per Paid Ticket':
				case '$ per Attendee':
					variable += m * paidTickets;
					break;
			}
		});
		const support = Number(additionalSupportActual) || 0;

		return {
			gross,
			netGross,
			costs: fixed + variable + support,
			paidTickets,
			totalAllotment,
			exchangeRate: activeExchangeRate
		};
	})();

	// Resolve a single deal's payout (handles Flat/Versus/Plus/Door) in venue currency.
	function resolveDealPayout(deal: any): number {
		const hd = {
			dealType: deal.dealType,
			guaranteeAmount: deal.guaranteeAmount,
			details: deal.details
		};
		return computeArtistPayout(hd, dealContext);
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
						let dealData = raw[`${keyPrefix}_deal${sfx}`] || {};
						parsedDeals.push({
							id: dealData.id || crypto.randomUUID(),
							role: roleStr,
							artistId: raw[`${keyPrefix}_id${sfx}`],
							artistName: name,
							artistPic: raw[`${keyPrefix}_pic${sfx}`],
							...dealData
						});
					}
					i++;
				}
			};

			parseRoleDeals('Headliner', 'headliner');
			parseRoleDeals('Support', 'support');
		} else {
			parsedDeals = raw;
		}

		return parsedDeals;
	})();

	$: pendingHeadliners = (() => {
		let list: any[] = [];
		if (Array.isArray(currentDealData)) {
			list = currentDealData;
		} else if (currentDealData?.headliners && Array.isArray(currentDealData.headliners)) {
			list = currentDealData.headliners;
		} else if (currentDealData?.headliner_name) {
			list = [
				{
					headliner_name: currentDealData.headliner_name,
					headliner_pic: currentDealData.headliner_pic,
					headliner_id: currentDealData.headliner_id
				}
			];
		}
		return list.filter(
			(h) => h && h.headliner_name && h.headliner_name !== 'NULL' && h.headliner_name !== 'null'
		);
	})();

	$: headlinerDeals = deals.filter((d: Deal) => d.role === 'Headliner');
	$: supportDeals = deals.filter((d: Deal) => d.role === 'Support');

	// --- Permissions ---
	$: canEditAndManage = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewDetails = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewNamesOnly = ['Manager'].includes(userRole);
	$: hasAnyAccess = canViewDetails || canViewNamesOnly;

	// --- State ---
	let isCreatingDeal = false;
	let dealToEdit: Deal | null = null;
	let activeMenuId: string | null = null;

	// --- ADD THESE TWO LINES ---
	let showDeleteModal = false;
	let dealToDeleteId: string | null = null;

	// Add these near your other state variables
	let additionalSupportBudgeted: number | string = 0;
	let additionalSupportActual: number | string = 0;

	// Reactively load them when your DB payload is parsed
	$: if (currentDealData) {
		additionalSupportBudgeted = currentDealData.additional_support_budgeted || 0;
		additionalSupportActual = currentDealData.additional_support_actual || 0;

		// --- ADD THESE LINES ---
		useCustomRate = currentDealData.useCustomRate || false;
		customRate = currentDealData.customRate || 1.3832;
		activeExchangeRate = useCustomRate ? customRate : dailyApiRate;
	}

	onMount(async () => {
		if (venueCurrency !== 'USD') {
			try {
				const res = await fetch('https://open.er-api.com/v6/latest/USD');
				const data = await res.json();
				if (data?.rates?.[venueCurrency]) {
					dailyApiRate = data.rates[venueCurrency];
					// Update active rate immediately if API loads after data parsing
					activeExchangeRate = useCustomRate ? customRate : dailyApiRate;
				}
			} catch (err) {
				console.error('Error fetching API rate:', err);
			}
		}
	});

	function openCreateDeal() {
		dealToEdit = null;
		isCreatingDeal = true;
		activeMenuId = null;
	}

	function hasExistingDeal(dealsList: Deal[], targetName: string): boolean {
		return dealsList.some((d) => d.artistName === targetName);
	}

	function editDeal(deal: Deal) {
		dealToEdit = deal;
		isCreatingDeal = true;
		activeMenuId = null;
	}

	function deleteDeal(dealId: string) {
		// Open the modal and set the target ID instead of using native confirm()
		dealToDeleteId = dealId;
		showDeleteModal = true;
		activeMenuId = null;
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
		if (deal.w_tax) {
			parts.push(`(subject to ${deal.w_tax_amount || 0}% w holding tax)`);
		}

		let logi = [];
		if (deal.description?.hotels?.enabled) {
			const h = deal.description.hotels;
			const rooms = h.rooms || 0;
			const suites = h.suites || 0;
			const nights = h.nights || 0;
			let hotelParts = [];
			// Add an 's' dynamically if the count is not exactly 1
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

		// ADDED: Check for notes and push them into the parts array
		if (deal.description?.other?.enabled && deal.description.other.notes) {
			parts.push(deal.description.other.notes);
		}

		return parts.join(' ');
	}

	async function saveToDatabase(updatedDeals: Deal[]) {
		let dbPayload: any = {};
		const hList = updatedDeals.filter((d) => d.role === 'Headliner');
		const sList = updatedDeals.filter((d) => d.role === 'Support');

		// Build Headliners (Only if they exist)
		hList.forEach((h, index) => {
			let sfx = index === 0 ? '' : `_${index + 1}`;
			dbPayload[`headliner_id${sfx}`] = h.artistId || 'NULL';
			dbPayload[`headliner_name${sfx}`] = h.artistName || 'NULL';
			dbPayload[`headliner_pic${sfx}`] = h.artistPic || 'NULL';
			const { role, artistId, artistName, artistPic, ...cleanDealObj } = h;
			dbPayload[`headliner_deal${sfx}`] = cleanDealObj;
		});

		// Build Supports (Only if they exist)
		sList.forEach((s, index) => {
			let sfx = index === 0 ? '' : `_${index + 1}`;
			dbPayload[`support_id${sfx}`] = s.artistId || 'NULL';
			dbPayload[`support_name${sfx}`] = s.artistName || 'NULL';
			dbPayload[`support_pic${sfx}`] = s.artistPic || 'NULL';
			const { role, artistId, artistName, artistPic, ...cleanDealObj } = s;
			dbPayload[`support_deal${sfx}`] = cleanDealObj;
		});

		// If all deals are deleted, revert to the default empty state
		if (Object.keys(dbPayload).length === 0) {
			dbPayload = {
				headliner_id: 'NULL',
				headliner_name: 'NULL',
				headliner_pic: 'NULL'
			};
		}
		// --- ADD THESE TWO LINES ---
		dbPayload.additional_support_budgeted = Number(additionalSupportBudgeted) || 0;
		dbPayload.additional_support_actual = Number(additionalSupportActual) || 0;
		// ---------------------------

		// --- ADD THESE TWO LINES ---
		dbPayload.useCustomRate = useCustomRate;
		dbPayload.customRate = customRate;

		// Grab parent ID (group_id or calendar.id). Fallback to event.id just in case.
		const targetId = event?.calendar?.id || event?.group_id || event?.id;
		const currentVersion = event?.calendar?.current_version || 1;

		if (targetId) {
			try {
				console.log(
					`🛠️ [DealsTab] Attempting to save deals to calendar_data table ID: ${targetId} v${currentVersion}`
				);

				const { error } = await supabase
					.from('calendar_data')
					.update({ event_deal: dbPayload })
					.eq('calendar_id', targetId)
					.eq('version_number', currentVersion);

				if (error) throw error;
				console.log('✅ [DealsTab] Successfully saved to DB!', dbPayload);
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

	function getRetroBonusText(deal: Deal): string {
		// Return empty string if no retroactive bonus is enabled or set up
		if (
			!deal.details?.retroactiveBonusEnabled ||
			!deal.details?.retroactiveBonuses ||
			deal.details.retroactiveBonuses.length === 0
		) {
			return '';
		}

		// Check if the base deal is a percentage or flat amount to use the right symbol
		const isPercent = deal.details.metricType?.includes('%');
		const bonusStrings = deal.details.retroactiveBonuses.map((b: any) => {
			const amountStr = isPercent ? `${b.bonusAmount}%` : `$${formatMoney(b.bonusAmount)}`;
			const atStr =
				deal.details.retroactiveSwitchesAt === '% Sell Through'
					? `${b.atAmount}% sold`
					: `${b.atAmount} tickets sold`;

			return `switches to ${amountStr} after ${atStr}`;
		});

		return ` (${bonusStrings.join(', ')})`;
	}

	function formatMoney(amount: number | string) {
		const num = Number(amount);
		if (isNaN(num)) return amount; // Return as-is if it's not a valid number

		return new Intl.NumberFormat('en-US', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(num);
	}

	$: totalHeadlinerPayout = headlinerDeals.reduce((sum, deal) => {
		return sum + resolveDealPayout(deal);
	}, 0);

	$: totalSupportPayout =
		supportDeals.reduce((sum, deal) => {
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
							class="px-6 py-2 bg-navbar border-2 border-gray1 text-lime font-bold rounded-full hover:bg-gray1 transition-colors text-sm cursor-pointer"
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
					eventCost={event?.calendar_data?.event_cost || event?.event_cost || null}
					{venueCurrency}
				/>
			{:else}
				<div class="flex flex-col gap-8">
					<div>
						<div class="rounded-2xl bg-gray1">
							<div
								class="bg-black/40 px-4 py-3 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar rounded-t-2xl"
							>
								Headliners
							</div>
							<div class="p-4">
								{#if pendingHeadliners.length === 0 && headlinerDeals.length === 0}
									<p class="text-gray2 font-medium">
										To add an artist click the "Create Artist Deal" button in the top right.
									</p>
								{:else}
									{#each pendingHeadliners as pending}
										{#if !hasExistingDeal(headlinerDeals, pending.headliner_name)}
											<div
												class="flex items-center gap-4 mb-3 pb-3 border-b-2 border-navbar last:border-0 last:pb-0"
											>
												{#if pending.headliner_pic && pending.headliner_pic !== 'NULL'}
													<img
														src={pending.headliner_pic}
														alt={pending.headliner_name}
														class="w-16 h-16 rounded-full object-cover bg-black"
													/>
												{:else}
													<img
														src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png"
														alt={pending.headliner_name}
														class="w-16 h-16 rounded-full object-cover bg-black"
													/>
												{/if}
												<div>
													<p class="font-black text-xl text-white">{pending.headliner_name}</p>
													{#if canViewDetails}
														<p class="text-sm text-gray2 font-bold mt-1">Pending Deal Setup</p>
													{/if}
												</div>
											</div>
										{/if}
									{/each}

									{#each headlinerDeals as deal}
										<div
											class="flex justify-between items-center mb-3 last:mb-0 border-b-2 border-navbar pb-3 last:border-0 last:pb-0"
										>
											<div class="flex items-center gap-4">
												<img
													src={deal.artistPic && deal.artistPic !== 'NULL'
														? deal.artistPic
														: 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png'}
													alt={deal.artistName}
													class="w-16 h-16 rounded-full object-cover bg-black"
												/>
												<div>
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														<p class="text-sm text-lime font-bold mt-1">
															{deal.summaryText || `${deal.dealType} Deal`}
														</p>
														{#if getLogisticsText(deal)}
															<p class="text-xs text-gray2 font-medium mt-1">
																{getLogisticsText(deal)}
															</p>
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4">
												{#if canViewDetails}
													<button
														disabled
														class="flex items-center gap-2 px-4 py-2 bg-navbar border border-gray2/20 text-gray2 rounded-3xl opacity-50 cursor-not-allowed text-sm font-bold"
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
																	>Edit</button
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

												{#if canViewDetails}
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
																USD > CAD: {activeExchangeRate.toFixed(4)}
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
								class="bg-black/40 px-4 py-3 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar rounded-t-2xl"
							>
								Support
							</div>
							<div class="p-4">
								{#if supportDeals.length === 0}
									<p class="text-gray2 pb-4 pl-6 border-b-2 border-navbar mb-4">
										No support deals added yet.
									</p>
								{:else}
									{#each supportDeals as deal}
										<div
											class="flex justify-between items-center mb-4 pb-4 border-b-2 border-navbar"
										>
											<div class="flex items-center gap-4">
												<img
													src={deal.artistPic && deal.artistPic !== 'NULL'
														? deal.artistPic
														: 'https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png'}
													alt={deal.artistName}
													class="w-16 h-16 rounded-full object-cover bg-black"
												/>
												<div>
													<p class="font-black text-xl text-white">{deal.artistName}</p>
													{#if canViewDetails}
														<p class="text-sm text-lime font-bold mt-1">
															{deal.summaryText || `${deal.dealType} Deal`}
														</p>
														{#if getLogisticsText(deal)}
															<p class="text-xs text-gray2 font-medium mt-1">
																{getLogisticsText(deal)}
															</p>
														{/if}
													{/if}
												</div>
											</div>

											<div class="flex items-center gap-4">
												{#if canViewDetails}
													<button
														disabled
														class="flex items-center gap-2 px-4 py-2 bg-navbar border border-gray2/20 text-gray2 rounded-3xl opacity-50 cursor-not-allowed text-sm font-bold"
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
																	>Edit</button
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

												{#if canViewDetails}
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
																USD > CAD: {activeExchangeRate.toFixed(4)}
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
				class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
				transition:fade={{ duration: 150 }}
			>
				<div
					class="bg-navbar  rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden"
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
	</div>
{/if}