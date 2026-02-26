<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { MerchItem } from './MerchGrid.svelte';
	import { slide } from 'svelte/transition';
	import MerchSheetTemplate from './MerchSheetTemplate.svelte';
	import { generateMerchEmail } from './merchEmail';

	export let items: MerchItem[] = [];
	export let settlement: any = null;
	export let grandTotal: number = 0;
	export let venueCut: number = 0;
	export let balance: number = 0;
	export let currencySym: string = '$';

	let expandedItems: Record<string, boolean> = {};
	let isGeneratingPdf = false;
	let isGeneratingEmail = false;

	function toggleExpand(id: string) {
		expandedItems[id] = !expandedItems[id];
	}

	function getItemSalesTotal(item: MerchItem) {
		let totalItemsSold = Object.values(item.sales).reduce((a, b) => a + (Number(b) || 0), 0);
		return totalItemsSold * (Number(item.price) || 0);
	}

	// Helper to render the Svelte template logic to pure HTML
	function getTemplateHtml() {
		const container = document.createElement('div');
		const comp = mount(MerchSheetTemplate, {
			target: container,
			props: { items, settlement, grandTotal, venueCut, balance, currencySym }
		});
		const html = container.innerHTML;
		unmount(comp);
		return html;
	}

	async function handleDownloadPdf() {
		if (isGeneratingPdf || !settlement) return;
		isGeneratingPdf = true;

		try {
			const htmlContent = getTemplateHtml();

			const res = await fetch('/api/generate-merch-pdf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					htmlContent,
					eventName: settlement.event_name,
					eventDate: settlement.event_date
				})
			});

			if (!res.ok) throw new Error('Failed to generate PDF');

			const blob = await res.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `Merch_Settlement_${(settlement.event_name || 'Event').replace(/ /g, '_')}.pdf`;
			document.body.appendChild(a);
			a.click();
			
			window.URL.revokeObjectURL(url);
			a.remove();
		} catch (e) {
			console.error('Error generating PDF:', e);
			alert('Failed to generate PDF. Check console for details.');
		} finally {
			isGeneratingPdf = false;
		}
	}

	async function handleEmailReport() {
		if (isGeneratingEmail || !settlement) return;
		isGeneratingEmail = true;
		try {
			const htmlContent = getTemplateHtml();
			await generateMerchEmail(settlement, supabase, htmlContent);
		} catch (e) {
			console.error('Error generating email:', e);
			alert('Failed to generate email report. Check console for details.');
		} finally {
			isGeneratingEmail = false;
		}
	}
</script>

<div class="w-80 bg-gray1 rounded-3xl flex flex-col overflow-hidden shrink-0">
	<div class="p-5 border-b border-gray2/20 bg-navbar">
		<h3 class="text-white font-bold tracking-wider text-2xl">Sales Summary</h3>
	</div>
	
	<div class="flex-1 overflow-auto bg-navbar custom-scroll p-4 space-y-4">
		{#each items as item}
			<div class="bg-gray1 border border-gray2/20 rounded-2xl p-4">
				<div 
					class="flex justify-between items-center cursor-pointer group" 
					role="button" 
					tabindex="0" 
					on:click={() => toggleExpand(item.id)}
					on:keydown={(e) => e.key === 'Enter' && toggleExpand(item.id)}
					aria-label="Toggle details for {item.name || 'Unnamed Item'}"
				>
					<div>
						<p class="text-white font-bold text-sm group-hover:text-lime transition-colors">{item.name || 'Unnamed Item'}</p>
						<p class="text-xs text-gray2">{currencySym}{item.price}</p>
					</div>
					<div class="flex items-center gap-3 text-right">
						<p class="text-lime font-bold text-sm">{currencySym}{getItemSalesTotal(item).toFixed(2)}</p>
						<svg 
							class="w-4 h-4 text-gray2 transition-transform duration-300 ease-in-out {expandedItems[item.id] ? 'rotate-180' : ''}" 
							viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
						</svg>
					</div>
				</div>
				
				{#if expandedItems[item.id]}
					<div transition:slide={{ duration: 300 }} class="mt-3 pt-3 border-t border-gray2/20 space-y-1">
						{#each settlement.sizes as size}
							<div class="flex justify-between text-xs">
								<span class="text-gray2">{size} <span class="text-gray3 mx-1">x</span> {item.sales[size] || 0}</span>
								<span class="text-white">{currencySym}{((item.sales[size] || 0) * item.price).toFixed(2)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="p-5 bg-navbar border-t border-gray2/20 space-y-3">
		<div class="flex justify-between text-sm">
			<span class="text-gray3 font-bold">GRAND TOTAL</span>
			<span class="text-white font-bold">{currencySym}{grandTotal.toFixed(2)}</span>
		</div>
		<div class="flex justify-between text-xs">
			<span class="text-problem font-bold">VENUE CUT ({settlement?.venue_cut_pct}%)</span>
			<span class="text-problem font-bold">-{currencySym}{venueCut.toFixed(2)}</span>
		</div>
		<div class="flex justify-between text-xs">
			<span class="text-problem font-bold">SELLER RATE</span>
			<span class="text-problem font-bold">-{currencySym}{(settlement?.seller_rate || 0).toFixed(2)}</span>
		</div>
		<div class="pt-3 mt-3 border-t border-gray2/20 flex justify-between text-lg">
			<span class="text-gray3 font-black">BALANCE</span>
			<span class="text-confirmed font-black">{currencySym}{balance.toFixed(2)}</span>
		</div>

		<div class="grid grid-cols-2 gap-2 mt-5">
			<button
				on:click={handleDownloadPdf}
				disabled={isGeneratingPdf || isGeneratingEmail}
				class="px-5 py-2 text-sm text-center font-bold rounded-full bg-gray3 text-black transition-colors cursor-pointer w-full disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{isGeneratingPdf ? 'Wait...' : 'Download PDF'}
			</button>
			<button
				on:click={handleEmailReport}
				disabled={isGeneratingEmail || isGeneratingPdf}
				class="px-5 py-2 text-sm text-center font-bold rounded-full bg-lime text-black  transition-colors cursor-pointer w-full disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{isGeneratingEmail ? 'Wait...' : 'Email Report'}
			</button>
		</div>
	</div>
</div>

<style>
	.custom-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
	.custom-scroll::-webkit-scrollbar-thumb { background: var(--color-lime-rgb); border-radius: 3px; }
	.custom-scroll::-webkit-scrollbar-track { background: transparent; }
</style>