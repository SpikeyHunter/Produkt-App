<script lang="ts">
	import DealCreator from './DealCreator.svelte';
	import type { DealRole, DealTypeOption, Deposit } from '../../../../../types/tabs/deals';

	// --- Types ---
	interface Deal {
		id: string;
		artistName: string;
		role: DealRole;
		dealType: DealTypeOption;
		deposits: Deposit[];
	}

	export let userRole = 'Email Only';
	export let eventDealData: any;
	export let eventDate: string = '';

	// 🔥 STEP 1: What did the child component receive?
	$: {
		console.log('🛠️ [CHILD DealsTab.svelte] Received eventDealData prop:', eventDealData);
		console.log('🛠️ [CHILD DealsTab.svelte] Type of eventDealData:', typeof eventDealData);
	}

	// --- Aggressive Data Parsing ---
	$: currentDealData = (() => {
		let raw = eventDealData;
		if (!raw) {
			console.log('🛠️ [CHILD DealsTab.svelte] Raw data is falsy. Returning {}');
			return {};
		}

		if (typeof raw === 'object') {
			console.log(
				'🛠️ [CHILD DealsTab.svelte] Raw data is already an object. Returning it directly.'
			);
			return raw;
		}

		if (typeof raw === 'string') {
			console.log('🛠️ [CHILD DealsTab.svelte] Raw data is a string. Attempting to parse...');
			try {
				let parsed = JSON.parse(raw);
				console.log(
					'🛠️ [CHILD DealsTab.svelte] First parse successful. Result type:',
					typeof parsed,
					parsed
				);

				if (typeof parsed === 'string') {
					console.log(
						'🛠️ [CHILD DealsTab.svelte] Data was double-stringified! Attempting second parse...'
					);
					parsed = JSON.parse(parsed);
					console.log('🛠️ [CHILD DealsTab.svelte] Second parse successful. Final result:', parsed);
				}
				return parsed;
			} catch (e) {
				console.error('❌ [CHILD DealsTab.svelte] Deal Parse Error:', e, raw);
				return {};
			}
		}
		return {};
	})();

	// --- Derived Data ---
	$: deals = currentDealData?.deals || [];

	// 🚀 NEW: Robustly extract all pending headliners regardless of the underlying JSON structure
	$: pendingHeadliners = (() => {
		let list: any[] = [];

		if (Array.isArray(currentDealData)) {
			list = currentDealData;
		} else if (currentDealData?.headliners && Array.isArray(currentDealData.headliners)) {
			list = currentDealData.headliners;
		} else if (currentDealData?.headliner_name) {
			// Handles the standard single object case coming from your database
			list = [
				{
					headliner_name: currentDealData.headliner_name,
					headliner_pic: currentDealData.headliner_pic,
					headliner_id: currentDealData.headliner_id
				}
			];
		}

		// Filter out null or stringified "NULL" values
		return list.filter(
			(h) => h && h.headliner_name && h.headliner_name !== 'NULL' && h.headliner_name !== 'null'
		);
	})();

	$: headlinerDeals = deals.filter((d: Deal) => d.role === 'Headliner');
	$: supportDeals = deals.filter((d: Deal) => d.role === 'Support');

	// 🔥 STEP 2: Let's see what the variables resolve to
	$: {
		console.log('📊 [CHILD DealsTab.svelte] Final Derived State:');
		console.log('   -> currentDealData:', currentDealData);
		console.log('   -> pendingHeadliners:', pendingHeadliners);
	}

	// --- Permissions ---
	$: canEditAndManage = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewDetails = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewNamesOnly = ['Manager'].includes(userRole);
	$: hasAnyAccess = canViewDetails || canViewNamesOnly;

	// --- State ---
	let isCreatingDeal = false;

	function openCreateDeal() {
		isCreatingDeal = true;
	}

	function hasExistingDeal(dealsList: Deal[], targetName: string): boolean {
		return dealsList.some((d) => d.artistName === targetName);
	}

	function handleSaveDeal(event: CustomEvent<Deal>) {
		const newDeal = event.detail;
		// Ensure we don't break the object structure if currentDealData happened to be an array
		const updatedData = Array.isArray(currentDealData)
			? { headliners: currentDealData, deals: [] }
			: { ...currentDealData };

		if (!updatedData.deals) updatedData.deals = [];
		updatedData.deals = [...updatedData.deals, newDeal];

		eventDealData = updatedData;
		console.log('Saved Deal locally:', updatedData);
		isCreatingDeal = false;
	}

	function handleCancelDeal() {
		isCreatingDeal = false;
	}
