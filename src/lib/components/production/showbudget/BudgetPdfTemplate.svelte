<script lang="ts">
	import { formatMoney } from '$lib/utils/budgetUtils';

	export let budgetData: any;
	export let event: any;

	const safeNum = (val: any) => Number(val) || 0;
	
	// Variables
	$: budgetType = budgetData?.budget_type || 'Tour Prod';

	// Income
	$: incomeTotalBudget = safeNum(budgetData?.income_total_budget);
	$: incomeArtist = safeNum(budgetData?.income_artist);
	$: incomeTechnical = safeNum(budgetData?.income_technical);
	$: incomeHospitality = safeNum(budgetData?.income_hospitality);
	$: incomeOther = safeNum(budgetData?.income_other);

	// Total Income Calc
	$: totalIncome = (() => {
		if (budgetType === 'Internal Prod') return incomeTotalBudget;
		if (budgetType === 'Tour Prod') return incomeTechnical + incomeHospitality + incomeOther;
		return incomeArtist + incomeTechnical + incomeHospitality + incomeOther;
	})();

	// Expenses
	const calcSimple = (items: any[]) =>
		(items || []).reduce((acc, item) => acc + (safeNum(item.price) * (safeNum(item.quantity) || 1)), 0);
	const calcComplex = (subsections: any[]) =>
		(subsections || []).reduce((acc, sub) => acc + calcSimple(sub.items), 0);

	$: totalArtistFee = calcSimple(budgetData?.artist_fee);
	$: totalTechnical = calcComplex(budgetData?.technical);
	$: totalHospitality = calcComplex(budgetData?.hospitality);
	$: totalOther = calcComplex(budgetData?.other_expenses);

	// Total Expense Calc
	$: totalExpenses = (() => {
		const base = totalTechnical + totalHospitality + totalOther;
		if (budgetType === 'Complete Prod') return base + totalArtistFee;
		return base;
	})();
	
	$: netTotal = totalIncome - totalExpenses;
</script>

<div
	id="budget-pdf-root"
	class="bg-gray1 text-white font-helvetica p-8"
	style="width: 8.5in; min-height: 11in;"
