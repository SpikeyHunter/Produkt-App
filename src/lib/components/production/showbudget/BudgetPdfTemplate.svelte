<script lang="ts">
	import {
		formatMoney,
		itemBudgetedTotal,
		itemActualTotal,
		itemsBudgetedTotal,
		itemsActualTotal,
		subsBudgetedTotal,
		subsActualTotal
	} from '$lib/utils/budgetUtils';
	import type { ExportOptions, BudgetItem, BudgetSubsection } from '$lib/types/budget';

	export let budgetData: any;
	export let event: any;
	export let options: ExportOptions = {
		amounts: 'both',
		sections: { artist_fee: true, technical: true, hospitality: true, other_expenses: true },
		includeIncome: true
	};

	const safeNum = (val: any) => Number(val) || 0;

	$: budgetType = budgetData?.budget_type || 'Tour Prod';

	$: showBudgeted = options.amounts === 'both' || options.amounts === 'budgeted';
	$: showActual = options.amounts === 'both' || options.amounts === 'actual';

	// Income
	$: incomeTotalBudget = safeNum(budgetData?.income_total_budget);
	$: incomeArtist = safeNum(budgetData?.income_artist);
	$: incomeTechnical = safeNum(budgetData?.income_technical);
	$: incomeHospitality = safeNum(budgetData?.income_hospitality);
	$: incomeOther = safeNum(budgetData?.income_other);

	$: totalIncome = (() => {
		if (budgetType === 'Internal Prod') return incomeTotalBudget;
		if (budgetType === 'Tour Prod') return incomeTechnical + incomeHospitality + incomeOther;
		return incomeArtist + incomeTechnical + incomeHospitality + incomeOther;
	})();

	// Visible data only (hidden rows/sections never make it to the PDF)
	const visibleItems = (items: BudgetItem[] | undefined): BudgetItem[] =>
		(items || []).filter((i) => !i.hidden);
	const visibleSubs = (subs: BudgetSubsection[] | undefined): BudgetSubsection[] =>
		(subs || [])
			.filter((s) => !s.hidden)
			.map((s) => ({ ...s, items: visibleItems(s.items) }))
			.filter((s) => s.items.length > 0);

	$: pdfArtistFee = options.sections.artist_fee ? visibleItems(budgetData?.artist_fee) : [];
	$: pdfTechnical = options.sections.technical ? visibleSubs(budgetData?.technical) : [];
	$: pdfHospitality = options.sections.hospitality ? visibleSubs(budgetData?.hospitality) : [];
	$: pdfOther = options.sections.other_expenses ? visibleSubs(budgetData?.other_expenses) : [];

	// Section totals (based on what's actually printed)
	$: totalArtistFee = itemsBudgetedTotal(pdfArtistFee);
	$: totalTechnical = subsBudgetedTotal(pdfTechnical);
	$: totalHospitality = subsBudgetedTotal(pdfHospitality);
	$: totalOther = subsBudgetedTotal(pdfOther);

	$: actArtistFee = itemsActualTotal(pdfArtistFee);
	$: actTechnical = subsActualTotal(pdfTechnical);
	$: actHospitality = subsActualTotal(pdfHospitality);
	$: actOther = subsActualTotal(pdfOther);

	$: totalExpenses = (() => {
		const base = totalTechnical + totalHospitality + totalOther;
		if (budgetType === 'Complete Prod') return base + totalArtistFee;
		return base;
	})();

	$: totalActualExpenses = (() => {
		const base = actTechnical + actHospitality + actOther;
		if (budgetType === 'Complete Prod') return base + actArtistFee;
		return base;
	})();

	$: netTotal = totalIncome - totalExpenses;
	$: actualNetTotal = totalIncome - totalActualExpenses;

	function sectionHeaderTotal(budgeted: number, actual: number): string {
		if (options.amounts === 'budgeted') return formatMoney(budgeted);
		if (options.amounts === 'actual') return formatMoney(actual);
		return `${formatMoney(budgeted)} / act. ${formatMoney(actual)}`;
	}
</script>

<div
	id="budget-pdf-root"
	class="bg-gray1 text-white font-helvetica p-8"
	style="width: 8.5in; min-height: 11in;"
