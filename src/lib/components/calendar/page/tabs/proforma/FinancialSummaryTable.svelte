<script lang="ts">
	export let columns: any[] = [];
	export let currency: string = 'CAD';

	const formatCurrency = (amount: number, currencyCode: string) => {
		try {
			const safeCode = currencyCode || 'CAD';
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: safeCode,
				currencyDisplay: 'narrowSymbol'
			}).format(Math.abs(amount) || 0);
			const formatted = `${safeCode}${num}`;
			return amount < 0 ? `-${formatted}` : formatted;
		} catch (e) {
			return `CAD$${amount || 0}`;
		}
	};

	const formatNumber = (amount: number) => {
		return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount || 0);
	};

	// Rows configuration to map to data object keys
	const rows = [
		{ id: 'paidTickets', label: 'Paid Tickets', isCurrency: false },
		{ id: 'grossRevenue', label: 'Gross Ticket Revenue', isCurrency: true },
		{ id: 'taxesAndFees', label: 'Taxes & Fees', isCurrency: true },
		{ id: 'netGross', label: 'Net Gross', isCurrency: true },
		{ id: 'additionalRevenue', label: 'Additional Revenue', isCurrency: true },
		{ id: 'totalExpenses', label: 'Total Expenses', isCurrency: true },
		{ id: 'netProfit', label: 'Net Profit', isCurrency: true, isBold: true }
	];
</script>

<div class="w-full bg-navbar overflow-hidden border border-gray1 rounded-sm">
	<div class="overflow-x-auto custom-scrollbar">
		<table class="w-full text-xs text-white border-collapse min-w-[1000px]">
			<thead class="text-xs tracking-wider text-gray2 font-bold bg-navbar border-b border-gray1">
				<tr>
					<th class="px-4 py-4 text-left sticky left-0 bg-navbar z-10 border-r border-gray1/30 min-w-[160px]">
						Line Item
					</th>
					{#each columns as col}
						<th class="px-4 py-4 text-right whitespace-nowrap">
							{col.label}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-gray1 bg-gray1/20">
				{#each rows as row}
					<tr class="transition-colors hover:bg-gray2/5">
						<td class="px-4 py-3 text-left sticky left-0 bg-navbar z-10 border-r border-gray1/30 {row.isBold ? 'font-bold text-white' : 'text-gray2'}">
							{row.label}
						</td>
						{#each columns as col}
							<td class="px-4 py-3 text-right {row.isBold ? 'font-bold text-white' : 'text-gray3'}">
								{#if row.isCurrency}
									{formatCurrency(col.data[row.id], currency)}
								{:else}
									{formatNumber(col.data[row.id])}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>