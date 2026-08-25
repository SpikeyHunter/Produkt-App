<script lang="ts">
	import ImportRevenueCSV from './ImportRevenueCSV.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import { fade, fly } from 'svelte/transition';
	import { listEventTemplates, type EventTemplate } from '$lib/services/templateService';

	export let tickets: any[] = [];
	export let financials: any;
	export let currency: string = 'CAD';
	// HOLD events show the Prism-style potential view (no sold/actual columns);
	// Confirmed shows estimates + real numbers; settlement is actual-sold mode.
	export let eventStatus: string = '';
	$: isHoldMode = eventStatus === 'HOLD';

	let searchQuery = '';
	let showImportModal = false;

	// --- Ticket Scaling templates ---
	let showTemplateModal = false;
	let ticketTemplates: EventTemplate[] = [];
	let templatesLoading = false;

	async function openTicketTemplates() {
		showTemplateModal = true;
		templatesLoading = true;
		ticketTemplates = (await listEventTemplates()).filter((t) => t.tickets.length > 0);
		templatesLoading = false;
	}

	function applyTicketTemplate(t: EventTemplate) {
		const rows = t.tickets.map((r) => ({
			id: crypto.randomUUID(),
			name: r.name || 'Tier',
			allotment: Number(r.allotment) || 0,
			comps: Number(r.comps) || 0,
			kills: Number(r.kills) || 0,
			price: Number(r.price) || 0,
			estSold: Number(r.estSold) || 0,
			sold: 0,
			extSold: 0,
			ticketFees: 0
		}));
		// Template's Ticket Scaling mode: Add appends, Overwrite replaces scaling.
		tickets = t.addMode?.tickets !== false ? [...tickets, ...rows] : rows;
		showTemplateModal = false;
	}

	const fullColumns = [
		{ id: 'drag', label: '', width: 4 },
		{ id: 'name', label: 'Name', width: 11 },
		{ id: 'allotment', label: 'Allotment', width: 7 },
		{ id: 'comps', label: 'Comps', width: 6 },
		{ id: 'kills', label: 'Kills', width: 5 },
		{ id: 'sellable', label: 'Sellable', width: 8 },
		{ id: 'price', label: 'Price', width: 9 },
		{ id: 'estSold', label: 'Est. Sold', width: 7 },
		{ id: 'sold', label: 'Act. Sold', width: 7 },
		{ id: 'extSold', label: 'Ext. Sold', width: 7 },
		{ id: 'actualGross', label: 'Actual gross', width: 9 },
		{ id: 'ticketFees', label: 'Ticket fees', width: 8 },
		{ id: 'taxBackedOut', label: 'Tax backed out', width: 9 },
		{ id: 'netGrossActual', label: 'Net Gross', width: 9},
		{ id: 'action', label: 'Remove', width: 6 } 
	];
	const holdColumns = [
		{ id: 'drag', label: '', width: 4 },
		{ id: 'name', label: 'Name', width: 16 },
		{ id: 'allotment', label: 'Allotment', width: 11 },
		{ id: 'comps', label: 'Comps', width: 9 },
		{ id: 'kills', label: 'Kills', width: 8 },
		{ id: 'sellable', label: 'Sellable', width: 10 },
		{ id: 'price', label: 'Price', width: 12 },
		{ id: 'estSold', label: 'Est. Sold', width: 11 },
		{ id: 'potentialGross', label: 'Potential Gross', width: 13 },
		{ id: 'action', label: 'Remove', width: 6 }
	];
	$: columns = isHoldMode ? holdColumns : fullColumns;

	// --- RESIZING LOGIC ---
	let resizingColIndex: number | null = null;
	let startX = 0;
	let startWidth = 0;

	function startResize(e: MouseEvent, index: number) {
		if (columns[index].id === 'drag') return; 
		resizingColIndex = index;
		startX = e.pageX;
		startWidth = columns[index].width;
		
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
		
		window.addEventListener('mousemove', doResize);
		window.addEventListener('mouseup', stopResize);
	}

	function doResize(e: MouseEvent) {
		if (resizingColIndex === null) return;
		const diff = (e.pageX - startX) / window.innerWidth * 100;
		columns[resizingColIndex].width = Math.max(2, startWidth + diff); 
		columns = [...columns];
	}

	function stopResize() {
		resizingColIndex = null;
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		window.removeEventListener('mousemove', doResize);
		window.removeEventListener('mouseup', stopResize);
	}

	// --- DRAG AND DROP ---
	let draggingRowIndex: number | null = null;
	let hideOriginal = false;
	let isDragHandle = false; // Restricts drag to the handle only

	function handleDragStart(e: DragEvent, index: number) {
		if (!isDragHandle) {
			e.preventDefault();
			return;
		}

		draggingRowIndex = index;
		hideOriginal = false;

		const target = e.currentTarget as HTMLElement;

		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', index.toString());

			const clone = target.cloneNode(true) as HTMLElement;
			clone.style.backgroundColor = '#1A1A1A'; 
			clone.style.outline = '2px solid #E1FF00';
			
			// Match exact widths from the currently displayed row
			const originalCells = Array.from(target.children);
			Array.from(clone.getElementsByTagName('td')).forEach((td, i) => {
				td.style.backgroundColor = '#1A1A1A';
				td.style.borderColor = 'transparent';
				td.style.width = `${originalCells[i].getBoundingClientRect().width}px`;
				td.style.boxSizing = 'border-box';
			});

			// Wrap the clone in a table to retain correct table-row formatting
			const tableWrapper = document.createElement('table');
			tableWrapper.className = 'w-full text-xs text-white border-collapse';
			tableWrapper.style.position = 'absolute';
			tableWrapper.style.top = '-9999px';
			tableWrapper.style.left = '-9999px';
			tableWrapper.style.width = `${target.getBoundingClientRect().width}px`;
			tableWrapper.style.tableLayout = 'fixed'; 
			
			const tbody = document.createElement('tbody');
			tbody.appendChild(clone);
			tableWrapper.appendChild(tbody);
			document.body.appendChild(tableWrapper);

			// Set the newly wrapped table as the drag image
			e.dataTransfer.setDragImage(tableWrapper, 20, 20);
			
			setTimeout(() => {
				if (document.body.contains(tableWrapper)) document.body.removeChild(tableWrapper);
			}, 0);
		}

		setTimeout(() => {
			hideOriginal = true;
		}, 0);
	}

	function handleDragOver(e: DragEvent) { e.preventDefault(); }

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggingRowIndex !== null && draggingRowIndex !== dropIndex) {
			const clone = [...tickets];
			const movedItem = clone.splice(draggingRowIndex, 1)[0];
			clone.splice(dropIndex, 0, movedItem);
			tickets = clone;
		}
		draggingRowIndex = null;
		isDragHandle = false;
	}

	function handleDragEnd() {
		draggingRowIndex = null;
		hideOriginal = false;
		isDragHandle = false;
	}

	// --- EXT. SOLD (settlement display) ---
	// Mirrors Act. Sold until it's edited independently: changing Act. Sold
	// always re-copies into Ext. Sold; editing Ext. Sold leaves Act. Sold alone.
	let extSoldInitialized = false;
	$: if (!extSoldInitialized && tickets.length > 0) {
		tickets.forEach((t) => {
			if (t.extSold == null || t.extSold === '') t.extSold = Number(t.sold) || 0;
		});
		tickets = tickets;
		extSoldInitialized = true;
	}

	function syncExtSold(idx: number, e: Event) {
		const val = (e.currentTarget as HTMLInputElement).value;
		tickets[idx].extSold = val === '' ? 0 : Number(val) || 0;
	}

	// --- DATA PROCESSING ---
	$: processedTickets = tickets.map((t, index) => {
		const allotment = Number(t.allotment) || 0;
		const comps = Number(t.comps) || 0;
		const kills = Number(t.kills) || 0;
		const sold = Number(t.sold) || 0;
		const price = Number(t.price) || 0;
		
		const sellable = allotment - comps - kills;
		const actualGross = sold * price;
		
		// 1. Calculate Facility / Ticket Fees first
		const facilityFeeRate = Number(financials?.facilityFee) || 0; 
		const ticketFees = sold * facilityFeeRate;

		// 2. Determine Tax Rate and Tax Type
		const taxRate = Number(financials?.taxRate) || 0; // E.g., 5 for 5%
		const taxType = financials?.taxType || 'Divisor'; // Default to Divisor
		
		const taxableAmount = actualGross - ticketFees;
		let taxBackedOut = 0;

		// 3. Apply the correct Tax Calculation
		if (taxType === 'Multiplier') {
			// MULTIPLIER (Tax Exclusive): Taxable Amount * (Tax Rate / 100)
			taxBackedOut = taxableAmount * (taxRate / 100);
		} else {
			// DIVISOR (Tax Inclusive): Taxable Amount - [Taxable Amount / (1 + (Tax Rate / 100))]
			taxBackedOut = taxableAmount - (taxableAmount / (1 + (taxRate / 100)));
		}
		
		// 4. Calculate Net Gross (Gross minus Fees minus Tax)
		const netGrossActual = actualGross - ticketFees - taxBackedOut;

		const potentialGross = sellable * price;

		return {
			...t, sellable, actualGross, ticketFees, taxBackedOut, netGrossActual, potentialGross, originalIndex: index
		};
	}).filter(t => t.name?.toLowerCase().includes(searchQuery.toLowerCase()));

	$: totals = processedTickets.reduce((acc, t) => {
		acc.allotment += (Number(t.allotment) || 0);
		acc.comps += (Number(t.comps) || 0);
		acc.kills += (Number(t.kills) || 0);
		acc.sellable += t.sellable;
		acc.estSold += (Number(t.estSold) || 0);
		acc.sold += (Number(t.sold) || 0);
		acc.extSold += t.extSold != null && t.extSold !== '' ? Number(t.extSold) || 0 : Number(t.sold) || 0;
		acc.actualGross += t.actualGross;
		acc.ticketFees += t.ticketFees;
		acc.taxBackedOut += t.taxBackedOut;
		acc.netGrossActual += t.netGrossActual;
		acc.potentialGross += t.potentialGross;
		return acc;
	}, {
		allotment: 0, comps: 0, kills: 0, sellable: 0, estSold: 0, sold: 0, extSold: 0, 
		actualGross: 0, ticketFees: 0, taxBackedOut: 0, netGrossActual: 0, potentialGross: 0
	});

	function addRow() {
		tickets = [...tickets, { id: crypto.randomUUID(), name: `Tier ${tickets.length + 1}`, allotment: 0, comps: 0, kills: 0, price: 0, estSold: 0, sold: 0, extSold: 0, ticketFees: 0 }];
	}

	function removeRow(id: string) {
		tickets = tickets.filter(t => t.id !== id);
	}

	// Explicit Display: "USD $0.00"
	const formatCurrency = (amount: number, currencyCode: string) => {
		try {
			const safeCode = currencyCode || 'CAD';
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: safeCode,
				currencyDisplay: 'narrowSymbol'
			}).format(amount || 0);
			return `${safeCode} ${num}`;
		} catch (e) {
			return `CAD $${amount || 0}`;
		}
	};

	// --- EDITABLE CURRENCY UX ---
	let editingCell: string | null = null; // Tracks which currency cell is actively being typed in

	// Action to auto-focus the input when it swaps from text to input
	function focusInput(node: HTMLInputElement) {
		setTimeout(() => node.focus(), 10);
	}

	// Action to auto-select all content when an input gains focus
	function selectOnFocus(node: HTMLInputElement) {
		const handler = () => requestAnimationFrame(() => node.select());
		node.addEventListener('focus', handler);
		return {
			destroy() {
				node.removeEventListener('focus', handler);
			}
		};
	}

	function handleFocus(idx: number, field: string) {
		if (tickets[idx][field] === 0 || tickets[idx][field] === '0') {
			tickets[idx][field] = null; 
		}
	}

	function checkEmpty(e: Event, field: string, idx: number) {
		const val = tickets[idx][field];
		if (val === null || val === undefined || val === '') {
			tickets[idx][field] = field === 'name' ? 'Unnamed' : 0;
		}
	}

	function downloadCSV() {
		const headerLabels = columns.filter(c => c.id !== 'drag' && c.id !== 'action').map(c => c.label);
		const csvRows = [headerLabels.join(',')];
		for (const t of processedTickets) {
			const values = [`"${t.name || ''}"`, t.allotment, t.comps, t.kills, t.sellable, t.price, t.estSold, t.sold, t.extSold ?? t.sold, t.actualGross, t.ticketFees, t.taxBackedOut, t.netGrossActual];
			csvRows.push(values.join(','));
		}
		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', 'Event_Revenue_Tickets.csv');
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	function handleImport(e: CustomEvent<any[]>) {
		const newTickets = e.detail.map((t: any) => ({
			...t,
			extSold: t.extSold ?? (Number(t.sold) || 0)
		}));
		tickets = [...tickets, ...newTickets];
	}
</script>

<style>
	input[type=number]::-webkit-outer-spin-button,
	input[type=number]::-webkit-inner-spin-button {
		-webkit-appearance: none; appearance: none; margin: 0;
	}
	input[type=number] {
		-moz-appearance: textfield; appearance: textfield;
	}

	.resizer {
		position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
		cursor: col-resize; user-select: none; background: transparent; border: none; z-index: 10;
	}
	
</style>

<section class="space-y-4 pt-3 pl-2">
	<h3 class="text-xl font-black text-lime uppercase tracking-widest">Tickets</h3>

	<div class="flex flex-wrap items-center justify-between gap-4">
		<div class="flex-1 max-w-sm">
			<input type="text" placeholder="Search tickets" bind:value={searchQuery} class="w-full bg-gray1  rounded-3xl px-4 py-1.5 text-white placeholder-gray2/40 focus:border-lime border-2  border-navbar focus:outline-none text-sm" />
		</div>
		<div class="flex items-center gap-3">
			<button on:click={openTicketTemplates} class="flex items-center gap-2 px-4 py-2 bg-navbar text-gray2 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:cursor-pointer hover:text-white transition-colors">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline stroke-linecap="round" stroke-linejoin="round" stroke-width="2" points="17 21 17 13 7 13 7 21"></polyline></svg> Load Template
			</button>
			<button on:click={() => showImportModal = true} class="flex items-center gap-2 px-4 py-2 bg-navbar text-gray2 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:cursor-pointer hover:text-white transition-colors">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> Import CSV
			</button>
			<button on:click={downloadCSV} class="flex items-center gap-2 px-4 py-2 bg-navbar text-gray2 text-sm font-bold rounded-3xl hover:bg-gray2/10 hover:cursor-pointer hover:text-white transition-colors">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download CSV
			</button>
			<button on:click={addRow} class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:cursor-pointer hover:opacity-90 transition-colors">+ Create Ticket</button>
		</div>
	</div>

	<div class="w-full bg-navbar overflow-hidden">
		<table class="w-full text-xs text-white border-collapse">
			
			<colgroup>
				{#each columns as col, i}
					<col 
						style="width: {col.width}%; {resizingColIndex === i ? 'border: 1px solid #c4ef9b; background-color: rgba(196, 239, 155, 0.05);' : ''}" 
					/>
				{/each}
			</colgroup>

			<thead class="text-xs tracking-wider text-gray3">
				<tr>
					{#each columns as col, i}
						<th class="relative px-2 py-3 {col.id === 'name' ? 'text-left' : (col.id === 'drag' || col.id === 'action' ? 'text-center' : 'text-right')}">
							<span class="truncate block">{col.label}</span>
							{#if col.id !== 'drag' && col.id !== 'action'}
								<button type="button" class="resizer" aria-label="Resize column" on:mousedown={(e) => startResize(e, i)}></button>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-gray2/10">
				{#each processedTickets as row (row.id)}
					<tr class="transition-colors border-b border-gray2/10 {draggingRowIndex === row.originalIndex && hideOriginal ? 'opacity-30 bg-gray2/10' : ''}" draggable="true" on:dragstart={(e) => handleDragStart(e, row.originalIndex)} on:dragend={handleDragEnd} on:dragover={handleDragOver} on:drop={(e) => handleDrop(e, row.originalIndex)}>
						<td 
							class="px-2 py-2 text-center cursor-grab active:cursor-grabbing text-gray2 hover:text-white border border-gray1"
							on:mousedown={() => isDragHandle = true}
							on:mouseup={() => isDragHandle = false}
							on:mouseleave={() => isDragHandle = false}
						>
							<svg class="w-4 h-4 mx-auto pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path></svg>
						</td>

						<td class="px-2 py-2 border border-gray1">
							<input type="text" use:selectOnFocus bind:value={tickets[row.originalIndex].name} on:blur={(e) => checkEmpty(e, 'name', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none truncate text-left" />
						</td>
						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].allotment} on:focus={() => handleFocus(row.originalIndex, 'allotment')} on:blur={(e) => checkEmpty(e, 'allotment', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].comps} on:focus={() => handleFocus(row.originalIndex, 'comps')} on:blur={(e) => checkEmpty(e, 'comps', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].kills} on:focus={() => handleFocus(row.originalIndex, 'kills')} on:blur={(e) => checkEmpty(e, 'kills', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						<td class="px-2 py-2 text-white bg-gray2/5 font-medium truncate text-right border border-gray1">{row.sellable}</td>
						
						<td class="px-2 py-2 border border-gray1 cursor-text" on:click={() => editingCell = `${row.id}-price`}>
							{#if editingCell === `${row.id}-price`}
								<input 
									use:focusInput
									use:selectOnFocus
									type="number" 
									step="0.01" 
									bind:value={tickets[row.originalIndex].price} 
									on:focus={() => handleFocus(row.originalIndex, 'price')} 
									on:blur={(e) => { checkEmpty(e, 'price', row.originalIndex); editingCell = null; }} 
									class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right text-white font-medium" 
								/>
							{:else}
								<div class="w-full text-right truncate text-gray2">{formatCurrency(row.price, currency)}</div>
							{/if}
						</td>

						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].estSold} on:focus={() => handleFocus(row.originalIndex, 'estSold')} on:blur={(e) => checkEmpty(e, 'estSold', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						{#if isHoldMode}
							<td class="px-2 py-2 text-white font-medium truncate bg-gray2/5 text-right border border-gray1">{formatCurrency(row.potentialGross, currency)}</td>
						{:else}
						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].sold} on:input={(e) => syncExtSold(row.originalIndex, e)} on:focus={() => handleFocus(row.originalIndex, 'sold')} on:blur={(e) => checkEmpty(e, 'sold', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						<td class="px-2 py-2 border border-gray1">
							<input type="number" use:selectOnFocus bind:value={tickets[row.originalIndex].extSold} on:blur={(e) => checkEmpty(e, 'extSold', row.originalIndex)} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right" />
						</td>
						
						<td class="px-2 py-2 text-gray2 font-medium truncate bg-gray2/5 text-right border border-gray1">{formatCurrency(row.actualGross, currency)}</td>
						
						<td class="px-2 py-2 text-gray2 font-medium truncate bg-gray2/5 text-right border border-gray1">
							{formatCurrency(row.ticketFees, currency)}
						</td>
						
						<td class="px-2 py-2 text-gray2 font-medium truncate text-right border bg-gray2/5 border-gray1">{formatCurrency(row.taxBackedOut, currency)}</td>
						<td class="px-2 py-2 text-gray2 font-bold truncate text-right border bg-gray2/5 border-gray1">{formatCurrency(row.netGrossActual, currency)}</td>
						{/if}
						
						<td class="px-0 py-0 text-center border border-gray1"><button on:click={() => removeRow(row.id)} class="w-full h-full min-h-[32px] px-2 py-2 text-gray2 hover:text-red-500 hover:bg-problem/20 hover:cursor-pointer transition-colors font-bold text-lg block">×</button></td>
					</tr>
				{/each}
			</tbody>
			<tfoot class="bg-gray3/2 font-bold border-t border-gray1 text-xs">
				<tr>
					<td class="px-2 py-4 " colspan="2"></td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.allotment}</td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.comps}</td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.kills}</td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.sellable}</td>
					<td class="px-2 py-4 "></td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.estSold}</td>
					{#if isHoldMode}
						<td class="px-2 py-4 text-lime truncate text-right " title={formatCurrency(totals.potentialGross, currency)}>{formatCurrency(totals.potentialGross, currency)}</td>
					{:else}
					<td class="px-2 py-4 text-white truncate text-right ">{totals.sold}</td>
					<td class="px-2 py-4 text-white truncate text-right ">{totals.extSold}</td>
					
					<td class="px-2 py-4 text-lime truncate text-right " title={formatCurrency(totals.actualGross, currency)}>{formatCurrency(totals.actualGross, currency)}</td>
					<td class="px-2 py-4 text-lime truncate text-right " title={formatCurrency(totals.ticketFees, currency)}>{formatCurrency(totals.ticketFees, currency)}</td>
					<td class="px-2 py-4 text-lime truncate text-right " title={formatCurrency(totals.taxBackedOut, currency)}>{formatCurrency(totals.taxBackedOut, currency)}</td>
					<td class="px-2 py-4 text-lime truncate text-right " title={formatCurrency(totals.netGrossActual, currency)}>{formatCurrency(totals.netGrossActual, currency)}</td>
					{/if}
					
					<td class=""></td>
				</tr>
			</tfoot>
		</table>
	</div>

	{#if showTemplateModal}
		<div
			use:portal
			class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
			transition:fade={{ duration: 150 }}
		>
			<div
				class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden max-h-[80vh]"
				transition:fly={{ y: 20, duration: 200 }}
			>
				<div class="p-6 border-b border-gray2/10 flex justify-between items-center shrink-0">
					<h2 class="text-xl font-bold text-white tracking-wide">Load Ticket Scaling</h2>
					<button
						type="button"
						class="text-gray2 hover:text-white transition-colors cursor-pointer"
						on:click={() => (showTemplateModal = false)}
						aria-label="Close"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
					</button>
				</div>
				<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2">
					{#if templatesLoading}
						<p class="text-gray2 font-bold text-sm py-4 text-center">Loading templates...</p>
					{:else}
						{#each ticketTemplates as t (t.id)}
							<button
								type="button"
								on:click={() => applyTicketTemplate(t)}
								class="flex items-center justify-between bg-gray1 rounded-2xl px-4 py-3 text-left hover:bg-gray1/60 transition-colors cursor-pointer group"
							>
								<div>
									<p class="text-white font-bold text-sm group-hover:text-lime transition-colors">{t.name}</p>
									<p class="text-gray2 text-xs font-medium mt-0.5">
										{t.tickets.length} tiers · {t.addMode?.tickets !== false
											? 'adds to current scaling'
											: 'overwrites current scaling'}
									</p>
								</div>
								<span class="text-xs font-black uppercase tracking-widest text-gray2 group-hover:text-lime transition-colors">Apply →</span>
							</button>
						{:else}
							<p class="text-gray2 text-sm font-bold py-4 text-center">
								No Ticket Scaling templates yet — create one in Settings → Templates.
							</p>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</section>

<ImportRevenueCSV bind:isOpen={showImportModal} on:import={handleImport} />