<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { DealDetailsInfo, DealTypeOption, DealBaseMetric } from '../../../../../types/tabs/deals';

	export let details: DealDetailsInfo;
	export let dealType: DealTypeOption;

	// Mocking venue currency for now as requested (to be fetched from calendar_settings)
	let venueCurrency = 'CAD';

	$: validMetrics = getMetricsForDealType(dealType);

	// FIXED: Explicitly return DealBaseMetric[] instead of string[]
	function getMetricsForDealType(type: DealTypeOption): DealBaseMetric[] {
		if (type === 'Versus') return ['% of Net', '% of Net Gross'];
		return ['% of Net', '% of Net Gross', 'Per Ticket', 'Flat'];
	}

	// Ensure the selected metric is valid when dealType changes
	$: if (!validMetrics.includes(details.metricType) && validMetrics.length > 0) {
		details.metricType = validMetrics[0];
	}

	$: afterOptions = getAfterOptions(details.metricType);

	// FIXED: Input correctly typed as DealBaseMetric
	function getAfterOptions(metric: DealBaseMetric): string[] {
		if (metric === '% of Net') return ['Costs', 'Manual Split Point'];
		if (metric === '% of Net Gross') return [];
		if (metric === 'Per Ticket') return ['% Sell Through', '# Tickets Sold'];
		if (metric === 'Flat') return ['% Sell Through', '# Tickets Sold', 'Manual Split Point'];
		return [];
	}

	// FIXED: Force cast to 'any' to satisfy TS since we are bridging multiple strict types
	$: if (afterOptions.length > 0 && !afterOptions.includes(details.afterType as string)) {
		details.afterType = afterOptions[0] as any;
	}

	function addBonus() {
		details.bonuses = [
			...details.bonuses,
			// FIXED: Force cast to 'any' to satisfy SwitchAtType
			{ id: crypto.randomUUID(), switchesAt: details.afterType as any, bonusAmount: 0, atAmount: 0 }
		];
	}

	function removeBonus(id: string) {
		details.bonuses = details.bonuses.filter(b => b.id !== id);
	}

	// Reset to 1 bonus row if we switch away from a 'Plus' deal
	$: if (dealType !== 'Plus' && details.bonuses.length > 1) {
		details.bonuses = [details.bonuses[0]];
	}
</script>

