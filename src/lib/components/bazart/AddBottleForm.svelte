<script lang="ts">
	import { supabase } from '$lib/supabase.js';
	import Modal from '../../components/modals/Modal.svelte';

	let items = [{ saqCode: '', price: '' }];
	let isProcessing = false;
	let statusMessage = '';
	let statusType: 'success' | 'error' | 'info' | 'none' = 'none';

	let messageTimeout: any;
	let isBatchModalOpen = false;
	let batchText = '';

	// Reactively check if all current rows have both a code and a price
	$: isValidToSubmit =
		items.length > 0 &&
		items.every((item) => {
			const safeSaq = item.saqCode ? String(item.saqCode).trim() : '';
			const safePrice =
				item.price != null && String(item.price).trim() !== '' ? String(item.price).trim() : '';
			return safeSaq !== '' && safePrice !== '';
		});

	function setStatus(
		msg: string,
		type: 'success' | 'error' | 'info' | 'none',
		autoHide: boolean = false
	) {
		statusMessage = msg;
		statusType = type;

		if (messageTimeout) clearTimeout(messageTimeout);

		if (autoHide) {
			messageTimeout = setTimeout(() => {
				statusMessage = '';
				statusType = 'none';
			}, 5000);
		}
	}

	function removeItem(index: number) {
		if (items.length > 1) {
			items = items.filter((_, i) => i !== index);
		}
	}

	function closeBatchModal() {
		isBatchModalOpen = false;
		batchText = '';
	}

	function formatBatchText() {
		// Replaces any spaces, tabs, or commas with a newline automatically
		batchText = batchText.replace(/[ \t,]+/g, '\n');
	}

	function addItem() {
		if (items.length < 12) {
			items = [...items, { saqCode: '', price: '' }];
		} else {
			setStatus('You can only add up to 12 bottles at a time.', 'error', true);
		}
	}

	function applyBatch() {
		let codes = batchText
			.split('\n')
			.map((c) => c.trim())
			.filter((c) => c !== '');

		if (codes.length === 0) {
			closeBatchModal();
			return;
		}

		// Check if the only row right now is completely empty
		const isReplacingEmpty =
			items.length === 1 &&
			items[0].saqCode === '' &&
			(items[0].price === '' || items[0].price == null);

		// Calculate how many slots are actually available
		const currentItemCount = isReplacingEmpty ? 0 : items.length;
		const availableSlots = 12 - currentItemCount;

		if (availableSlots <= 0) {
			setStatus('Maximum limit of 12 bottles reached.', 'error', true);
			closeBatchModal();
			return;
		}

		// If they pasted more codes than we have slots, slice the array and warn them
		if (codes.length > availableSlots) {
			setStatus(`Limit reached: Only added ${availableSlots} of your pasted codes.`, 'info', true);
			codes = codes.slice(0, availableSlots);
		}

		const newItems = codes.map((code) => ({ saqCode: code, price: '' }));

		if (isReplacingEmpty) {
			items = newItems;
		} else {
			items = [...items, ...newItems];
		}

		closeBatchModal();
	}

	async function processBottles() {
		const validItems = items.filter((item) => {
			const safeSaq = item.saqCode ? String(item.saqCode).trim() : '';
			const safePrice = item.price != null ? String(item.price).trim() : '';
			return safeSaq !== '' && safePrice !== '';
		});

		if (validItems.length === 0) {
			setStatus('Please add at least one valid SAQ code and price.', 'error', true);
			return;
		}

		isProcessing = true;
		setStatus('Processing bottles...', 'info', false);

		let addedCount = 0;
		let updatedCount = 0;
		let errorCount = 0;

		for (const item of validItems) {
			try {
				// 1. Quick check to see if we are Updating or Adding
				const { data: existingBottle } = await supabase
					.from('bazart_menu_drink')
					.select('saq_code')
					.eq('saq_code', item.saqCode)
					.maybeSingle();

				const isUpdate = !!existingBottle;

				// 2. Scrape data
				const response = await fetch('/api/scrape-saq', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ saq_code: item.saqCode })
				});

				const data = await response.json();

				if (!response.ok) {
					throw new Error(data.error || `Failed to scrape ${item.saqCode}`);
				}

				// 3. Upsert into database
				const { error } = await supabase.from('bazart_menu_drink').upsert(
					{
						saq_code: data.saq_code,
						price: item.price,
						bottle_image: data.bottle_image,
						name: data.name,
						type: data.type,
						description: data.description,
						details: data.details,
						tasting: data.tasting
					},
					{ onConflict: 'saq_code' }
				);

				if (error) throw error;

				// 4. Tally the correct counter
				if (isUpdate) {
					updatedCount++;
				} else {
					addedCount++;
				}
			} catch (err: any) {
				console.error('Error processing item:', item.saqCode, err);
				errorCount++;
			}
		}

		isProcessing = false;

		// Display correct dynamic messaging based on what happened
		if (errorCount === 0) {
			if (addedCount > 0 && updatedCount === 0) {
				setStatus(`Successfully added ${addedCount} bottle(s)!`, 'success', true);
			} else if (updatedCount > 0 && addedCount === 0) {
				setStatus(`Successfully updated ${updatedCount} bottle(s)!`, 'success', true);
			} else {
				setStatus(
					`Successfully added ${addedCount} and updated ${updatedCount} bottle(s)!`,
					'success',
					true
				);
			}
			items = [{ saqCode: '', price: '' }];
		} else if (addedCount > 0 || updatedCount > 0) {
			const total = addedCount + updatedCount;
			setStatus(
				`Processed ${total} bottle(s), but ${errorCount} failed. Check console.`,
				'error',
				true
			);
		} else {
			setStatus('Failed to process any bottles. Check codes and try again.', 'error', true);
		}
	}
