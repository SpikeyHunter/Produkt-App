<script context="module" lang="ts">
	// Version beacon — every file in this bundle must print the SAME tag.
	console.log('[budget] BudgetTotals ui-v4 loaded');
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import { formatDisplay } from '$lib/utils/budgetUtils';

	export let totalIncome: number = 0;
	export let totalExpenses: number = 0; // budgeted
	export let netTotal: number = 0; // budgeted

	export let actualExpenses: number = 0;
	export let actualNet: number = 0;
	export let hasActuals: boolean = false;

	export let incomeArtist: number = 0;
	export let expenseArtist: number = 0;
	export let incomeTechnical: number = 0;
	export let expenseTechnical: number = 0;
	export let incomeHospitality: number = 0;
	export let expenseHospitality: number = 0;
	export let incomeOther: number = 0;
	export let expenseOther: number = 0;
	export let budgetType: string = 'Tour Prod';
	export let incomeTotalBudget: number = 0;

	// +TX: GST 5% + QST 9.975% on the whole budget, broken down at the bottom.
	export let applyTaxes: boolean = false;
	export let onToggleTaxes: (() => void) | null = null;

	const GST_RATE = 0.05;
	const QST_RATE = 0.09975;
	// Taxes apply to the EXPENSES side — budgeted and actual are taxed
	// independently, mirroring the two columns.
	$: gstAmount = totalExpenses * GST_RATE;
	$: qstAmount = totalExpenses * QST_RATE;
	$: expensesWithTaxes = totalExpenses + gstAmount + qstAmount;
	$: gstActual = actualExpenses * GST_RATE;
	$: qstActual = actualExpenses * QST_RATE;
	$: actualExpensesWithTaxes = actualExpenses + gstActual + qstActual;

	let showDetails = false;
</script>