</script>

{#if !hasAnyAccess}
	<div class="p-8 text-gray2 font-bold bg-navbar h-full">
		You do not have permission to view deals.
	</div>
{:else}
	<div class="flex flex-col h-full bg-navbar text-white relative">
		{#if !isCreatingDeal}
			<div class="px-8 py-6 border-b-2 border-gray1 flex justify-between items-center shrink-0">
				<h2 class="text-2xl font-black uppercase tracking-wide text-white">Deals</h2>
				<div class="flex items-center gap-4">
					{#if canEditAndManage}
						<button
							class="px-6 py-3 bg-navbar border-2 border-gray1 text-lime font-bold rounded-full hover:bg-gray1 transition-colors text-sm cursor-pointer"
						>
							Create Partner Deal
						</button>
						<button
							on:click={openCreateDeal}
							class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:opacity-90 transition-opacity text-sm cursor-pointer"
						>
							Create Artist Deal
						</button>
					{/if}
				</div>
			</div>
		{/if}

		<div class="p-8 overflow-y-auto">
			{#if isCreatingDeal && canEditAndManage}
			<DealCreator on:save={handleSaveDeal} on:cancel={handleCancelDeal} event_date={eventDate} />
			{:else}
				<div class="flex flex-col gap-8">
					<div class="rounded-2xl overflow-hidden bg-gray1">
						<div
							class="bg-black/30 px-8 py-5 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar"
						>
							Headliners
						</div>
						<div class="p-8">
							{#if pendingHeadliners.length === 0 && headlinerDeals.length === 0}
								<p class="text-gray2 font-medium">
									To add an artist click the "Create Artist Deal" button in the top right.
								</p>
							{:else}
								{#each pendingHeadliners as pending}
									{#if !hasExistingDeal(headlinerDeals, pending.headliner_name)}
										<div
											class="flex items-center gap-4 mb-6 pb-6 border-b-2 border-navbar last:border-0 last:pb-0"
										>
											{#if pending.headliner_pic && pending.headliner_pic !== 'NULL'}
												<img
													src={pending.headliner_pic}
													alt={pending.headliner_name}
													class="w-12 h-12 rounded-full object-cover bg-black"
												/>
											{:else}
												<img
													src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktIcon-iOS-Default-1024x1024@1x%20(1).png"
													alt={pending.headliner_name}
													class="w-12 h-12 rounded-full object-cover bg-black"
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
										class="flex justify-between items-center mb-6 last:mb-0 border-b-2 border-navbar pb-6 last:border-0 last:pb-0"
									>
										<div>
											<p class="font-black text-xl text-white">{deal.artistName}</p>
											{#if canViewDetails}
												<p class="text-sm text-gray2 font-bold mt-1">{deal.dealType} Deal</p>
											{/if}
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</div>

					<div class="rounded-2xl overflow-hidden bg-gray1">
						<div
							class="bg-black/30 px-8 py-5 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar"
						>
							Support
						</div>
						<div class="p-8">
							{#if supportDeals.length === 0}
								<p class="text-gray2 font-medium">No support deals added yet.</p>
							{:else}
								{#each supportDeals as deal}
									<div
										class="flex justify-between items-center mb-6 last:mb-0 border-b-2 border-navbar pb-6 last:border-0 last:pb-0"
									>
										<div>
											<p class="font-black text-xl text-white">{deal.artistName}</p>
											{#if canViewDetails}
												<p class="text-sm text-gray2 font-bold mt-1">{deal.dealType} Deal</p>
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