<div class="flex flex-col gap-8 text-white w-full">
	
	<div class="flex flex-col gap-5">
		<div class="font-bold text-xs text-gray2 uppercase tracking-wide">
			{dealType === 'Door Deal' ? 'Amount' : dealType === 'Plus' ? 'Bonus Amount' : 'Versus Amount'}
		</div>
		
		<div class="grid grid-cols-4 gap-4 items-center w-full">
			{#each validMetrics as metric}
				<label class="group flex items-center cursor-pointer relative -ml-2">
					<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
						<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {details.metricType === metric ? 'border-lime' : 'border-gray2 group-hover:border-gray-400'}">
							{#if details.metricType === metric}
								<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
							{/if}
						</div>
					</div>
					<input type="radio" bind:group={details.metricType} value={metric} class="hidden" />
					<span class="ml-1 font-bold {details.metricType === metric ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{metric}</span>
				</label>
				{#if validMetrics.length === 2}
					<div></div>
				{/if}
			{/each}
		</div>
		
		<div class="w-64 mt-2">
			<label for="metric-amount" class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide">
				{details.metricType.includes('%') ? 'Percentage amount' : 'Amount'}
			</label>
			<div class="relative">
				<input 
					id="metric-amount" 
					type="number" 
					bind:value={details.metricAmount} 
					class="w-full bg-navbar rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" 
				/>
				<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">
					{details.metricType.includes('%') ? '%' : details.metricType === 'Per Ticket' ? '' : '$'}
				</span>
			</div>
		</div>
	</div>

	{#if afterOptions.length > 0}
		<div class="h-px w-full bg-black rounded-full"></div>

		<div class="flex flex-col gap-5">
			<div class="font-bold text-white text-lg">After</div>
			<div class="flex gap-8 items-center">
				{#each afterOptions as afterOpt}
					<label class="group flex items-center cursor-pointer relative -ml-2">
						<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
							<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {String(details.afterType) === afterOpt ? 'border-lime' : 'border-gray2 group-hover:border-gray-400'}">
								{#if String(details.afterType) === afterOpt}
									<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
								{/if}
							</div>
						</div>
						<input type="radio" bind:group={details.afterType} value={afterOpt} class="hidden" />
						<span class="ml-1 font-bold {String(details.afterType) === afterOpt ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{afterOpt}</span>
					</label>
				{/each}
			</div>

			{#if details.metricType === '% of Net'}
				{#if String(details.afterType) === 'Costs'}
					<div transition:slide={{ duration: 300 }} class="text-sm text-gray2 font-bold mt-1">
						Calculated costs: {venueCurrency} 0.00
					</div>
				{:else if String(details.afterType) === 'Manual Split Point'}
					<div transition:slide={{ duration: 300 }} class="w-64 mt-2">
						<label for="split-point" class="block text-xs text-lime mb-2 font-bold uppercase tracking-wide">Split Point</label>
						<div class="relative">
							<input 
								id="split-point" 
								type="number" 
								bind:value={details.splitPointAmount} 
								class="w-full bg-navbar rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" 
							/>
							<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">$</span>
						</div>
					</div>
				{/if}

			{:else if details.metricType === 'Per Ticket' || details.metricType === 'Flat'}
				<div class="flex flex-col gap-4 mt-2">
					{#each details.bonuses as bonus, i (bonus.id)}
						<div class="flex gap-6 items-end" transition:slide={{ duration: 300 }}>
							<div class="flex-1 max-w-[200px]">
								<label for="bonus-amount-{bonus.id}" class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide">
									{dealType === 'Plus' ? 'Bonus amount' : 'Amount'}
								</label>
								<div class="relative">
									<input 
										id="bonus-amount-{bonus.id}" 
										type="number" 
										bind:value={bonus.bonusAmount} 
										class="w-full bg-navbar rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" 
									/>
									<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">
										{details.metricType === 'Flat' ? '$' : ''}
									</span>
								</div>
							</div>
							
							<div class="font-bold text-lg mb-2.5 text-gray2">At</div>
							
							<div class="flex-1 max-w-[200px]">
								<label for="bonus-at-{bonus.id}" class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide">
									{String(details.afterType) === '% Sell Through' ? 'Percent Sold' : String(details.afterType) === '# Tickets Sold' ? 'Tickets Sold' : 'Split Point'}
								</label>
								<div class="relative">
									<input 
										id="bonus-at-{bonus.id}" 
										type="number" 
										bind:value={bonus.atAmount} 
										class="w-full bg-navbar rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" 
									/>
									<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">
										{String(details.afterType) === '% Sell Through' ? '%' : String(details.afterType) === 'Manual Split Point' ? '$' : ''}
									</span>
								</div>
							</div>

							{#if dealType === 'Plus' && details.bonuses.length > 1}
								<button on:click={() => removeBonus(bonus.id)} class="text-gray2 hover:text-red-500 text-sm font-bold transition-colors mb-3">✕ Remove</button>
							{/if}
						</div>
					{/each}

					{#if dealType === 'Plus'}
						<button on:click={addBonus} class="flex items-center gap-2 text-lime font-bold hover:opacity-80 transition-opacity w-max mt-2">
							<span class="text-2xl bg-lime text-black rounded-full w-6 h-6 flex items-center justify-center pb-0.5">+</span> Add Bonuses
						</button>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	<div class="h-px w-full bg-black rounded-full"></div>

	<div class="flex flex-col gap-4">
		<label class="flex items-center gap-3 cursor-pointer w-max">
			<div class="relative inline-block w-12 h-6">
				<input type="checkbox" bind:checked={details.capEnabled} class="peer sr-only">
				<div class="w-12 h-6 bg-black border border-gray2 rounded-full peer-checked:bg-lime peer-checked:border-lime transition-colors"></div>
				<div class="absolute left-1 top-1 bg-gray2 peer-checked:bg-black w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 shadow-sm"></div>
			</div>
			<span class="font-bold text-lg text-white">Cap</span>
		</label>

		{#if details.capEnabled}
			<div transition:slide={{ duration: 300 }} class="ml-6 w-64 mt-2">
				<label for="cap-amount" class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide">Cap amount</label>
				<div class="relative">
					<input 
						id="cap-amount" 
						type="number" 
						bind:value={details.capAmount} 
						class="w-full bg-navbar rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime" 
					/>
					<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">$</span>
				</div>
			</div>
		{/if}
	</div>
</div>