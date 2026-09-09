<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetPdfTemplate ui-v4 loaded');
</script>

<script lang="ts">
	import {
		formatMoney,
		itemBudgetedTotal,
		itemActualTotal,
		itemsBudgetedTotal,
		itemsActualTotal,
		subsBudgetedTotal,
		subsActualTotal,
		hasChildren
	} from '$lib/utils/budgetUtils';
	import { normalizeIncomeEnabled } from '$lib/utils/budgetSync';
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

	// Income — sources switched off for this budget are skipped entirely.
	$: incomeEnabled = normalizeIncomeEnabled(budgetData?.income_enabled);
	$: incomeTotalBudget = safeNum(budgetData?.income_total_budget);
	$: incomeArtist = incomeEnabled.artist ? safeNum(budgetData?.income_artist) : 0;
	$: incomeTechnical = incomeEnabled.technical ? safeNum(budgetData?.income_technical) : 0;
	$: incomeHospitality = incomeEnabled.hospitality ? safeNum(budgetData?.income_hospitality) : 0;
	$: incomeOther = incomeEnabled.other ? safeNum(budgetData?.income_other) : 0;

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

	// TOTAL = budget − expenses, taxes included when they apply.
	$: netTotal = totalIncome - expensesWithTaxes;
	$: actualNetTotal = totalIncome - actualExpensesWithTaxes;

	// +TX: GST 5% + QST 9.975%, computed independently on each expense column.
	$: applyTaxes = budgetData?.apply_taxes === true;
	$: gstAmount = applyTaxes ? totalExpenses * 0.05 : 0;
	$: qstAmount = applyTaxes ? totalExpenses * 0.09975 : 0;
	$: expensesWithTaxes = totalExpenses + gstAmount + qstAmount;
	$: gstActual = applyTaxes ? totalActualExpenses * 0.05 : 0;
	$: qstActual = applyTaxes ? totalActualExpenses * 0.09975 : 0;
	$: actualExpensesWithTaxes = totalActualExpenses + gstActual + qstActual;

	// Income breakdown — only the sources that apply to this budget.
	$: incomeRows = (
		budgetType === 'Internal Prod'
			? [{ show: true, label: 'Total Budget', amount: incomeTotalBudget }]
			: [
					{
						show: budgetType === 'Complete Prod' && incomeEnabled.artist,
						label: 'Artist Fee',
						amount: incomeArtist
					},
					{ show: incomeEnabled.technical, label: 'Technical', amount: incomeTechnical },
					{ show: incomeEnabled.hospitality, label: 'Hospitality', amount: incomeHospitality },
					{ show: incomeEnabled.other, label: 'Other', amount: incomeOther }
				]
	).filter((r) => r.show);

	// Expense breakdown — only the sections that actually printed.
	$: expenseRows = [
		{
			show: budgetType === 'Complete Prod' && pdfArtistFee.length > 0,
			label: 'Artist Fee',
			b: totalArtistFee,
			a: actArtistFee
		},
		{ show: pdfTechnical.length > 0, label: 'Technical', b: totalTechnical, a: actTechnical },
		{
			show: pdfHospitality.length > 0,
			label: 'Hospitality',
			b: totalHospitality,
			a: actHospitality
		},
		{ show: pdfOther.length > 0, label: 'Other Expenses', b: totalOther, a: actOther }
	].filter((r) => r.show);

	function sectionHeaderTotal(budgeted: number, actual: number): string {
		if (options.amounts === 'budgeted') return formatMoney(budgeted);
		if (options.amounts === 'actual') return formatMoney(actual);
		return `${formatMoney(budgeted)} / act. ${formatMoney(actual)}`;
	}

	const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
	function formatEventDate(raw: any): string {
		const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (!m) return String(raw || '');
		return `${MONTH_LABELS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
	}
</script>

<div
	id="budget-pdf-root"
	class="bg-gray1 text-white font-helvetica p-8"
	style="width: 8.5in; min-height: 11in;"
>
	<div class="border-b-2 border-lime pb-4 mb-8 flex justify-between items-start">
		<div>
			<h1 class="text-2xl font-bold uppercase tracking-wider text-lime mb-2">
				{event?.event_name || 'Event Name'}
			</h1>
			<h2 class="text-base font-bold uppercase tracking-wider text-gray3 mb-1">
				{formatEventDate(event?.event_date)}
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
		<div class="pdf-section mb-8">
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
					{#if budgetType === 'Complete Prod' && incomeEnabled.artist}
						<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
							<span class="text-gray2 text-xs uppercase block mb-1">Artist Fee</span>
							<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeArtist)}</span>
						</div>
					{/if}
					{#if incomeEnabled.technical}
						<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
							<span class="text-gray2 text-xs uppercase block mb-1">Technical</span>
							<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeTechnical)}</span>
						</div>
					{/if}
					{#if incomeEnabled.hospitality}
						<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
							<span class="text-gray2 text-xs uppercase block mb-1">Hospitality</span>
							<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeHospitality)}</span>
						</div>
					{/if}
					{#if incomeEnabled.other}
						<div class="bg-gray2/10 p-4 rounded border border-gray2/20">
							<span class="text-gray2 text-xs uppercase block mb-1">Other</span>
							<span class="text-confirmed font-bold font-mono text-xl">{formatMoney(incomeOther)}</span>
						</div>
					{/if}
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
			<div class="pdf-section">
				<h3 class="text-lime font-bold text-sm uppercase mb-3">
					Artist Fee - {sectionHeaderTotal(totalArtistFee, actArtistFee)}
				</h3>
				<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
					{#each pdfArtistFee as item}
						<div class="flex justify-between items-center py-2 border-b border-gray2/10 last:border-0 text-sm {item.flagged ? 'text-problem' : ''}">
							<span class="{item.flagged ? 'text-problem' : 'text-white'}">
								{hasChildren(item) ? '' : `${safeNum(item.quantity) || 1}x `}{item.name || 'Item'}{item.flagged ? ' *' : ''}
							</span>
							<span class="flex gap-8">
								{#if showBudgeted}
									<span class="font-mono w-24 text-right {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
								{/if}
								{#if showActual}
									<span class="font-mono w-24 text-right text-problem">{formatMoney(itemActualTotal(item))}</span>
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
							<div class="pdf-section bg-gray2/10 rounded-lg p-4 border border-gray2/20">
								<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1">
									{sub.name}
								</div>
								{#each sub.items as item}
									<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
										<span class="{item.flagged ? 'text-problem' : 'text-white'}">
											{hasChildren(item) ? '' : `${safeNum(item.quantity) || 1}x `}{item.name}{item.flagged ? ' *' : ''}
										</span>
										<span class="flex gap-8">
											{#if showBudgeted}
												<span class="font-mono w-24 text-right {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
											{/if}
											{#if showActual}
												<span class="font-mono w-24 text-right text-problem">{formatMoney(itemActualTotal(item))}</span>
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
													<span class="font-mono w-24 text-right text-problem">{formatMoney(itemActualTotal(child))}</span>
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

	<div class="pdf-section mt-8 pt-6 border-t-2 border-gray2/30 break-inside-avoid">
		<h2 class="text-xl font-bold text-white mb-4 uppercase">Summary</h2>
		<div class="bg-gray2/10 rounded-lg p-6 border border-gray2/20">
			{#if options.amounts === 'both'}
				<div class="flex justify-end gap-8 text-[10px] uppercase tracking-wider text-gray2 mb-2">
					<span class="w-28 text-right">Budgeted</span>
					<span class="w-28 text-right">Actual</span>
				</div>
			{/if}

			<!-- TOTAL BUDGET (income) — only the sources that apply -->
			{#if options.includeIncome}
				<div class="flex justify-between items-center text-sm font-bold">
					<span class="text-gray2 uppercase tracking-wider">Total Budget</span>
					<span class="font-bold text-confirmed text-lg font-mono">{formatMoney(totalIncome)}</span>
				</div>
				<div class="pl-4 mt-2 mb-4 space-y-1.5 border-l-2 border-gray2/20">
					{#each incomeRows as row}
						<div class="flex justify-between text-xs">
							<span class="text-gray2">{row.label}</span>
							<span class="text-white font-mono">{formatMoney(row.amount)}</span>
						</div>
					{/each}
				</div>
			{/if}

			<!-- TOTAL EXPENSES: sections, then taxes, then the taxed total -->
			<div class="flex justify-between items-center text-sm font-bold pt-3 border-t border-gray2/10">
				<span class="text-gray2 uppercase tracking-wider">Total Expenses</span>
				<span class="flex gap-8">
					{#if showBudgeted}
						<span class="font-bold text-problem text-lg font-mono w-28 text-right">{formatMoney(expensesWithTaxes * -1)}</span>
					{/if}
					{#if showActual}
						<span class="font-bold text-problem text-lg font-mono w-28 text-right">{formatMoney(actualExpensesWithTaxes * -1)}</span>
					{/if}
				</span>
			</div>

			<div class="pl-4 mt-2 space-y-1.5 border-l-2 border-gray2/20">
				{#each expenseRows as row}
					<div class="flex justify-between text-xs">
						<span class="text-gray2">{row.label}</span>
						<span class="flex gap-8">
							{#if showBudgeted}
								<span class="text-problem font-mono w-28 text-right">{formatMoney(row.b * -1)}</span>
							{/if}
							{#if showActual}
								<span class="text-problem font-mono w-28 text-right">{formatMoney(row.a * -1)}</span>
							{/if}
						</span>
					</div>
				{/each}

				<div class="flex justify-between items-center text-xs font-bold pt-1.5 mt-1.5 border-t border-gray2/20">
					<span class="text-white uppercase tracking-wider">Subtotal</span>
					<span class="flex gap-8">
						{#if showBudgeted}
							<span class="font-bold text-problem font-mono w-28 text-right">{formatMoney(totalExpenses * -1)}</span>
						{/if}
						{#if showActual}
							<span class="font-bold text-problem font-mono w-28 text-right">{formatMoney(totalActualExpenses * -1)}</span>
						{/if}
					</span>
				</div>

				{#if applyTaxes}
					<div class="text-gray2 uppercase tracking-wider text-[10px] font-bold pt-2">Taxes</div>
					<div class="pl-3 space-y-1.5 border-l border-gray2/20">
						<div class="flex justify-between text-xs">
							<span class="text-gray2">GST (5%)</span>
							<span class="flex gap-8">
								{#if showBudgeted}
									<span class="font-mono text-problem w-28 text-right">{formatMoney(gstAmount * -1)}</span>
								{/if}
								{#if showActual}
									<span class="font-mono text-problem w-28 text-right">{formatMoney(gstActual * -1)}</span>
								{/if}
							</span>
						</div>
						<div class="flex justify-between text-xs">
							<span class="text-gray2">QST (9.975%)</span>
							<span class="flex gap-8">
								{#if showBudgeted}
									<span class="font-mono text-problem w-28 text-right">{formatMoney(qstAmount * -1)}</span>
								{/if}
								{#if showActual}
									<span class="font-mono text-problem w-28 text-right">{formatMoney(qstActual * -1)}</span>
								{/if}
							</span>
						</div>
					</div>
					<div class="flex justify-between items-center text-xs font-bold pt-1.5 mt-1.5 border-t border-gray2/20">
						<span class="text-white uppercase tracking-wider">Subtotal</span>
						<span class="flex gap-8">
							{#if showBudgeted}
								<span class="font-bold text-problem font-mono w-28 text-right">{formatMoney((gstAmount + qstAmount) * -1)}</span>
							{/if}
							{#if showActual}
								<span class="font-bold text-problem font-mono w-28 text-right">{formatMoney((gstActual + qstActual) * -1)}</span>
							{/if}
						</span>
					</div>
				{/if}
			</div>

			<!-- TOTAL = budget − expenses (taxes included) -->
			<div class="flex justify-between items-center text-xl mt-4 pt-3 border-t-2 border-gray2/30">
				<span class="font-bold text-white uppercase tracking-wider">Total</span>
				<span class="flex gap-8">
					{#if showBudgeted}
						<span class="font-bold font-mono w-28 text-right {options.includeIncome ? (netTotal >= 0 ? 'text-confirmed' : 'text-problem') : 'text-problem'}">
							{formatMoney(options.includeIncome ? netTotal : expensesWithTaxes * -1)}
						</span>
					{/if}
					{#if showActual}
						<span class="font-bold font-mono w-28 text-right {options.includeIncome ? (actualNetTotal >= 0 ? 'text-confirmed' : 'text-problem') : 'text-problem'}">
							{formatMoney(options.includeIncome ? actualNetTotal : actualExpensesWithTaxes * -1)}
						</span>
					{/if}
				</span>
			</div>
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