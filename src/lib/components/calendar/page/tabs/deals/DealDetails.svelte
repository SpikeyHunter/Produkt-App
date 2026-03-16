<script lang="ts">
	import { slide } from 'svelte/transition';
	import type {
		DealDetailsInfo,
		DealTypeOption,
		DealBaseMetric
	} from '../../../../../types/tabs/deals';

	export let details: DealDetailsInfo;
	export let dealType: DealTypeOption;
	export let eventCost: any = null;
	export let venueCurrency: string = 'CAD';

	// --- BULLETPROOF DATA PARSING WITH LOGS ---
	$: totalCost = (() => {

		try {
			if (!eventCost) {
				return 0;
			}

			let parsed = typeof eventCost === 'string' ? JSON.parse(eventCost) : eventCost;

			// Catch double-stringified JSONB from the database
			if (typeof parsed === 'string') {
				parsed = JSON.parse(parsed);
			}

			const extractedArray = parsed?.total_cost;

			const finalValue = extractedArray?.[0] || 0;
			
			return finalValue;
		} catch (e) {

			return 0;
		}
	})();

	$: validMetrics = getMetricsForDealType(dealType);

	function getMetricsForDealType(type: DealTypeOption): DealBaseMetric[] {
		if (type === 'Versus') return ['% of Net', '% of Net Gross'];
		return ['% of Net', '% of Net Gross', 'Per Ticket', 'Flat'];
	}

	$: if (!validMetrics.includes(details.metricType) && validMetrics.length > 0) {
		details.metricType = validMetrics[0];
	}

	$: afterOptions = getAfterOptions(details.metricType);

	function getAfterOptions(metric: DealBaseMetric): string[] {
		if (metric === '% of Net') return ['Costs', 'Manual Split Point'];
		if (metric === '% of Net Gross') return [];
		if (metric === 'Per Ticket') return ['% Sell Through', '# Tickets Sold'];
		if (metric === 'Flat') return ['% Sell Through', '# Tickets Sold', 'Manual Split Point'];
		return [];
	}

	$: if (afterOptions.length > 0 && !afterOptions.includes(details.afterType as string)) {
		details.afterType = afterOptions[0] as any;
	}

	function addBonus() {
		details.bonuses = [
			...details.bonuses,
			{ id: crypto.randomUUID(), switchesAt: details.afterType as any, bonusAmount: 0, atAmount: 0 }
		];
	}

	function removeBonus(id: string) {
		details.bonuses = details.bonuses.filter((b) => b.id !== id);
	}

	$: if (dealType !== 'Plus' && details.bonuses.length > 1) {
		details.bonuses = [details.bonuses[0]];
	}
</script>

