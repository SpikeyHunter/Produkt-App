<script lang="ts">
	export let items: any[] = [];
	export let settlement: any = {};
	export let grandTotal: number = 0;
	export let venueCut: number = 0;
	export let balance: number = 0;
	export let currencySym: string = '$';

	function formatDate(dateString: string) {
		if (!dateString) return '';
		const d = new Date(dateString);
		d.setDate(d.getDate() + 1);
		return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
	}

	$: sizes = settlement?.sizes || [];
</script>

<div id="sheet-to-print" class="bg-[#151515] text-white p-8 font-helvetica font-bold" style="width: 11in;">
	<div class="flex justify-between items-start border-b-2 border-lime pb-6 mb-8">
		<div>
			<h1 class="text-4xl font-black text-white mb-2 uppercase tracking-wide">Merch Settlement</h1>
			<h2 class="text-3xl font-bold text-lime mb-1">{settlement?.event_name || 'Event Name'}</h2>
			<p class="text-xl font-bold text-gray2">{formatDate(settlement?.event_date)}</p>
		</div>
		<img src="about:blank" data-pdf-logo="true" alt="Logo" class="logo-img h-20 object-contain" />
	</div>

	<table class="w-full text-left border-collapse mb-10">
		<thead>
			<tr>
				<th class="p-4 border-b-2 border-gray2/30 text-gray3 font-bold uppercase text-sm w-1/4">Item Name</th>
				<th class="p-4 border-b-2 border-gray2/30 text-gray3 font-bold uppercase text-sm w-24">Type</th>
				{#each sizes as size}
					<th class="p-4 border-b-2 border-gray2/30 text-center text-gray3 font-bold uppercase text-sm">{size}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each items as item}
				<tr class="border-t border-gray2/20">
					<td rowspan="3" class="p-4 align-top font-bold text-xl text-white border-b border-gray2/30">
						{item.name || 'Unnamed Item'}
						<div class="text-lime text-base mt-2 font-bold">Price: {currencySym}{Number(item.price).toFixed(2)}</div>
					</td>
					<td class="p-4 text-sm font-bold text-gray2">QTY</td>
					{#each sizes as size}
						<td class="p-4 text-center text-base font-bold text-gray2">{item.qty[size] || 0}</td>
					{/each}
				</tr>
				<tr>
					<td class="p-4 text-sm font-bold text-white">FINALS</td>
					{#each sizes as size}
						<td class="p-4 text-center text-base font-bold text-white bg-gray1/40">{item.finals[size] || 0}</td>
					{/each}
				</tr>
				<tr class="border-b border-gray2/30">
					<td class="p-4 text-sm font-bold text-lime">SALES</td>
					{#each sizes as size}
						<td class="p-4 text-center text-base font-bold text-lime bg-lime/5">{item.sales[size] || 0}</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>

	<div class="flex justify-end mt-12">
		<div class="w-[400px] bg-navbar p-8 rounded-3xl border border-gray2/20 space-y-4">
			<div class="flex justify-between text-lg items-center">
				<span class="text-gray3 font-bold">GRAND TOTAL</span>
				<span class="text-white font-bold">{currencySym}{grandTotal.toFixed(2)}</span>
			</div>
			<div class="flex justify-between text-base items-center">
				<span class="text-problem font-bold">VENUE CUT ({settlement?.venue_cut_pct}%)</span>
				<span class="text-problem font-bold">-{currencySym}{venueCut.toFixed(2)}</span>
			</div>
			<div class="flex justify-between text-base items-center border-b border-gray2/20 pb-5">
				<span class="text-problem font-bold">SELLER RATE</span>
				<span class="text-problem font-bold">-{currencySym}{(settlement?.seller_rate || 0).toFixed(2)}</span>
			</div>
			<div class="flex justify-between text-3xl pt-3 items-center">
				<span class="text-gray3 font-black">BALANCE</span>
				<span class="text-confirmed font-black">{currencySym}{balance.toFixed(2)}</span>
			</div>
		</div>
	</div>
</div>