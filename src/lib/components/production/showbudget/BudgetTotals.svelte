<!--
  MODIFIED:
  - Now uses formatMoney function passed as a prop.
  - Fixed typo in 'classs'
-->
<script lang="ts">
	export let totalIncome: number = 0;
	export let totalExpenses: number = 0;
	export let netTotal: number = 0;
	export let formatMoney: (amount: number) => string;
</script>

<div class="flex-shrink-0">
	<div class="w-full space-y-2">
		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Total Income</span>
			<span class="font-bold text-lime">{formatMoney(totalIncome)}</span>
		</div>
		<div class="flex justify-between items-center text-sm">
			<span class="text-gray2">Total Expenses</span>
			<span class="font-bold text-red-500">{formatMoney(totalExpenses * -1)}</span>
		</div>
		<div class="flex justify-between items-center text-lg border-t border-gray2/20 pt-2 mt-2">
			<span class="font-bold text-white">NET TOTAL</span>
			<span class="font-bold {netTotal >= 0 ? 'text-lime' : 'text-red-500'}">
				{formatMoney(netTotal)}
			</span>
		</div>
	</div>
</div>