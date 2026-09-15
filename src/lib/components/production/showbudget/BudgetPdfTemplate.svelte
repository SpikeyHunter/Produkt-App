<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetPdfTemplate ui-v7 loaded');
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
		includeAllocation: true,
		includeSummary: true
	};

	const safeNum = (val: any) => Number(val) || 0;
	const sectionOn = (key: string) => options.sections?.[key] !== false;

	$: budgetType = budgetData?.budget_type || 'Tour Prod';
	$: isCustom = budgetType === 'Custom';

	$: showBudgeted = options.amounts === 'both' || options.amounts === 'budgeted';
	$: showActual = options.amounts === 'both' || options.amounts === 'actual';
	$: bothCols = options.amounts === 'both';
	$: includeSummary = options.includeSummary !== false;

	// Visible data only: hidden lines, hidden sub-items and hidden sections
	// never make it to the PDF (their totals were already excluding them).
	const visibleItems = (items: BudgetItem[] | undefined): BudgetItem[] =>
		(items || [])
			.filter((i) => !i.hidden)
			.map((i) => ({ ...i, children: (i.children || []).filter((c) => !c.hidden) }));
	const visibleSubs = (subs: BudgetSubsection[] | undefined): BudgetSubsection[] =>
		(subs || [])
			.filter((s) => !s.hidden)
			.map((s) => ({ ...s, items: visibleItems(s.items) }))
			.filter((s) => s.items.length > 0);

	/* ------------------------------- income ------------------------------- */

	$: incomeEnabled = normalizeIncomeEnabled(budgetData?.income_enabled);
	$: incomeTotalBudget = safeNum(budgetData?.income_total_budget);
	$: incomeArtist = incomeEnabled.artist ? safeNum(budgetData?.income_artist) : 0;
	$: incomeTechnical = incomeEnabled.technical ? safeNum(budgetData?.income_technical) : 0;
	$: incomeHospitality = incomeEnabled.hospitality ? safeNum(budgetData?.income_hospitality) : 0;
	$: incomeOther = incomeEnabled.other ? safeNum(budgetData?.income_other) : 0;

	$: allocLabels = allocationLabels(budgetData);
	$: pdfIncome = isCustom ? visibleSubs(incomeSectionsOf(budgetData)) : [];
	$: totalIncome = isCustom ? subsBudgetedTotal(pdfIncome) : totalIncomeOf(budgetData);

	function allocationLabel(section: BudgetSubsection, line: BudgetItem): string {
		const target = lineTarget(section, line);
		if (target === POOL_TARGET) return 'All expenses';
		return allocLabels.get(target) || 'Removed section';
	}

	$: legacyIncomeCards = (
		budgetType === 'Internal Prod'
			? [{ show: true, label: 'Total Budget', amount: incomeTotalBudget }]
			: [
					{ show: budgetType === 'Complete Prod' && incomeEnabled.artist, label: 'Artist Fee', amount: incomeArtist },
					{ show: incomeEnabled.technical, label: 'Technical', amount: incomeTechnical },
					{ show: incomeEnabled.hospitality, label: 'Hospitality', amount: incomeHospitality },
					{ show: incomeEnabled.other, label: 'Other', amount: incomeOther }
				]
	).filter((c) => c.show);

	/* ------------------------------ expenses ------------------------------ */

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

	$: applyTaxes = budgetData?.apply_taxes === true;
	$: gstAmount = applyTaxes ? totalExpenses * 0.05 : 0;
	$: qstAmount = applyTaxes ? totalExpenses * 0.09975 : 0;
	$: expensesWithTaxes = totalExpenses + gstAmount + qstAmount;
	$: gstActual = applyTaxes ? totalActualExpenses * 0.05 : 0;
	$: qstActual = applyTaxes ? totalActualExpenses * 0.09975 : 0;
	$: actualExpensesWithTaxes = totalActualExpenses + gstActual + qstActual;

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

	$: incomeRows = isCustom
		? pdfIncome.map((sec) => ({ label: sec.name || 'Budget', amount: itemsBudgetedTotal(sec.items) }))
		: legacyIncomeCards.map((c) => ({ label: c.label, amount: c.amount }));

	$: expenseRows = pdfCategories.map((cat) => ({ label: cat.label, b: cat.budgeted, a: cat.actual }));

	// Summary lines that would only repeat the figure above them are dropped:
	// one category needs no breakdown, no taxes means no pre-tax subtotal, and
	// without income the final TOTAL would just be Total Expenses again.
	$: showIncomeRows = incomeRows.length > 1;
	$: showExpenseRows = expenseRows.length > 1;
	$: showPreTaxSubtotal = applyTaxes; // pre-tax figure only differs when taxes apply
	$: showGrandTotal = options.includeIncome;

	const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
	function formatEventDate(raw: any): string {
		const m = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
		if (!m) return String(raw || '');
		return `${MONTH_LABELS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
	}

	// Amount column: never a fixed width — long figures were spilling out of
	// the summary card. Right-aligned, nowrap, grows with the number.
	const AMT = 'font-mono text-right whitespace-nowrap min-w-[6.5rem]';

	// A short card moves to the next page whole. A long one (more rows than
	// this) flows row by row instead, so a page never ends half-empty.
	const FLOW_AT = 14;
	const cardClass = (rows: number) => (rows > FLOW_AT ? 'pdf-flow' : 'pdf-section');
</script>

<!--
  Print rules live here so the server render (Playwright) and the in-app
  print version agree: a card (.pdf-section) is never split across a page,
  and a heading never ends a page on its own.
-->
<div
	id="budget-pdf-root"
	class="bg-gray1 text-white font-helvetica px-7 py-6"
	style="width: 8.5in;"
>
	<!-- ───────────────────────────── masthead ───────────────────────────── -->
	<div class="border-b-2 border-lime pb-3 mb-5 flex justify-between items-start keep">
		<div>
			<h1 class="text-2xl font-bold uppercase tracking-wider text-lime mb-1">
				{event?.event_name || 'Event Name'}
			</h1>
			<h2 class="text-sm font-bold uppercase tracking-wider text-gray3">
				{formatEventDate(event?.event_date)}
			</h2>
		</div>
		<img
			src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/ProduktXX_LOGO_lockup.png"
			alt="Produkt Logo"
			class="h-14 w-auto object-contain"
		/>
	</div>

	<!-- ───────────────────────────── income ───────────────────────────── -->
	{#if options.includeIncome && !isCustom && legacyIncomeCards.length > 0}
		<div class="pdf-section mb-5">
			<div class="flex justify-between items-baseline border-b border-gray2/20 pb-1.5 mb-3">
				<h2 class="text-lg font-bold text-white uppercase">Income (+)</h2>
				<span class="text-confirmed font-bold font-mono text-base">{formatMoney(totalIncome)}</span>
			</div>
			<div class="grid grid-cols-2 gap-3">
				{#each legacyIncomeCards as card}
					<div class="bg-gray2/10 px-3 py-2.5 rounded border border-gray2/20 flex justify-between items-baseline">
						<span class="text-gray2 text-[10px] uppercase tracking-wider">{card.label}</span>
						<span class="text-confirmed font-bold font-mono text-base">{formatMoney(card.amount)}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if options.includeIncome && isCustom && pdfIncome.length > 0}
		<div class="mb-5">
			<div class="flex justify-between items-baseline border-b border-gray2/20 pb-1.5 mb-3 keep">
				<h2 class="text-lg font-bold text-white uppercase">Budget / Income (+)</h2>
				<span class="text-confirmed font-bold font-mono text-base">{formatMoney(totalIncome)}</span>
			</div>
			<div class="space-y-3">
				{#each pdfIncome as sec}
					<div class="pdf-section bg-gray2/10 rounded-lg px-3 py-2.5 border border-gray2/20">
						<div class="text-gray2 text-[10px] uppercase font-bold mb-1.5 border-b border-gray2/20 pb-1 flex justify-between gap-4">
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
							<div class="flex justify-between items-center py-1 border-b border-gray2/10 last:border-0 text-[12px]">
								<span class="text-white min-w-0 pr-4">
									{line.name || 'Budget line'}
									<span class="text-gray2 text-[10px]"> — {allocationLabel(sec, line)}</span>
								</span>
								<span class="{AMT} text-confirmed">{formatMoney(itemBudgetedTotal(line))}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- ───────────────────────────── expenses ───────────────────────────── -->
	<div class="mb-5">
		<div class="flex justify-between items-baseline border-b border-gray2/20 pb-1.5 mb-3 keep">
			<h2 class="text-lg font-bold text-white uppercase">Expenses (-)</h2>
			<span class="flex gap-6 items-baseline">
				{#if bothCols}
					<span class="text-[9px] uppercase tracking-wider text-gray2 self-center">Budgeted / Actual</span>
				{/if}
				{#if showBudgeted}
					<span class="{AMT} text-problem font-bold text-base">{formatMoney(totalExpenses)}</span>
				{/if}
				{#if showActual}
					<span class="{AMT} text-problem font-bold text-base">{formatMoney(totalActualExpenses)}</span>
				{/if}
			</span>
		</div>

		<div class="space-y-4">
			{#each pdfCategories as cat (cat.key)}
				<div>
					<!-- category heading stays with its first card -->
					<div class="flex justify-between items-baseline mb-2 keep-with-next">
						<h3 class="text-lime font-bold text-[12px] uppercase tracking-wide">{cat.label}</h3>
						<span class="flex gap-6">
							{#if showBudgeted}
								<span class="{AMT} text-lime font-bold text-[12px]">{formatMoney(cat.budgeted)}</span>
							{/if}
							{#if showActual}
								<span class="{AMT} text-problem font-bold text-[12px]">{formatMoney(cat.actual)}</span>
							{/if}
						</span>
					</div>

					{#if cat.flat}
						<div class="{cardClass(cat.items.length)} bg-gray2/10 rounded-lg px-3 py-2 border border-gray2/20">
							{#each cat.items as item}
								<div class="pdf-row flex justify-between items-center py-1 border-b border-gray2/10 last:border-0 text-[12px]">
									<span class="{item.flagged ? 'text-problem' : 'text-white'}">
										{hasChildren(item) ? '' : `${safeNum(item.quantity) || 1}x `}{item.name || 'Item'}{item.flagged ? ' *' : ''}
									</span>
									<span class="flex gap-6">
										{#if showBudgeted}
											<span class="{AMT} {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
										{/if}
										{#if showActual}
											<span class="{AMT} text-problem">{formatMoney(itemActualTotal(item))}</span>
										{/if}
									</span>
								</div>
								{#each item.children || [] as child}
									<div class="pdf-row flex justify-between items-center py-0.5 pl-5 text-[11px] text-gray2">
										<span class="{child.flagged ? 'text-problem' : 'text-gray2'}">
											└ {safeNum(child.quantity) || 1}x {child.name || 'Sub-item'}{child.flagged ? ' *' : ''}
										</span>
										<span class="flex gap-6">
											{#if showBudgeted}
												<span class="{AMT} {child.flagged ? 'text-problem' : 'text-gray2'}">{formatMoney(itemBudgetedTotal(child))}</span>
											{/if}
											{#if showActual}
												<span class="{AMT} text-problem">{formatMoney(itemActualTotal(child))}</span>
											{/if}
										</span>
									</div>
								{/each}
							{/each}
							<div class="pdf-row flex justify-between items-baseline mt-1.5 pt-1.5 border-t border-gray2/15 text-[10px] font-bold uppercase text-gray2">
								<span>Subtotal</span>
								<span class="flex gap-6">
									{#if showBudgeted}
										<span class="{AMT} text-problem">{formatMoney(cat.budgeted)}</span>
									{/if}
									{#if showActual}
										<span class="{AMT} text-problem">{formatMoney(cat.actual)}</span>
									{/if}
								</span>
							</div>
						</div>
					{:else}
						<div class="space-y-2.5">
							{#each cat.subs as sub}
								{@const subB = itemsBudgetedTotal(sub.items)}
								{@const subA = itemsActualTotal(sub.items)}
								<div class="{cardClass(sub.items.length)} bg-gray2/10 rounded-lg px-3 py-2 border border-gray2/20">
									<div class="keep-with-next text-gray2 text-[10px] uppercase font-bold mb-1 border-b border-gray2/20 pb-1">
										{sub.name}
									</div>
									{#each sub.items as item}
										<div class="pdf-row flex justify-between items-center py-1 border-b border-gray2/10 last:border-0 text-[12px]">
											<span class="{item.flagged ? 'text-problem' : 'text-white'}">
												{hasChildren(item) ? '' : `${safeNum(item.quantity) || 1}x `}{item.name}{item.flagged ? ' *' : ''}
											</span>
											<span class="flex gap-6">
												{#if showBudgeted}
													<span class="{AMT} {item.flagged ? 'text-problem' : 'text-white'}">{formatMoney(itemBudgetedTotal(item))}</span>
												{/if}
												{#if showActual}
													<span class="{AMT} text-problem">{formatMoney(itemActualTotal(item))}</span>
												{/if}
											</span>
										</div>
										{#each item.children || [] as child}
											<div class="pdf-row flex justify-between items-center py-0.5 pl-5 text-[11px] text-gray2">
												<span class="{child.flagged ? 'text-problem' : 'text-gray2'}">
													└ {safeNum(child.quantity) || 1}x {child.name || 'Sub-item'}{child.flagged ? ' *' : ''}
												</span>
												<span class="flex gap-6">
													{#if showBudgeted}
														<span class="{AMT} {child.flagged ? 'text-problem' : 'text-gray2'}">{formatMoney(itemBudgetedTotal(child))}</span>
													{/if}
													{#if showActual}
														<span class="{AMT} text-problem">{formatMoney(itemActualTotal(child))}</span>
													{/if}
												</span>
											</div>
										{/each}
									{/each}
									<div class="pdf-row flex justify-between items-baseline mt-1.5 pt-1.5 border-t border-gray2/15 text-[10px] font-bold uppercase text-gray2">
										<span>Subtotal</span>
										<span class="flex gap-6">
											{#if showBudgeted}
												<span class="{AMT} text-problem">{formatMoney(subB)}</span>
											{/if}
											{#if showActual}
												<span class="{AMT} text-problem">{formatMoney(subA)}</span>
											{/if}
										</span>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- ───────────────────────────── allocation ───────────────────────────── -->
	{#if showAllocation}
		<div class="pdf-section mb-5">
			<div class="border-b border-gray2/20 pb-1.5 mb-3">
				<h2 class="text-lg font-bold text-white uppercase">Budget allocation</h2>
			</div>
			<div class="bg-gray2/10 rounded-lg px-3 py-2 border border-gray2/20">
				<div class="flex text-[9px] uppercase tracking-wider text-gray2 pb-1 border-b border-gray2/20">
					<span class="flex-1">Allocated to</span>
					<span class="{AMT}">Allocated</span>
					<span class="{AMT} ml-6">Spent</span>
					<span class="{AMT} ml-6">Left</span>
				</div>

				{#if allocation.pool.allocated > 0 || allocation.pool.spent > 0}
					<div class="flex items-center py-1 border-b border-gray2/10 text-[12px]">
						<span class="flex-1 text-white">All expenses (pool)</span>
						<span class="{AMT} text-confirmed">{formatMoney(allocation.pool.allocated)}</span>
						<span class="{AMT} ml-6 text-problem">{formatMoney(allocation.pool.spent)}</span>
						<span class="{AMT} ml-6 {allocation.pool.remaining > 0 ? 'text-confirmed' : 'text-problem'}">{formatMoney(allocation.pool.remaining)}</span>
					</div>
				{/if}

				{#each allocationRows as row (row.target)}
					<div class="flex items-center py-1 border-b border-gray2/10 last:border-0 text-[12px]">
						<span class="flex-1 text-white">{row.label}</span>
						<span class="{AMT} text-confirmed">{formatMoney(row.allocated)}</span>
						<span class="{AMT} ml-6 text-problem">{formatMoney(row.spent)}</span>
						<span class="{AMT} ml-6 {row.remaining > 0 ? 'text-confirmed' : 'text-problem'}">{formatMoney(row.remaining)}</span>
					</div>
				{/each}

				{#if allocation.pool.overruns > 0}
					<div class="mt-1.5 pt-1.5 flex justify-between text-[10px] text-gray2">
						<span>Overruns covered by the pool</span>
						<span class="font-mono text-problem">{formatMoney(allocation.pool.overruns)}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- ───────────────────────────── summary ───────────────────────────── -->
	{#if includeSummary}
		<div class="pdf-section pt-4 border-t-2 border-gray2/30">
			<h2 class="text-lg font-bold text-white mb-2.5 uppercase">Summary</h2>
			<div class="bg-gray2/10 rounded-lg px-4 py-3 border border-gray2/20">
				{#if bothCols}
					<div class="flex justify-end gap-6 text-[9px] uppercase tracking-wider text-gray2 mb-1.5">
						<span class="{AMT}">Budgeted</span>
						<span class="{AMT}">Actual</span>
					</div>
				{/if}

				{#if options.includeIncome}
					<div class="flex justify-between items-baseline text-[12px] font-bold">
						<span class="text-gray2 uppercase tracking-wider">Total Budget</span>
						<span class="flex gap-6">
							<span class="{AMT} text-confirmed text-base">{formatMoney(totalIncome)}</span>
							{#if bothCols}<span class={AMT}></span>{/if}
						</span>
					</div>
					<div class="pl-3 mt-1 mb-3 space-y-0.5 border-l-2 border-gray2/20 {showIncomeRows ? '' : 'hidden'}">
						{#each incomeRows as row}
							<div class="flex justify-between text-[11px]">
								<span class="text-gray2">{row.label}</span>
								<span class="flex gap-6">
									<span class="{AMT} text-white">{formatMoney(row.amount)}</span>
									{#if bothCols}<span class={AMT}></span>{/if}
								</span>
							</div>
						{/each}
					</div>
				{/if}

				<div class="flex justify-between items-baseline text-[12px] font-bold pt-2 border-t border-gray2/10">
					<span class="text-gray2 uppercase tracking-wider">Total Expenses</span>
					<span class="flex gap-6">
						{#if showBudgeted}
							<span class="{AMT} text-problem text-base">{formatMoney(expensesWithTaxes * -1)}</span>
						{/if}
						{#if showActual}
							<span class="{AMT} text-problem text-base">{formatMoney(actualExpensesWithTaxes * -1)}</span>
						{/if}
					</span>
				</div>

				<div class="pl-3 mt-1 space-y-0.5 border-l-2 border-gray2/20 {showExpenseRows || applyTaxes ? '' : 'hidden'}">
					{#if showExpenseRows}
						{#each expenseRows as row}
							<div class="flex justify-between text-[11px]">
								<span class="text-gray2">{row.label}</span>
								<span class="flex gap-6">
									{#if showBudgeted}
										<span class="{AMT} text-problem">{formatMoney(row.b * -1)}</span>
									{/if}
									{#if showActual}
										<span class="{AMT} text-problem">{formatMoney(row.a * -1)}</span>
									{/if}
								</span>
							</div>
						{/each}
					{/if}

					{#if showPreTaxSubtotal}
						<div class="flex justify-between items-baseline text-[11px] font-bold pt-1 mt-1 border-t border-gray2/20">
							<span class="text-white uppercase tracking-wider">Subtotal</span>
							<span class="flex gap-6">
								{#if showBudgeted}
									<span class="{AMT} text-problem">{formatMoney(totalExpenses * -1)}</span>
								{/if}
								{#if showActual}
									<span class="{AMT} text-problem">{formatMoney(totalActualExpenses * -1)}</span>
								{/if}
							</span>
						</div>
					{/if}

					{#if applyTaxes}
						<div class="text-gray2 uppercase tracking-wider text-[9px] font-bold pt-1.5">Taxes</div>
						<div class="pl-2.5 space-y-0.5 border-l border-gray2/20">
							<div class="flex justify-between text-[11px]">
								<span class="text-gray2">GST (5%)</span>
								<span class="flex gap-6">
									{#if showBudgeted}<span class="{AMT} text-problem">{formatMoney(gstAmount * -1)}</span>{/if}
									{#if showActual}<span class="{AMT} text-problem">{formatMoney(gstActual * -1)}</span>{/if}
								</span>
							</div>
							<div class="flex justify-between text-[11px]">
								<span class="text-gray2">QST (9.975%)</span>
								<span class="flex gap-6">
									{#if showBudgeted}<span class="{AMT} text-problem">{formatMoney(qstAmount * -1)}</span>{/if}
									{#if showActual}<span class="{AMT} text-problem">{formatMoney(qstActual * -1)}</span>{/if}
								</span>
							</div>
						</div>
						<div class="flex justify-between items-baseline text-[11px] font-bold pt-1 mt-1 border-t border-gray2/20">
							<span class="text-white uppercase tracking-wider">Subtotal</span>
							<span class="flex gap-6">
								{#if showBudgeted}<span class="{AMT} text-problem">{formatMoney((gstAmount + qstAmount) * -1)}</span>{/if}
								{#if showActual}<span class="{AMT} text-problem">{formatMoney((gstActual + qstActual) * -1)}</span>{/if}
							</span>
						</div>
					{/if}
				</div>

				<div class="flex justify-between items-baseline text-lg mt-3 pt-2 border-t-2 border-gray2/30 {showGrandTotal ? '' : 'hidden'}">
					<span class="font-bold text-white uppercase tracking-wider">Total</span>
					<span class="flex gap-6">
						{#if showBudgeted}
							<span class="{AMT} font-bold {options.includeIncome ? (netTotal >= 0 ? 'text-confirmed' : 'text-problem') : 'text-problem'}">
								{formatMoney(options.includeIncome ? netTotal : expensesWithTaxes * -1)}
							</span>
						{/if}
						{#if showActual}
							<span class="{AMT} font-bold {options.includeIncome ? (actualNetTotal >= 0 ? 'text-confirmed' : 'text-problem') : 'text-problem'}">
								{formatMoney(options.includeIncome ? actualNetTotal : actualExpensesWithTaxes * -1)}
							</span>
						{/if}
					</span>
				</div>
			</div>
		</div>
	{/if}
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
	/* A card never splits across two pages; a heading never ends a page.
	   Long cards (.pdf-flow) may split, but only between rows. */
	:global(#budget-pdf-root .pdf-section),
	:global(#budget-pdf-root .pdf-row),
	:global(#budget-pdf-root .keep) {
		break-inside: avoid;
		page-break-inside: avoid;
	}
	/* A flowing card gets a closed border and padding on every page it spans. */
	:global(#budget-pdf-root .pdf-flow) {
		box-decoration-break: clone;
		-webkit-box-decoration-break: clone;
	}
	:global(#budget-pdf-root .keep-with-next) {
		break-after: avoid;
		page-break-after: avoid;
		break-inside: avoid;
	}
	:global(#budget-pdf-root .bg-gray1) {
		background-color: #1c1c1e !important;
	}
	:global(#budget-pdf-root .text-white) {
		color: #ffffff !important;
	}
</style>