<style>
	:global(input[type='number']::-webkit-outer-spin-button),
	:global(input[type='number']::-webkit-inner-spin-button) {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	:global(input[type='number']) {
		-moz-appearance: textfield;
		appearance: textfield;
	}
</style>

<div class="flex flex-col gap-8 text-white w-full">
	<div class="flex flex-col gap-5">
		<div class="font-bold text-md text-white uppercase tracking-wide">
			{dealType === 'Door Deal' ? 'Amount' : dealType === 'Plus' ? 'Bonus Amount' : 'Versus Amount'}
		</div>

		<div class="grid grid-cols-4 gap-4 items-center w-full">
			{#each validMetrics as metric}
				<label class="group flex items-center cursor-pointer relative -ml-2">
					<div
						class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200"
					>
						<div
							class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {details.metricType ===
							metric
								? 'border-lime'
								: 'border-gray2 group-hover:border-gray-400'}"
						>
							{#if details.metricType === metric}
								<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
							{/if}
						</div>
					</div>
					<input type="radio" bind:group={details.metricType} value={metric} class="hidden" />
					<span
						class="ml-1 font-bold {details.metricType === metric
							? 'text-white'
							: 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200"
						>{metric}</span
					>
				</label>
				{#if validMetrics.length === 2}
					<div></div>
				{/if}
			{/each}
		</div>

		<div class="w-50 mt-2">
			<label
				for="metric-amount"
				class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
			>
				{details.metricType.includes('%') ? 'Percentage amount' : 'Amount'}
			</label>
			<div class="relative">
				<input
					id="metric-amount"
					type="number"
					bind:value={details.metricAmount}
					on:focus={(e) => {
						if (e.currentTarget.value === '0') e.currentTarget.value = '';
					}}
					on:blur={() => (details.metricAmount = details.metricAmount || 0)}
					class="w-full bg-gray1 rounded-3xl pl-5 pr-10 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime"
				/>
				<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">
					{details.metricType.includes('%') ? '%' : '$'}
				</span>
			</div>
		</div>
	</div>

	{#if afterOptions.length > 0}
	

		<div class="flex flex-col gap-5">
			<div class="font-bold text-white text-md uppercase">After</div>
			<div class="flex gap-8 items-center">
				{#each afterOptions as afterOpt}
					<label class="group flex items-center cursor-pointer relative -ml-2">
						<div
							class="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-white/5 transition-colors duration-200"
						>
							<div
								class="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors duration-200 {String(
									details.afterType
								) === afterOpt
									? 'border-lime'
									: 'border-gray2 group-hover:border-gray-400'}"
							>
								{#if String(details.afterType) === afterOpt}
									<div class="w-2.5 h-2.5 bg-lime rounded-full"></div>
								{/if}
							</div>
						</div>
						<input type="radio" bind:group={details.afterType} value={afterOpt} class="hidden" />
						<span
							class="ml-1 font-bold {String(details.afterType) === afterOpt
								? 'text-white'
								: 'text-gray2 group-hover:text-gray-300'} transition-colors duration-200"
							>{afterOpt}</span
						>
					</label>
				{/each}
			</div>

			{#if details.metricType === '% of Net'}
				<div class="grid items-start" style="grid-template-areas: 'stack';">
					{#if String(details.afterType) === 'Costs'}
						<div
							transition:slide={{ duration: 300 }}
							class="text-sm text-gray2 font-bold mt-1"
							style="grid-area: stack;"
						>
							Calculated costs: {venueCurrency}${totalCost.toLocaleString('en-US', {
								minimumFractionDigits: 2,
								maximumFractionDigits: 2
							})}
						</div>
					{:else if String(details.afterType) === 'Manual Split Point'}
						<div transition:slide={{ duration: 300 }} class="w-64 mt-2" style="grid-area: stack;">
							<label
								for="split-point"
								class="block text-xs text-lime mb-2 font-bold uppercase tracking-wide"
								>Split Point</label
							>
							<div class="relative">
								<input
									id="split-point"
									type="number"
									bind:value={details.splitPointAmount}
									on:focus={(e) => {
										if (e.currentTarget.value === '0') e.currentTarget.value = '';
									}}
									on:blur={() => (details.splitPointAmount = details.splitPointAmount || 0)}
									class="w-full bg-gray1 rounded-3xl pl-[72px] pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime"
								/>
								<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold"
									>{venueCurrency}$</span
								>
							</div>
						</div>
					{/if}
				</div>
			{:else if details.metricType === 'Per Ticket' || details.metricType === 'Flat'}
			<div class="flex flex-col gap-4 mt-2">
				{#each details.bonuses as bonus, i (bonus.id)}
					<div transition:slide={{ duration: 300 }}>
						{#if dealType === 'Plus'}
							{#if i === 0}
								<div class="flex-1 max-w-[200px]">
									<label
										for="bonus-at-{bonus.id}"
										class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
									>
										{String(details.afterType) === '% Sell Through'
											? '% percent sold'
											: String(details.afterType) === '# Tickets Sold'
												? '# of tickets'
												: 'Split Point'}
									</label>
									<div class="relative">
										<input
											id="bonus-at-{bonus.id}"
											type="number"
											bind:value={bonus.atAmount}
											on:focus={(e) => {
												if (e.currentTarget.value === '0') e.currentTarget.value = '';
											}}
											on:blur={() => (bonus.atAmount = bonus.atAmount || 0)}
											class="w-full bg-gray1 rounded-3xl py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime {String(
												details.afterType
											) === 'Manual Split Point'
												? 'pl-[72px] pr-4'
												: 'pl-5 pr-10'}"
										/>
										{#if String(details.afterType) === '% Sell Through'}
											<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">%</span>
										{:else if String(details.afterType) === 'Manual Split Point'}
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{venueCurrency}$</span>
										{/if}
									</div>
								</div>
							{:else}
								<div class="flex gap-4 items-end mt-2">
									<div class="flex-1 max-w-[200px]">
										<label
											for="bonus-amount-{bonus.id}"
											class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
										>
											Bonus amount
										</label>
										<div class="relative">
											<input
												id="bonus-amount-{bonus.id}"
												type="number"
												bind:value={bonus.bonusAmount}
												on:focus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.value = '';
												}}
												on:blur={() => (bonus.bonusAmount = bonus.bonusAmount || 0)}
												class="w-full bg-gray1 rounded-3xl pl-8 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime"
											/>
											<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">$</span>
										</div>
									</div>

									<div class="font-bold text-lg mb-2 text-gray2">at</div>

									<div class="flex-1 max-w-[200px]">
										<label
											for="bonus-at-{bonus.id}"
											class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
										>
											{String(details.afterType) === '% Sell Through'
												? '% percent sold'
												: String(details.afterType) === '# Tickets Sold'
													? '# of tickets'
													: 'Split Point'}
										</label>
										<div class="relative">
											<input
												id="bonus-at-{bonus.id}"
												type="number"
												bind:value={bonus.atAmount}
												on:focus={(e) => {
													if (e.currentTarget.value === '0') e.currentTarget.value = '';
												}}
												on:blur={() => (bonus.atAmount = bonus.atAmount || 0)}
												class="w-full bg-gray1 rounded-3xl py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime {String(
													details.afterType
												) === 'Manual Split Point'
													? 'pl-[72px] pr-4'
													: 'pl-5 pr-10'}"
											/>
											{#if String(details.afterType) === '% Sell Through'}
												<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">%</span>
											{:else if String(details.afterType) === 'Manual Split Point'}
												<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{venueCurrency}$</span>
											{/if}
										</div>
									</div>
									<div class="mb-1">
									<button
										on:click={() => removeBonus(bonus.id)}
										class="w-8 h-8 flex items-center justify-center cursor-pointer rounded-full text-red-500 bg-problem/10 hover:bg-problem/20 transition-colors mb-1 font-bold"
										title="Remove Bonus"
									>
										✕
									</button>
								</div>	
								</div>
							{/if}
						{:else}
							<div class="flex-1 max-w-[200px]">
								<label
									for="bonus-at-{bonus.id}"
									class="block text-xs text-gray2 mb-2 font-bold uppercase tracking-wide"
								>
									{String(details.afterType) === '% Sell Through'
										? '% percent sold'
										: String(details.afterType) === '# Tickets Sold'
											? '# of tickets'
											: 'Split Point'}
								</label>
								<div class="relative">
									<input
										id="bonus-at-{bonus.id}"
										type="number"
										bind:value={bonus.atAmount}
										on:focus={(e) => {
											if (e.currentTarget.value === '0') e.currentTarget.value = '';
										}}
										on:blur={() => (bonus.atAmount = bonus.atAmount || 0)}
										class="w-full bg-gray1 rounded-3xl py-2 text-white focus:outline-none focus:ring-2 focus:ring-lime {String(
											details.afterType
										) === 'Manual Split Point'
											? 'pl-[72px] pr-4'
											: 'pl-5 pr-10'}"
									/>
									{#if String(details.afterType) === '% Sell Through'}
										<span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">%</span>
									{:else if String(details.afterType) === 'Manual Split Point'}
										<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">{venueCurrency}$</span>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/each}

				{#if dealType === 'Plus'}
					<button
						on:click={addBonus}
						class="flex items-center gap-2 text-lime font-bold hover:opacity-80 transition-opacity w-max mt-2"
					>
						<span
							class="text-2xl bg-lime text-black rounded-full w-6 h-6 flex items-center justify-center pb-0.5"
						>+</span> Add Bonuses
					</button>
				{/if}
			</div>
			{/if}
		</div>
	{/if}
</div>