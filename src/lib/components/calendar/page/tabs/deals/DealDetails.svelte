<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { DealDetailsInfo, DealTypeOption, DealBaseMetric } from '../../../../../types/tabs/deals';

	export let details: DealDetailsInfo;
	export let dealType: DealTypeOption;

	$: validMetrics = getMetricsForDealType(dealType);

	function getMetricsForDealType(type: DealTypeOption): DealBaseMetric[] {
		if (type === 'Versus') return ['% of Net', '% of Net Gross'];
		return ['% of Net', '% of Net Gross', 'Per Ticket', 'Flat'];
	}

	// Ensure the selected metric is valid when dealType changes
	$: if (!validMetrics.includes(details.metricType) && validMetrics.length > 0) {
		details.metricType = validMetrics[0];
	}

	function addBonus() {
		details.bonuses = [
			...details.bonuses,
			{ id: crypto.randomUUID(), switchesAt: '% Sell Through', bonusAmount: 0, atAmount: 0 }
		];
	}

	function removeBonus(id: string) {
		details.bonuses = details.bonuses.filter(b => b.id !== id);
	}
</script>

<div class="flex flex-col gap-8 text-white w-full">
	
	<div class="flex flex-col gap-5">
		<div class="font-bold text-xs text-gray2 uppercase tracking-wide">
			{dealType === 'Door Deal' ? 'Amount' : dealType === 'Plus' ? 'Bonus Amount' : 'Versus Amount'}
		</div>
		
		<div class="flex flex-wrap gap-x-8 gap-y-4 items-center">
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
			{/each}
		</div>
		
		<div class="w-64 mt-2">
			<label for="metric-amount" class="block text-xs text-gray2 mb-2 font-bold">
				{details.metricType.includes('%') ? 'Percentage amount' : 'Amount'}
			</label>
			<div class="relative">
				<input id="metric-amount" type="number" bind:value={details.metricAmount} class="w-full bg-black rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime" />
				<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{details.metricType.includes('%') ? '%' : '$'}</span>
			</div>
		</div>
	</div>

	<div class="h-px w-full bg-black rounded-full"></div>

	<div class="flex flex-col gap-5">
		<div class="font-bold text-white text-lg">After</div>
		<div class="flex gap-8 items-center">
			{#each ['Costs', 'Manual Split Point'] as afterOpt}
				<label class="group flex items-center cursor-pointer relative -ml-2">
					<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
						<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {details.afterType === afterOpt ? 'border-lime' : 'border-gray2 group-hover:border-gray-400'}">
							{#if details.afterType === afterOpt}
								<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
							{/if}
						</div>
					</div>
					<input type="radio" bind:group={details.afterType} value={afterOpt} class="hidden" />
					<span class="ml-1 font-bold {details.afterType === afterOpt ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{afterOpt}</span>
				</label>
			{/each}
		</div>

		{#if details.afterType === 'Manual Split Point'}
			<div transition:slide={{ duration: 300 }} class="w-64 mt-2">
				<label for="split-point" class="block text-xs text-[#8261E6] mb-2 font-bold">Split Point</label>
				<div class="relative">
					<input id="split-point" type="number" bind:value={details.splitPointAmount} class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-[#8261E6]" />
				</div>
			</div>
		{/if}
	</div>

	<div class="h-px w-full bg-black rounded-full"></div>

	<div class="flex flex-col gap-6">
		<label class="flex items-center gap-3 cursor-pointer w-max">
			<div class="relative inline-block w-12 h-6">
				<input type="checkbox" bind:checked={details.retroactiveBonusEnabled} class="peer sr-only">
				<div class="w-12 h-6 bg-black border border-gray2 rounded-full peer-checked:bg-lime peer-checked:border-lime transition-colors"></div>
				<div class="absolute left-1 top-1 bg-gray2 peer-checked:bg-black w-4 h-4 rounded-full transition-transform peer-checked:translate-x-6 shadow-sm"></div>
			</div>
			<span class="font-bold text-lg text-white">Retroactive Bonus</span>
		</label>

		{#if details.retroactiveBonusEnabled}
			{#each details.bonuses as bonus, i (bonus.id)}
				<div class="ml-6 flex flex-col gap-5 {i > 0 ? 'pt-6 border-t border-black' : ''}" transition:slide={{ duration: 300 }}>
					<div class="flex justify-between items-center">
						<div class="font-bold text-xs text-gray2 uppercase tracking-wide">Switches At</div>
						{#if i > 0}
							<button on:click={() => removeBonus(bonus.id)} class="text-gray2 hover:text-red-500 text-sm font-bold transition-colors">✕ Remove</button>
						{/if}
					</div>
					
					<div class="flex gap-8 items-center -mt-2">
						{#each ['% Sell Through', '# Tickets Sold'] as switchOpt}
							<label class="group flex items-center cursor-pointer relative -ml-2">
								<div class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200">
									<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {bonus.switchesAt === switchOpt ? 'border-lime' : 'border-gray2 group-hover:border-gray-400'}">
										{#if bonus.switchesAt === switchOpt}
											<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
										{/if}
									</div>
								</div>
								<input type="radio" bind:group={bonus.switchesAt} value={switchOpt} class="hidden" />
								<span class="ml-1 font-bold {bonus.switchesAt === switchOpt ? 'text-white' : 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200">{switchOpt}</span>
							</label>
						{/each}
					</div>

					<div class="flex gap-6 items-end">
						<div class="flex-1 max-w-[200px]">
							<label for="bonus-amount-{bonus.id}" class="block text-xs text-gray2 mb-2 font-bold">Bonus amount*</label>
							<div class="relative">
								<input id="bonus-amount-{bonus.id}" type="number" bind:value={bonus.bonusAmount} class="w-full bg-black rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime" />
								<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">%</span>
							</div>
						</div>
						
						<div class="font-bold text-lg mb-3 text-gray2">At</div>
						
						<div class="flex-1 max-w-[200px]">
							<label for="bonus-at-{bonus.id}" class="block text-xs text-gray2 mb-2 font-bold">{bonus.switchesAt === '% Sell Through' ? 'Percent Sold*' : 'Tickets Sold*'}</label>
							<div class="relative">
								<input id="bonus-at-{bonus.id}" type="number" bind:value={bonus.atAmount} class="w-full bg-black rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime" />
								<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{bonus.switchesAt === '% Sell Through' ? '%' : ''}</span>
							</div>
						</div>
					</div>
				</div>
			{/each}

			<button on:click={addBonus} class="ml-6 flex items-center gap-2 text-lime font-bold hover:opacity-80 transition-opacity w-max mt-2">
				<span class="text-2xl bg-lime text-black rounded-full w-6 h-6 flex items-center justify-center pb-0.5">+</span> Additional Retroactive Bonus
			</button>
		{/if}
	</div>

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
				<label for="cap-amount" class="block text-xs text-gray2 mb-2 font-bold">Cap amount</label>
				<input id="cap-amount" type="number" bind:value={details.capAmount} class="w-full bg-black rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-1 focus:ring-lime" />
			</div>
		{/if}
	</div>
</div>