<div class="flex-shrink-0 w-full">
	<div class="space-y-1.5">
		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Total Budget</span>
			<span class="font-bold text-gray3">{formatDisplay(totalIncome)}</span>
		</div>

		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Expenses (Budgeted)</span>
			<span class="font-bold text-gray3">{formatDisplay(totalExpenses * -1)}</span>
		</div>

		{#if hasActuals}
			<div class="flex justify-between items-center text-sm">
				<span class="text-gray2">Expenses (Actual)</span>
				<span class="font-bold text-problem">{formatDisplay(actualExpenses * -1)}</span>
			</div>
		{/if}

		<div class="flex justify-between items-center text-lg border-t border-gray2/20 pt-2 mt-2">
			<span class="font-bold text-white">NET TOTAL</span>
			<span class="font-bold {netTotal >= 0 ? 'text-confirmed' : 'text-problem'}">
				{formatDisplay(netTotal)}
			</span>
		</div>

		{#if hasActuals}
			<div class="flex justify-between items-center text-sm">
				<span class="font-bold text-gray2">Net (Actual)</span>
				<span class="font-bold {actualNet >= 0 ? 'text-confirmed' : 'text-problem'}">
					{formatDisplay(actualNet)}
				</span>
			</div>
		{/if}

		<!-- +TX: taxes on the whole budget -->
		<div class="flex justify-between items-center pt-2 mt-2 border-t border-gray2/10">
			<span class="text-sm font-bold {applyTaxes ? 'text-white' : 'text-gray2'}">+ TX (GST / QST)</span>
			<button
				type="button"
				role="switch"
				aria-checked={applyTaxes}
				aria-label="Apply GST and QST to the budget"
				on:click={() => onToggleTaxes?.()}
				class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none transition-colors {applyTaxes
					? 'bg-lime'
					: 'bg-[#444]'}"
			>
				<span
					aria-hidden="true"
					class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {applyTaxes
						? 'translate-x-5'
						: 'translate-x-0'}"
				></span>
			</button>
		</div>

		{#if applyTaxes}
			<div class="space-y-1 pt-1" transition:slide|local={{ duration: 150 }}>
				<div class="flex justify-between items-center text-sm">
					<span class="text-gray2">GST (5%)</span>
					<span class="flex gap-3">
						<span class="font-bold text-gray3">{formatDisplay(gstAmount * -1)}</span>
						{#if hasActuals}
							<span class="font-bold text-problem">{formatDisplay(gstActual * -1)}</span>
						{/if}
					</span>
				</div>
				<div class="flex justify-between items-center text-sm">
					<span class="text-gray2">QST (9.975%)</span>
					<span class="flex gap-3">
						<span class="font-bold text-gray3">{formatDisplay(qstAmount * -1)}</span>
						{#if hasActuals}
							<span class="font-bold text-problem">{formatDisplay(qstActual * -1)}</span>
						{/if}
					</span>
				</div>
				<div class="flex justify-between items-center text-base border-t border-gray2/20 pt-2 mt-1">
					<span class="font-bold text-white">EXPENSES + TX</span>
					<span class="flex gap-3">
						<span class="font-bold text-gray3">{formatDisplay(expensesWithTaxes * -1)}</span>
						{#if hasActuals}
							<span class="font-bold text-problem">{formatDisplay(actualExpensesWithTaxes * -1)}</span>
						{/if}
					</span>
				</div>
			</div>
		{/if}

		<button
			on:click={() => (showDetails = !showDetails)}
			class="w-full text-center text-xs text-gray2 hover:text-white mt-2 pt-2 border-t border-gray2/10 transition-colors flex items-center justify-center gap-1 cursor-pointer"
		>
			{showDetails ? 'Hide Details' : 'Show Details'}
			<svg
				class="w-3 h-3 transform transition-transform {showDetails ? 'rotate-180' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
			</svg>
		</button>

		{#if showDetails}
			<div transition:slide|local={{ duration: 200 }} class="space-y-3 pt-2 text-xs">
				{#if budgetType === 'Internal Prod'}
					<div>
						<div class="text-white font-bold mb-1">Budget Overview</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Total Budget:</span>
								<span class="text-gray3">{formatDisplay(incomeTotalBudget)}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if budgetType === 'Complete Prod'}
					{@const artistDiff = incomeArtist - expenseArtist}
					<div>
						<div class="text-white font-bold mb-1">Artist Fee</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Budget:</span>
								<span class="text-gray3">{formatDisplay(incomeArtist)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseArtist * -1)}</span>
							</div>
							<div class="flex justify-between pt-1 mt-1 border-t border-gray2/10 font-bold">
								<span class="text-gray2">Net:</span>
								<span class={artistDiff >= 0 ? 'text-confirmed' : 'text-problem'}>
									{formatDisplay(artistDiff)}
								</span>
							</div>
						</div>
					</div>
				{/if}

				{#if budgetType !== 'Internal Prod'}
					{@const techDiff = incomeTechnical - expenseTechnical}
					<div>
						<div class="text-white font-bold mb-1">Technical</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Budget:</span>
								<span class="text-gray3">{formatDisplay(incomeTechnical)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseTechnical * -1)}</span>
							</div>
							<div class="flex justify-between pt-1 mt-1 border-t border-gray2/10 font-bold">
								<span class="text-gray2">Net:</span>
								<span class={techDiff >= 0 ? 'text-confirmed' : 'text-problem'}>
									{formatDisplay(techDiff)}
								</span>
							</div>
						</div>
					</div>
				{:else}
					<div>
						<div class="text-white font-bold mb-1">Technical</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseTechnical * -1)}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if budgetType !== 'Internal Prod'}
					{@const hospoDiff = incomeHospitality - expenseHospitality}
					<div>
						<div class="text-white font-bold mb-1">Hospitality</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Budget:</span>
								<span class="text-gray3">{formatDisplay(incomeHospitality)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseHospitality * -1)}</span>
							</div>
							<div class="flex justify-between pt-1 mt-1 border-t border-gray2/10 font-bold">
								<span class="text-gray2">Net:</span>
								<span class={hospoDiff >= 0 ? 'text-confirmed' : 'text-problem'}>
									{formatDisplay(hospoDiff)}
								</span>
							</div>
						</div>
					</div>
				{:else}
					<div>
						<div class="text-white font-bold mb-1">Hospitality</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseHospitality * -1)}</span>
							</div>
						</div>
					</div>
				{/if}

				{#if budgetType !== 'Internal Prod'}
					{@const otherDiff = incomeOther - expenseOther}
					<div>
						<div class="text-white font-bold mb-1">Other Expenses</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Budget:</span>
								<span class="text-gray3">{formatDisplay(incomeOther)}</span>
							</div>
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseOther * -1)}</span>
							</div>
							<div class="flex justify-between pt-1 mt-1 border-t border-gray2/10 font-bold">
								<span class="text-gray2">Net:</span>
								<span class={otherDiff >= 0 ? 'text-confirmed' : 'text-problem'}>
									{formatDisplay(otherDiff)}
								</span>
							</div>
						</div>
					</div>
				{:else}
					<div>
						<div class="text-white font-bold mb-1">Other Expenses</div>
						<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
							<div class="flex justify-between">
								<span class="text-gray2">Expenses:</span>
								<span class="text-gray3">{formatDisplay(expenseOther * -1)}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
