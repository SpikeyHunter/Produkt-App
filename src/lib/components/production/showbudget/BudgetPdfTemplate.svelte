<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetPdfTemplate ui-v6 loaded');
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
		hasChildren,
		expenseCategoriesOf,
		computeAllocation,
		allocationLabels,
		lineTarget,
		incomeSectionsOf,
		totalIncomeOf
	} from '$lib/utils/budgetUtils';
	import { normalizeIncomeEnabled } from '$lib/utils/budgetSync';
	import type { ExportOptions, BudgetItem, BudgetSubsection } from '$lib/types/budget';
	import { POOL_TARGET } from '$lib/types/budget';

	export let budgetData: any;
	export let event: any;
	export let options: ExportOptions = {
		amounts: 'both',
		sections: {},
		includeIncome: true,
		includeAllocation: true
	};

	const safeNum = (val: any) => Number(val) || 0;
	const sectionOn = (key: string) => options.sections?.[key] !== false;

	$: budgetType = budgetData?.budget_type || 'Tour Prod';

	$: showBudgeted = options.amounts === 'both' || options.amounts === 'budgeted';
	$: showActual = options.amounts === 'both' || options.amounts === 'actual';

	// Visible data only (hidden rows/sections never make it to the PDF)
	const visibleItems = (items: BudgetItem[] | undefined): BudgetItem[] =>
		(items || []).filter((i) => !i.hidden);
	const visibleSubs = (subs: BudgetSubsection[] | undefined): BudgetSubsection[] =>
		(subs || [])
			.filter((s) => !s.hidden)
			.map((s) => ({ ...s, items: visibleItems(s.items) }))
			.filter((s) => s.items.length > 0);

	/* ------------------------------- income ------------------------------- */

	$: isCustom = budgetType === 'Custom';

	// Custom budgets use the income builder; the standard types keep their
	// fixed income fields (and the per-source on/off switches).
	$: incomeEnabled = normalizeIncomeEnabled(budgetData?.income_enabled);
	$: incomeTotalBudget = safeNum(budgetData?.income_total_budget);
	$: incomeArtist = incomeEnabled.artist ? safeNum(budgetData?.income_artist) : 0;
	$: incomeTechnical = incomeEnabled.technical ? safeNum(budgetData?.income_technical) : 0;
	$: incomeHospitality = incomeEnabled.hospitality ? safeNum(budgetData?.income_hospitality) : 0;
	$: incomeOther = incomeEnabled.other ? safeNum(budgetData?.income_other) : 0;

	$: allocLabels = allocationLabels(budgetData);
	$: pdfIncome = isCustom ? visibleSubs(incomeSectionsOf(budgetData)) : [];
	$: totalIncome = isCustom ? subsBudgetedTotal(pdfIncome) : totalIncomeOf(budgetData);

	/** What one income line is allowed to pay for. */
	function allocationLabel(section: BudgetSubsection, line: BudgetItem): string {
		const target = lineTarget(section, line);
		if (target === POOL_TARGET) return 'All expenses';
		return allocLabels.get(target) || 'Removed section';
	}

	/* ------------------------------ expenses ------------------------------ */

	// Categories that actually print: not hidden, not switched off in the export
	// options, and holding at least one visible line.
	$: pdfCategories = expenseCategoriesOf(budgetData)
		.filter((cat) => !cat.hidden && sectionOn(cat.key))
		.map((cat) => ({
			...cat,
			subs: cat.flat ? [] : visibleSubs(cat.subs),
			items: cat.flat ? visibleItems(cat.items) : []
		}))
		.filter((cat) => (cat.flat ? cat.items.length > 0 : cat.subs.length > 0))
		.map((cat) => ({
			...cat,
			budgeted: cat.flat ? itemsBudgetedTotal(cat.items) : subsBudgetedTotal(cat.subs),
			actual: cat.flat ? itemsActualTotal(cat.items) : subsActualTotal(cat.subs)
		}));

	$: totalExpenses = pdfCategories.reduce((acc, c) => acc + c.budgeted, 0);
	$: totalActualExpenses = pdfCategories.reduce((acc, c) => acc + c.actual, 0);

	// +TX: GST 5% + QST 9.975%, computed independently on each expense column.
	$: applyTaxes = budgetData?.apply_taxes === true;
	$: gstAmount = applyTaxes ? totalExpenses * 0.05 : 0;
	$: qstAmount = applyTaxes ? totalExpenses * 0.09975 : 0;
	$: expensesWithTaxes = totalExpenses + gstAmount + qstAmount;
	$: gstActual = applyTaxes ? totalActualExpenses * 0.05 : 0;
	$: qstActual = applyTaxes ? totalActualExpenses * 0.09975 : 0;
	$: actualExpensesWithTaxes = totalActualExpenses + gstActual + qstActual;

	// TOTAL = budget − expenses, taxes included when they apply.
	$: netTotal = totalIncome - expensesWithTaxes;
	$: actualNetTotal = totalIncome - actualExpensesWithTaxes;

	/* ----------------------------- allocation ----------------------------- */

	$: allocation = computeAllocation(budgetData);
	$: allocationRows = allocation.rows;
	$: showAllocation =
		isCustom &&
		options.includeAllocation &&
		(allocationRows.length > 0 || allocation.pool.allocated > 0);

	/* ------------------------------ summary ------------------------------- */

	// One line per income section (Custom), or the fixed sources of the
	// standard budget types.
	$: incomeRows = isCustom
		? pdfIncome.map((sec) => ({ label: sec.name || 'Budget', amount: itemsBudgetedTotal(sec.items) }))
		: (budgetType === 'Internal Prod'
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
			)
				.filter((r) => r.show)
				.map((r) => ({ label: r.label, amount: r.amount }));

	$: expenseRows = pdfCategories.map((cat) => ({
		label: cat.label,
		b: cat.budgeted,
		a: cat.actual
	}));

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

	{#if options.includeIncome && !isCustom}
		<!-- Standard budget types: the fixed income cards, unchanged -->
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

	{#if options.includeIncome && isCustom && pdfIncome.length > 0}
		<div class="mb-8">
			<h2 class="text-xl font-bold text-white mb-4 uppercase border-b border-gray2/20 pb-2">
				Budget / Income (+) - {formatMoney(totalIncome)}
			</h2>

			<div class="space-y-4">
				{#each pdfIncome as sec}
					<div class="pdf-section bg-gray2/10 rounded-lg p-4 border border-gray2/20">
						<div class="text-gray2 text-xs uppercase font-bold mb-2 border-b border-gray2/20 pb-1 flex justify-between gap-4">
							<span class="min-w-0">
								{sec.name || 'Budget'}
								<span class="normal-case font-normal text-gray2/80">
									· {sec.fenced && sec.target
										? `reserved for ${allocLabels.get(sec.target) || 'a removed category'}`
										: 'covers any expense'}
								</span>
							</span>
							<span class="text-confirmed font-mono flex-shrink-0">{formatMoney(itemsBudgetedTotal(sec.items))}</span>
						</div>
						{#each sec.items as line}
							<div class="flex justify-between items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
								<span class="text-white min-w-0 pr-4">
									{line.name || 'Budget line'}
									<span class="text-gray2 text-xs"> — {allocationLabel(sec, line)}</span>
								</span>
								<span class="font-mono w-28 text-right text-confirmed flex-shrink-0">{formatMoney(itemBudgetedTotal(line))}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<div class="space-y-8 mb-8">
		<h2 class="text-xl font-bold text-white mb-4 uppercase border-b border-gray2/20 pb-2">
			Expenses (-) - {formatMoney(totalExpenses)}
		</h2>

		<!-- Column legend for "both" mode -->
		{#if options.amounts === 'both'}
			<div class="flex justify-end gap-8 text-[10px] uppercase tracking-wider text-gray2 -mt-4">
				<span class="w-24 text-right">Budgeted</span>
				<span class="w-24 text-right">Actual</span>
			</div>
		{/if}

		{#each pdfCategories as cat (cat.key)}
			<div>
				<h3 class="text-lime font-bold text-sm uppercase mb-3">
					{cat.label} - {sectionHeaderTotal(cat.budgeted, cat.actual)}
				</h3>

				{#if cat.flat}
					<div class="pdf-section bg-gray2/10 rounded-lg p-4 border border-gray2/20">
						{#each cat.items as item}
							<div class="flex justify-between items-center py-2 border-b border-gray2/10 last:border-0 text-sm">
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
							Subtotal: <span class="text-problem font-mono">{sectionHeaderTotal(cat.budgeted, cat.actual)}</span>
						</div>
					</div>
				{:else}
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
				{/if}
			</div>
		{/each}
	</div>

	{#if showAllocation}
		<div class="pdf-section mb-8">
			<h2 class="text-xl font-bold text-white mb-1 uppercase border-b border-gray2/20 pb-2">
				Budget allocation
			</h2>
			<p class="text-gray2 text-[10px] mb-3">
				Money earmarked for a section is tracked against that section. Anything it goes over
				is drawn from the pooled budget, which covers every section.
			</p>
			<div class="bg-gray2/10 rounded-lg p-4 border border-gray2/20">
				<div class="flex text-[10px] uppercase tracking-wider text-gray2 pb-1 border-b border-gray2/20">
					<span class="flex-1">Allocated to</span>
					<span class="w-28 text-right">Allocated</span>
					<span class="w-28 text-right">Spent</span>
					<span class="w-28 text-right">Left</span>
				</div>

				{#if allocation.pool.allocated > 0 || allocation.pool.spent > 0}
					<div class="flex items-center py-1.5 border-b border-gray2/10 text-sm">
						<span class="flex-1 text-white">All expenses (pool)</span>
						<span class="w-28 text-right font-mono text-confirmed">{formatMoney(allocation.pool.allocated)}</span>
						<span class="w-28 text-right font-mono text-white">{formatMoney(allocation.pool.spent)}</span>
						<span class="w-28 text-right font-mono {allocation.pool.remaining < 0 ? 'text-problem' : 'text-confirmed'}">{formatMoney(allocation.pool.remaining)}</span>
					</div>
				{/if}

				{#each allocationRows as row (row.target)}
					<div class="flex items-center py-1.5 border-b border-gray2/10 last:border-0 text-sm">
						<span class="flex-1 text-white">{row.label}</span>
						<span class="w-28 text-right font-mono text-confirmed">{formatMoney(row.allocated)}</span>
						<span class="w-28 text-right font-mono text-white">{formatMoney(row.spent)}</span>
						<span class="w-28 text-right font-mono {row.remaining < 0 ? 'text-problem' : 'text-confirmed'}">{formatMoney(row.remaining)}</span>
					</div>
				{/each}

				{#if allocation.unusedFenced > 0 || allocation.pool.overruns > 0}
					<div class="mt-2 pt-2 text-[10px] text-gray2 space-y-0.5">
						{#if allocation.pool.overruns > 0}
							<div class="flex justify-between">
								<span>Overruns covered by the pool</span>
								<span class="font-mono text-problem">{formatMoney(allocation.pool.overruns)}</span>
							</div>
						{/if}
						{#if allocation.unusedFenced > 0}
							<div class="flex justify-between">
								<span>Unused in earmarked sections</span>
								<span class="font-mono text-gray3">{formatMoney(allocation.unusedFenced)}</span>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<div class="pdf-section mt-8 pt-6 border-t-2 border-gray2/30 break-inside-avoid">
		<h2 class="text-xl font-bold text-white mb-4 uppercase">Summary</h2>
		<div class="bg-gray2/10 rounded-lg p-6 border border-gray2/20">
			{#if options.amounts === 'both'}
				<div class="flex justify-end gap-8 text-[10px] uppercase tracking-wider text-gray2 mb-2">
					<span class="w-28 text-right">Budgeted</span>
					<span class="w-28 text-right">Actual</span>
				</div>
			{/if}

			<!-- TOTAL BUDGET (income) -->
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
