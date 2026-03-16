<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';

	export let isOpen = false;

	let fileInput: HTMLInputElement;
	let rawHeaders: string[] = [];
	let parsedData: any[] = [];
	let isDragging = false;

	const dispatch = createEventDispatcher();

	function handleFile(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		readFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files?.[0];
		if (!file || !file.name.endsWith('.csv')) return;

		// Sync the dropped file to the input for consistency
		if (fileInput) {
			const dataTransfer = new DataTransfer();
			dataTransfer.items.add(file);
			fileInput.files = dataTransfer.files;
		}

		readFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function readFile(file: File) {
		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			parseCSV(text);
		};
		reader.readAsText(file);
	}

	function parseCSV(text: string) {
		// Simple comma delimiting, accounting for potential empty lines
		const lines = text
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l !== '');
		if (lines.length < 1) return;

		rawHeaders = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

		parsedData = lines.slice(1).map((line) => {
			// Rough split for standard CSV without extensive complex quoted-comma handling
			const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
			const row: any = {};
			rawHeaders.forEach((h, i) => {
				row[h] = values[i] || '';
			});
			return row;
		});
	}

	function processImport() {
		const newTickets = parsedData.map((row, i) => {
			// Look for likely headers via fallbacks
			return {
				id: crypto.randomUUID(),
				name: row['Name'] || row['name'] || `Imported Tier ${i + 1}`,
				allotment: Number(row['Allotment'] || row['allotment']) || 0,
				comps: Number(row['Comps'] || row['comps']) || 0,
				kills: Number(row['Kills'] || row['kills']) || 0,
				price: Number((row['Price'] || row['price'] || '').replace(/[^0-9.-]+/g, '')) || 0,
				estSold: Number(row['Est. Sold'] || row['estSold'] || row['Est Sold']) || 0,
				sold: Number(row['Sold'] || row['sold']) || 0,
				ticketFees:
					Number((row['Ticket Fees'] || row['ticketFees'] || '').replace(/[^0-9.-]+/g, '')) || 0
			};
		});

		dispatch('import', newTickets);
		close();
	}

	function close() {
		parsedData = [];
		rawHeaders = [];
		if (fileInput) fileInput.value = '';
		isOpen = false;
		isDragging = false;
	}
</script>

<Modal
	{isOpen}
	title="Import Tickets CSV"
	showHeader={true}
	on:close={close}
	maxWidth="max-w-4xl"
	hasFooter={true}
>
	<div class="flex flex-col gap-6">
		<div
			class="relative w-full h-40 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition-colors
               {isDragging
				? 'border-lime bg-lime/5'
				: 'border-gray2/30 hover:border-gray2/60 bg-navbar/30'}"
			role="region"
			aria-label="File Upload Drop Zone"
			on:dragover={handleDragOver}
			on:dragleave={handleDragLeave}
			on:drop={handleDrop}
		>
			<input
				type="file"
				accept=".csv"
				bind:this={fileInput}
				on:change={handleFile}
				class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
			/>

			<div class="pointer-events-none flex flex-col items-center gap-2">
				<svg
					class="w-8 h-8 text-gray2 {isDragging ? 'text-lime' : ''} transition-colors"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
					></path>
				</svg>
				<p class="text-white font-bold text-sm">
					{isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
				</p>
				<p class="text-gray2 text-xs">Only .csv files are supported</p>
			</div>
		</div>

		{#if parsedData.length > 0}
			<div class="mt-4">
				<h4 class="text-white font-bold mb-2">Preview Data ({parsedData.length} rows found)</h4>
				<div
					class="w-full bg-navbar/50 border border-gray2/20 rounded-lg overflow-x-auto custom-scrollbar max-h-60 overflow-y-auto"
				>
					<table class="w-full text-xs text-left text-white whitespace-nowrap">
						<thead class="bg-gray1 sticky top-0 border-b border-gray2/20 text-gray2">
							<tr>
								{#each rawHeaders as header}
									<th class="px-3 py-2 border-r border-gray2/20 last:border-0">{header}</th>
								{/each}
							</tr>
						</thead>
						<tbody class="divide-y divide-gray2/10">
							{#each parsedData as row}
								<tr class="hover:bg-gray2/5">
									{#each rawHeaders as header}
										<td class="px-3 py-2 border-r border-gray2/20 last:border-0"
											>{row[header] || '-'}</td
										>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex justify-end gap-3 w-full">
		<button
			on:click={close}
			class="px-5 py-2 rounded-3xl text-sm font-bold text-gray2 hover:bg-gray2/10 transition-colors"
		>
			Cancel
		</button>
		<button
			on:click={processImport}
			disabled={parsedData.length === 0}
			class="px-5 py-2 rounded-3xl text-sm font-bold bg-lime text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
		>
			Import {parsedData.length > 0 ? parsedData.length : ''} Rows
		</button>
	</div>
</Modal>