>
	<div class="border-b-2 border-lime pb-4 mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-4xl font-bold uppercase tracking-wider text-lime mb-2">
				{event?.event_name || 'Event Name'}
			</h1>
			<h2 class="text-lg font-bold uppercase tracking-wider text-gray3 mb-1">
				{event?.event_date || ''}
			</h2>
			<div class="flex gap-4 text-gray2 text-sm uppercase tracking-wide font-bold">
				<span>{budgetType} Budget</span>
				{#if options.amounts === 'budgeted'}
					<span>· Budgeted amounts</span>
				{:else if options.amounts === 'actual'}
					<span>· Actual amounts</span>
				{/if}
			</div>
		</div>
		<img
			src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png"
			alt="Produkt Logo"
			class="h-16 w-auto object-contain"
		/>
	</div>

	{#if options.includeIncome}
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
	{/if}

	<div class="space-y-8 mb-8">
		<h2 class="text-xl font-bold text-white mb-4 uppercase border-b border-gray2/20 pb-2">
			Expenses (-)
		</h2>

		<!-- Column legend for "both" mode -->
		{#if options.amounts === 'both'}
			<div class="flex justify-end gap-8 text-[10px] uppercase tracking-wider text-gray2 -mt-4">
				<span class="w-24 text-right">Budgeted</span>
				<span class="w-24 text-right">Actual</span>
			</div>
		{/if}

		{#if budgetType === 'Complete Prod' && pdfArtistFee.length > 0}
			<div>
				<h3 class="text-lime font-bold text-sm uppercase mb-3">
					Artist Fee - {sectionHeaderTotal(totalArtistFee, actArtistFee)}
				</h3>
				<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
					{#each pdfArtistFee as item}
						<div class="flex justify-between items-center py-2 border-b border-gray2/10 last:border-0 text-sm {item.flagged ? 'text-problem' : ''}">
							<span class="{item.flagged ? 'text-problem' : 'text-white'}">
								{safeNum(item.quantity) || 1}x {item.name || 'Item'}{item.flagged ? ' *' : ''}
							</span>
							<span class="flex gap-8">
								{#if showBudgeted}
									<span class="font-mono w-24 text-right {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
								{/if}
								{#if showActual}
									<span class="font-mono w-24 text-right text-confirmed">{formatMoney(itemActualTotal(item))}</span>
								{/if}
							</span>
						</div>
					{/each}
					<div class="text-right mt-2 pt-2 text-sm font-bold uppercase text-gray2">
						Subtotal: <span class="text-problem font-mono">{sectionHeaderTotal(totalArtistFee, actArtistFee)}</span>
					</div>
				</div>
			</div>
		{/if}

		{#each [{ key: 'technical', label: 'Technical', subs: pdfTechnical, budg: totalTechnical, act: actTechnical }, { key: 'hospitality', label: 'Hospitality', subs: pdfHospitality, budg: totalHospitality, act: actHospitality }, { key: 'other', label: 'Other Expenses', subs: pdfOther, budg: totalOther, act: actOther }] as cat}
			{#if cat.subs.length > 0}
				<div>
					<h3 class="text-lime font-bold text-sm uppercase mb-3">
						{cat.label} - {sectionHeaderTotal(cat.budg, cat.act)}
					</h3>
					<div class="space-y-4">
						{#each cat.subs as sub}
							<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
								<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1">
									{sub.name}
								</div>
								{#each sub.items as item}
									<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
										<span class="{item.flagged ? 'text-problem' : 'text-white'}">
											{safeNum(item.quantity) || 1}x {item.name}{item.flagged ? ' *' : ''}
										</span>
										<span class="flex gap-8">
											{#if showBudgeted}
												<span class="font-mono w-24 text-right {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
											{/if}
											{#if showActual}
												<span class="font-mono w-24 text-right text-confirmed">{formatMoney(itemActualTotal(item))}</span>
											{/if}
										</span>
									</div>
									{#each item.children || [] as child}
										<div class="flex justify-between items-center py-1 pl-6 text-xs text-gray2">
											<span class="{child.flagged ? 'text-problem' : 'text-gray2'}">
												└ {safeNum(child.quantity) || 1}x {child.name || 'Sub-item'}{child.flagged ? ' *' : ''}
											</span>
											<span class="flex gap-8">
												{#if showBudgeted}
													<span class="font-mono w-24 text-right {child.flagged ? 'text-problem' : 'text-gray2'}">{formatMoney(itemBudgetedTotal(child))}</span>
												{/if}
												{#if showActual}
													<span class="font-mono w-24 text-right text-confirmed/70">{formatMoney(itemActualTotal(child))}</span>
												{/if}
											</span>
										</div>
									{/each}
								{/each}
								<div class="text-right mt-2 pt-2 text-xs font-bold uppercase text-gray2">
									Subtotal:
									<span class="text-problem font-mono">
										{sectionHeaderTotal(itemsBudgetedTotal(sub.items), itemsActualTotal(sub.items))}
									</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<div class="mt-8 pt-6 border-t-2 border-gray2/30 break-inside-avoid">
		<h2 class="text-xl font-bold text-white mb-4 uppercase">Summary</h2>
		<div class="bg-gray2/10 rounded-lg p-6 border border-gray2/20">
			{#if options.includeIncome}
				<div class="flex justify-between items-center text-sm font-bold">
					<span class="text-gray2 uppercase tracking-wider">Total Budget</span>
					<span class="font-bold text-confirmed text-lg font-mono">{formatMoney(totalIncome)}</span>
				</div>
				<div class="pl-4 mt-2 mb-4 space-y-1.5 border-l-2 border-gray2/20">
					{#if budgetType === 'Internal Prod'}
						<div class="flex justify-between text-xs">
							<span class="text-gray2">Total Budget</span>
							<span class="text-white font-mono">{formatMoney(incomeTotalBudget)}</span>
						</div>
					{:else}
						{#if budgetType === 'Complete Prod'}
							<div class="flex justify-between text-xs">
								<span class="text-gray2">Artist Fee</span>
								<span class="text-white font-mono">{formatMoney(incomeArtist)}</span>
							</div>
						{/if}
						<div class="flex justify-between text-xs">
							<span class="text-gray2">Technical</span>
							<span class="text-white font-mono">{formatMoney(incomeTechnical)}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-gray2">Hospitality</span>
							<span class="text-white font-mono">{formatMoney(incomeHospitality)}</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-gray2">Other</span>
							<span class="text-white font-mono">{formatMoney(incomeOther)}</span>
						</div>
					{/if}
				</div>
			{/if}

			{#if showBudgeted}
				<div class="flex justify-between items-center text-sm font-bold pt-3 border-t border-gray2/10">
					<span class="text-gray2 uppercase tracking-wider">Total Expenses (Budgeted)</span>
					<span class="font-bold text-problem text-lg font-mono">{formatMoney(totalExpenses * -1)}</span>
				</div>
			{/if}
			{#if showActual}
				<div class="flex justify-between items-center text-sm font-bold {showBudgeted ? 'pt-1' : 'pt-3 border-t border-gray2/10'}">
					<span class="text-gray2 uppercase tracking-wider">Total Expenses (Actual)</span>
					<span class="font-bold text-problem text-lg font-mono">{formatMoney(totalActualExpenses * -1)}</span>
				</div>
			{/if}

			<div class="pl-4 mt-2 mb-4 space-y-1.5 border-l-2 border-gray2/20">
				{#if budgetType === 'Complete Prod' && pdfArtistFee.length > 0}
					<div class="flex justify-between text-xs">
						<span class="text-gray2">Artist Fee</span>
						<span class="text-problem font-mono">{sectionHeaderTotal(totalArtistFee * -1, actArtistFee * -1)}</span>
					</div>
				{/if}
				{#if pdfTechnical.length > 0}
					<div class="flex justify-between text-xs">
						<span class="text-gray2">Technical</span>
						<span class="text-problem font-mono">{sectionHeaderTotal(totalTechnical * -1, actTechnical * -1)}</span>
					</div>
				{/if}
				{#if pdfHospitality.length > 0}
					<div class="flex justify-between text-xs">
						<span class="text-gray2">Hospitality</span>
						<span class="text-problem font-mono">{sectionHeaderTotal(totalHospitality * -1, actHospitality * -1)}</span>
					</div>
				{/if}
				{#if pdfOther.length > 0}
					<div class="flex justify-between text-xs">
						<span class="text-gray2">Other Expenses</span>
						<span class="text-problem font-mono">{sectionHeaderTotal(totalOther * -1, actOther * -1)}</span>
					</div>
				{/if}
			</div>

			<div class="border-t border-gray2/20 my-3"></div>
			{#if showBudgeted}
				<div class="flex justify-between items-center text-xl">
					<span class="font-bold text-white uppercase tracking-wider">BUDGET TOTAL</span>
					<span class="font-bold font-mono {netTotal >= 0 ? 'text-confirmed' : 'text-problem'}">
						{formatMoney(netTotal)}
					</span>
				</div>
			{/if}
			{#if showActual}
				<div class="flex justify-between items-center {showBudgeted ? 'text-base mt-1' : 'text-xl'}">
					<span class="font-bold text-white uppercase tracking-wider">{showBudgeted ? 'Actual Total' : 'BUDGET TOTAL'}</span>
					<span class="font-bold font-mono {actualNetTotal >= 0 ? 'text-confirmed' : 'text-problem'}">
						{formatMoney(actualNetTotal)}
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
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