</script>

<div
	class="bg-navbar border border-gray2/10 p-6 rounded-2xl h-full flex flex-col text-white shadow-sm"
>
	<div class="mb-6">
		<h2 class="text-xl font-black uppercase tracking-wide text-lime">Add Inventory</h2>
		<p class="text-sm text-gray2 font-bold mt-1">Add SAQ codes and set prices.</p>
	</div>

	<div class="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col min-h-0">
		<div class="grid grid-cols-[1fr_1fr_auto] gap-3 mb-2 px-2">
			<span class="block text-[10px] pl-1 text-gray2 uppercase tracking-widest font-bold"
				>SAQ Code</span
			>
			<span class="block text-[10px] pl-1 text-gray2 uppercase tracking-widest font-bold"
				>Price ($)</span
			>
			<span class="w-8"></span>
		</div>

		<div class="space-y-3 mb-4">
			{#each items as item, i}
				<div class="grid grid-cols-[1fr_1fr_auto] gap-3 pl-1 items-center group">
					<input
						type="text"
						bind:value={item.saqCode}
						placeholder="10327701"
						class="w-full bg-black/20 rounded-full py-1 px-3 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-lime transition-all placeholder-gray2/30"
					/>

					<div class="relative w-full">
						<span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray2 font-bold">$</span>
						<input
							type="number"
							bind:value={item.price}
							placeholder="0.00"
							class="w-full bg-black/20 rounded-full py-1 pl-8 pr-3 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-lime transition-all placeholder-gray2/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
					</div>

					<button
						on:click={() => removeItem(i)}
						class="text-gray2 hover:text-problem transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-problem/10 cursor-pointer"
						title="Remove row"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/></svg
						>
					</button>
				</div>
			{/each}
		</div>

		<button
			on:click={addItem}
			disabled={items.length >= 12}
			class="px-2 text-lime text-sm font-bold flex items-center gap-2 mt-2 hover:opacity-80 cursor-pointer transition-opacity w-max mb-auto disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<span
				class="text-lg bg-lime text-black rounded-full w-5 h-5 flex items-center justify-center pb-0.5"
				>+</span
			>
			{items.length >= 12 ? 'Limit (12) at a time' : 'Add Codes'}
		</button>

		{#if statusMessage}
			<div
				class="mt-4 py-2 px-4 rounded-3xl text-sm font-bold border
                {statusType === 'success' ? 'bg-[#86EFAC]/10 border-[#86EFAC]/30 text-confirmed' : ''}
                {statusType === 'error' ? 'bg-[#FCA5A5]/10 border-[#FCA5A5]/30 text-problem' : ''}
                {statusType === 'info' ? 'bg-black/30 border-gray2/20 text-white' : ''}
                {statusType === 'none' ? 'bg-black/30 border-gray2/20 text-white' : ''}
            "
			>
				{statusMessage}
			</div>
		{/if}

		<div
			class="mt-5 pt-5 border-t flex flex-col items-center justify-center border-gray1 shrink-0"
		>
			<button
				on:click={processBottles}
				disabled={isProcessing || !isValidToSubmit}
				class="bg-lime hover:opacity-90 disabled:bg-gray2/60 text-black font-black uppercase tracking-wide px-5 py-1.5 rounded-full transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-lg"
			>
				{#if isProcessing}
					<span class="animate-pulse">Detecting & Adding...</span>
				{:else}
					<span>Detect and Add</span>
				{/if}
			</button>
			<button
				on:click={() => (isBatchModalOpen = true)}
				class="pt-1 text-gray3 underline hover:text-white transition-colors cursor-pointer text-xs font-bold"
			>
				Batch Code Upload
			</button>
		</div>
	</div>
</div>

<Modal
	isOpen={isBatchModalOpen}
	title="Batch Code Upload"
	on:close={closeBatchModal}
	maxWidth="max-w-md"
	showHeader={true}
>
	<div class="flex flex-col gap-4">
		<p class="text-sm text-gray2">Paste your SAQ codes below, one per line.</p>
		<textarea
			bind:value={batchText}
			on:input={formatBatchText}
			class="w-full bg-black/20 rounded-xl p-4 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-lime transition-all placeholder-gray2/30 min-h-[200px] resize-y custom-scrollbar"
			placeholder="710780&#10;71071213"
		></textarea>

		<div class="flex justify-end gap-3 mt-4">
			<button
				on:click={closeBatchModal}
				class="px-4 py-2 rounded-full text-white hover:bg-white/10 transition-colors font-bold text-sm cursor-pointer"
			>
				Cancel
			</button>
			<button
				on:click={applyBatch}
				class="px-4 py-2 rounded-full bg-lime text-black font-black uppercase tracking-wide text-sm hover:opacity-90 transition-opacity cursor-pointer"
			>
				Batch Upload
			</button>
		</div>
	</div>
</Modal>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: #333;
		border-radius: 10px;
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background-color: #555;
	}
</style>
