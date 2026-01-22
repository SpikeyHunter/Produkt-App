<script lang="ts">
	import { slide } from 'svelte/transition';

	export let totalIncome: number = 0;
	export let totalExpenses: number = 0;
	export let netTotal: number = 0;
	export let formatMoney: (amount: number) => string;

	// New props for the detailed breakdown
	export let incomeArtist: number = 0;
	export let expenseArtist: number = 0;
	
	export let incomeTechnical: number = 0;
	export let expenseTechnical: number = 0;
	
	export let incomeHospitality: number = 0;
	export let expenseHospitality: number = 0;
	
	export let incomeOther: number = 0;
	export let expenseOther: number = 0;

	let showDetails = false;
</script>

<div class="flex-shrink-0 w-full">
	<div class="space-y-2">
		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Total Income</span>
			<span class="font-bold text-confirmed">{formatMoney(totalIncome)}</span>
		</div>
		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Total Expenses</span>
			<span class="font-bold text-problem">{formatMoney(totalExpenses * -1)}</span>
		</div>
		<div class="flex justify-between items-center text-lg border-t border-gray2/20 pt-2 mt-2">
			<span class="font-bold text-white">NET TOTAL</span>
			<span class="font-bold {netTotal >= 0 ? 'text-confirmed' : 'text-problem'}">
				{formatMoney(netTotal)}
			</span>
		</div>

		<button
			on:click={() => (showDetails = !showDetails)}
			class="w-full text-center text-xs text-gray2 hover:cursor-pointer hover:text-white mt-2 pt-2 border-t border-gray2/10 transition-colors flex items-center justify-center gap-1"
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
				<div>
					<div class="text-white font-bold mb-1">Artist Fee</div>
					<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
						<div class="flex justify-between">
							<span class="text-gray2">Income:</span>
							<span class="text-confirmed">{formatMoney(incomeArtist)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray2">Expenses:</span>
							<span class="text-problem">{formatMoney(expenseArtist * -1)}</span>
						</div>
					</div>
				</div>

				<div>
					<div class="text-white font-bold mb-1">Technical</div>
					<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
						<div class="flex justify-between">
							<span class="text-gray2">Income:</span>
							<span class="text-confirmed">{formatMoney(incomeTechnical)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray2">Expenses:</span>
							<span class="text-problem">{formatMoney(expenseTechnical * -1)}</span>
						</div>
					</div>
				</div>

				<div>
					<div class="text-white font-bold mb-1">Hospitality</div>
					<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
						<div class="flex justify-between">
							<span class="text-gray2">Income:</span>
							<span class="text-confirmed">{formatMoney(incomeHospitality)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray2">Expenses:</span>
							<span class="text-problem">{formatMoney(expenseHospitality * -1)}</span>
						</div>
					</div>
				</div>

				<div>
					<div class="text-white font-bold mb-1">Other Expenses</div>
					<div class="pl-3 space-y-0.5 border-l-2 border-gray2/20">
						<div class="flex justify-between">
							<span class="text-gray2">Income:</span>
							<span class="text-confirmed">{formatMoney(incomeOther)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray2">Expenses:</span>
							<span class="text-problem">{formatMoney(expenseOther * -1)}</span>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>