<script lang="ts">
	import DealCreator from './DealCreator.svelte';

	// --- Types ---
	// Define the shape of a Deal so TypeScript knows what 'd' is
	interface Deal {
		id: string;
		artistName: string;
		role: 'Headliner' | 'Support';
		dealType: string;
		guaranteeUsd: number;
		exchangeData?: {
			rate: number;
			targetCurrency: string;
			dateFetched: string;
		} | null;
	}

	export let userRole = 'Email Only';
	export let venueSettings: any = null;

	// Apply the type here instead of using 'any'
	export let eventDealData: { deals: Deal[] } = { deals: [] };

	// --- Permissions ---
	$: canEditAndManage = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewDetails = ['Editor', 'Admin', 'Global Admin'].includes(userRole);
	$: canViewNamesOnly = ['Manager'].includes(userRole);
	$: hasAnyAccess = canViewDetails || canViewNamesOnly;

	// --- State ---
	let isCreatingDeal = false;

	// --- Handlers ---
	function openCreateDeal() {
		isCreatingDeal = true;
	}

	function handleSaveDeal(event: CustomEvent<Deal>) {
		const newDeal = event.detail;
		eventDealData.deals = [...eventDealData.deals, newDeal];
		console.log('Saving to DB:', { event_deal: eventDealData });
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
	<div class="flex flex-col h-full bg-navbar text-white">
		<div class="px-8 py-6 border-b-2 border-gray1 flex justify-between items-center shrink-0">
			<h2 class="text-2xl font-black uppercase tracking-wide text-white">Deals</h2>
			<div class="flex items-center gap-4">
				{#if canEditAndManage && !isCreatingDeal}
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

		<div class="p-8 overflow-y-auto">
			{#if isCreatingDeal && canEditAndManage}
				<DealCreator {venueSettings} on:save={handleSaveDeal} on:cancel={handleCancelDeal} />
			{:else}
				<div class="flex flex-col gap-8">
					<div class="rounded-2xl overflow-hidden bg-gray1">
						<div
							class="bg-black/30 px-8 py-5 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar"
						>
							Headliners
						</div>
						<div class="p-8">
							{#if eventDealData.deals.filter((d) => d.role === 'Headliner').length === 0}
								<p class="text-gray2 font-medium">
									To add an artist click the "Create Artist Deal" button in the top right.
								</p>
							{:else}
								{#each eventDealData.deals.filter((d) => d.role === 'Headliner') as deal}
									<div
										class="flex justify-between items-center mb-6 last:mb-0 border-b-2 border-navbar pb-6 last:border-0 last:pb-0"
									>
										<div>
											<p class="font-black text-xl text-white">{deal.artistName}</p>
											{#if canViewDetails}
												<p class="text-sm text-gray2 font-bold mt-1">{deal.dealType} Deal</p>
											{/if}
										</div>
										{#if canViewDetails}
											<div class="text-right">
												<p class="font-black text-xl text-white">${deal.guaranteeUsd} USD</p>
												{#if deal.exchangeData}
													<p class="text-sm font-bold text-lime mt-1">
														~ {deal.exchangeData.targetCurrency} ${(
															deal.guaranteeUsd * deal.exchangeData.rate
														).toFixed(2)}
													</p>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							{/if}
						</div>
						{#if canViewDetails}
							<div
								class="bg-black/30 px-8 py-5 border-t-2 border-navbar flex justify-end items-center gap-6"
							>
								<span class="text-gray2 font-bold uppercase tracking-wide text-sm"
									>Total Headliner Payout:</span
								>
								<span class="font-black text-2xl text-lime">USD $0.00</span>
							</div>
						{/if}
					</div>

					<div class="rounded-2xl overflow-hidden bg-gray1">
						<div
							class="bg-black/30 px-8 py-5 font-black uppercase tracking-wide text-gray3 border-b-2 border-navbar"
						>
							Support
						</div>
						<div class="p-8">
							{#if eventDealData.deals.filter((d) => d.role === 'Support').length === 0}
								<p class="text-gray2 font-medium">No support deals added yet.</p>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