>
	<div class="border-b-2 border-lime pb-4 mb-8">
		<h1 class="text-4xl font-bold uppercase tracking-wider text-confirmed mb-2">
			{event?.event_name || 'Event Name'}
		</h1>
		<div class="flex justify-between text-gray2 text-sm uppercase tracking-wide font-bold">
			<span>{budgetType} Budget</span>
			<span>{event?.event_date || ''}</span>
		</div>
	</div>

	<div class="mb-8">
		<h2 class="text-xl font-bold text-white mb-4 uppercase border-b border-gray2/20 pb-2">
			Income (+)
		</h2>
		
		{#if budgetType === 'Internal Prod'}
			<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
				<span class="text-gray2 text-xs uppercase block mb-1">Total Budget</span>
				<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeTotalBudget)}</span>
			</div>
		{:else}
			<div class="grid grid-cols-2 gap-4">
				{#if budgetType === 'Complete Prod'}
					<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
						<span class="text-gray2 text-xs uppercase block mb-1">Artist Fee</span>
						<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeArtist)}</span>
					</div>
				{/if}
				<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
					<span class="text-gray2 text-xs uppercase block mb-1">Technical</span>
					<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeTechnical)}</span>
				</div>
				<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
					<span class="text-gray2 text-xs uppercase block mb-1">Hospitality</span>
					<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeHospitality)}</span>
				</div>
				<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
					<span class="text-gray2 text-xs uppercase block mb-1">Other</span>
					<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeOther)}</span>
				</div>
			</div>
		{/if}
	</div>

	<div class="space-y-8 mb-8">
		<h2 class="text-xl font-bold text-white mb-4 uppercase border-b border-gray2/20 pb-2">
			Expenses (-)
		</h2>

		{#if budgetType === 'Complete Prod' && budgetData?.artist_fee?.length > 0}
			<div>
				<h3 class="text-confirmed font-bold text-sm uppercase mb-3">Artist Fee</h3>
				<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
					{#each budgetData.artist_fee as item}
						<div class="flex justify-between items-center py-2 border-b border-gray2/10 last:border-0 text-sm">
							<span class="text-white">{item.name || 'Item'}</span>
							<div class="flex items-center gap-4">
								{#if item.quantity > 1}
									<span class="text-gray2 text-xs">x{item.quantity}</span>
								{/if}
								<span class="font-mono text-white">
									{formatMoney(safeNum(item.price) * (safeNum(item.quantity) || 1))}
								</span>
							</div>
						</div>
					{/each}
					<div class="flex justify-between items-center pt-3 mt-2 border-t border-gray2/20 font-bold">
						<span class="text-gray2 text-xs uppercase">Subtotal</span>
						<span class="text-problem font-mono">{formatMoney(totalArtistFee * -1)}</span>
					</div>
				</div>
			</div>
		{/if}

		{#if budgetData?.technical?.length > 0}
			<div>
				<h3 class="text-confirmed font-bold text-sm uppercase mb-3">Technical</h3>
				<div class="space-y-4">
					{#each budgetData.technical as sub}
						<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
							<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1">
								{sub.name}
							</div>
							{#each sub.items || [] as item}
								<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
									<span class="text-white">{item.name}</span>
									<div class="flex items-center gap-4">
										{#if item.quantity > 1}
											<span class="text-gray2 text-xs">x{item.quantity}</span>
										{/if}
										<span class="font-mono text-white">
											{formatMoney(safeNum(item.price) * (safeNum(item.quantity) || 1))}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if budgetData?.hospitality?.length > 0}
			<div>
				<h3 class="text-confirmed font-bold text-sm uppercase mb-3">Hospitality</h3>
				<div class="space-y-4">
					{#each budgetData.hospitality as sub}
						<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
							<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1">
								{sub.name}
							</div>
							{#each sub.items || [] as item}
								<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
									<span class="text-white">{item.name}</span>
									<div class="flex items-center gap-4">
										{#if item.quantity > 1}
											<span class="text-gray2 text-xs">x{item.quantity}</span>
										{/if}
										<span class="font-mono text-white">
											{formatMoney(safeNum(item.price) * (safeNum(item.quantity) || 1))}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if budgetData?.other_expenses?.length > 0}
			<div>
				<h3 class="text-confirmed font-bold text-sm uppercase mb-3">Other Expenses</h3>
				<div class="space-y-4">
					{#each budgetData.other_expenses as sub}
						<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
							<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1">
								{sub.name}
							</div>
							{#each sub.items || [] as item}
								<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
									<span class="text-white">{item.name}</span>
									<div class="flex items-center gap-4">
										{#if item.quantity > 1}
											<span class="text-gray2 text-xs">x{item.quantity}</span>
										{/if}
										<span class="font-mono text-white">
											{formatMoney(safeNum(item.price) * (safeNum(item.quantity) || 1))}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<div class="mt-8 pt-6 border-t-2 border-gray2/30 break-inside-avoid">
		<h2 class="text-xl font-bold text-white mb-4 uppercase">Summary</h2>
		<div class="bg-gray2/10 rounded-lg p-6 border border-gray2/20 space-y-3">
			<div class="flex justify-between items-center text-sm">
				<span class="text-gray2 uppercase tracking-wider">Total Budget</span>
				<span class="font-bold text-confirmed text-lg font-mono">{formatMoney(totalIncome)}</span>
			</div>
			<div class="flex justify-between items-center text-sm">
				<span class="text-gray2 uppercase tracking-wider">Total Expenses</span>
				<span class="font-bold text-problem text-lg font-mono">{formatMoney(totalExpenses * -1)}</span>
			</div>
			<div class="border-t border-gray2/20 my-2"></div>
			<div class="flex justify-between items-center text-xl">
				<span class="font-bold text-white uppercase tracking-wider">Net Profit</span>
				<span class="font-bold font-mono {netTotal >= 0 ? 'text-confirmed' : 'text-problem'}">
					{formatMoney(netTotal)}
				</span>
			</div>
		</div>
	</div>
</div>

<style>
	/* Print specific overrides */
	@media print {
		@page {
			size: 8.5in 11in;
			margin: 0;
		}
		* {
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
	}
	:global(#budget-pdf-root .bg-gray1) {
		background-color: #1c1c1e !important;
	}
	:global(#budget-pdf-root .text-white) {
		color: #ffffff !important;
	}
</style>