<script lang="ts">
	import { supabase } from '$lib/supabase';
	import DealCreator from './DealCreator.svelte';
	import type { DealRole, DealTypeOption, Deposit } from '../../../../../types/tabs/deals';

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
		const rawCost = event?.event_cost || event?.event_costs;
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

	async function deleteDeal(dealId: string) {
		if (confirm('Are you sure you want to remove this deal?')) {
			const updatedDeals = deals.filter((d) => d.id !== dealId);
			await saveToDatabase(updatedDeals);
		}
		activeMenuId = null;
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
			if (suites > 0) hotelParts.push(`${suites}x Suites`);
			if (rooms > 0) hotelParts.push(`${rooms}x Rooms`);

			if (hotelParts.length > 0) {
				logi.push(`${hotelParts.join(' + ')} for ${nights}x Night`);
			} else {
				logi.push(`0x Rooms for ${nights}x Night`);
			}
		}
		if (deal.description?.groundTransport?.enabled) logi.push('ground');
		if (deal.description?.immigration?.enabled) logi.push('exemption');

		if (logi.length > 0) {
			let logiStr = logi.join(' + ');
			if (parts.length > 0) parts.push(`plus ${logiStr}`);
			else parts.push(`Plus ${logiStr}`);
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

		// Grab parent ID (group_id or calendar.id). Fallback to event.id just in case.
		const targetId = event?.calendar?.id || event?.group_id || event?.id;

		if (targetId) {
			try {
				console.log(`🛠️ [DealsTab] Attempting to save deals to calendar table ID: ${targetId}`);
				const { error } = await supabase
					.from('calendar')
					.update({ event_deal: dbPayload })
					.eq('id', targetId);

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

		<div class="px-8 pt-4 overflow-y-auto">
			{#if isCreatingDeal && canEditAndManage}
				<DealCreator
					on:save={handleSaveDeal}
					on:cancel={handleCancelDeal}
					existingDeal={dealToEdit}
					event_date={eventDate}
					eventCost={event?.calendar?.event_cost || event?.event_cost || null}
					{venueCurrency}
				/>
			{:else}
				<div class="flex flex-col gap-8">
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
													<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
														<circle cx="12" cy="12" r="3"></circle>
													</svg>
													Offer
												</button>
											{/if}

											{#if canEditAndManage}
												<div class="relative {activeMenuId === deal.id ? 'z-50' : 'z-10'}" use:clickOutsideMenu>
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
												<div class="flex flex-col items-end pl-4 ml-2 min-w-[80px]">
													<span class="text-[10px] text-gray2 font-bold uppercase tracking-widest">Payout</span>
													<span class="text-lg font-black text-white">{venueCurrency} 0.00</span>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>

					<div class="rounded-2xl bg-gray1">
						<div
							class="bg-black/40 px-4 py-3 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar rounded-t-2xl"
						>
							Support
						</div>
						<div class="p-4">
							{#if supportDeals.length === 0}
								<p class="text-gray2 font-medium">No support deals added yet.</p>
							{:else}
								{#each supportDeals as deal}
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
													<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
														<circle cx="12" cy="12" r="3"></circle>
													</svg>
													Offer
												</button>
											{/if}

											{#if canEditAndManage}
												<div class="relative {activeMenuId === deal.id ? 'z-50' : 'z-10'}" use:clickOutsideMenu>
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
												<div class="flex flex-col items-end pl-4 ml-2 min-w-[80px]">
													<span class="text-[10px] text-gray2 font-bold uppercase tracking-widest">Payout</span>
													<span class="text-lg font-black text-white">{venueCurrency} 0.00</span>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}