<script lang="ts">
	export let group: any;
	export let currency: string = 'CAD';
	export let onRemove: () => void;
	export let triggerSave: () => void;

	const categories = ['General', 'Production','Marketing', 'Talent', 'Sponsor', 'Additional'];
	const types = [
		'(No Type)',
		'General',
		'Venue',
		'Talent',
		'Hospitality',
		'Travel',
		'Additional',
		'Brand',
		'Sponsor',
		'Merch',
		'Bar'
	];

	// Custom Dropdowns logic
	let showCategory = false;
	let showType = false;

	function selectCategory(c: string) {
		group.category = c;
		showCategory = false;
		triggerSave();
	}
	function selectType(t: string) {
		group.type = t;
		showType = false;
		triggerSave();
	}

	function handleWindowClick(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (showCategory && !target.closest(`#cat-wrap-${group.id}`)) showCategory = false;
		if (showType && !target.closest(`#type-wrap-${group.id}`)) showType = false;
	}

	// Remove logic
	let deleteConfirm = false;
	let deleteTimeout: any;

	function handleDeleteClick() {
		if (deleteConfirm) {
			onRemove();
		} else {
			deleteConfirm = true;
			clearTimeout(deleteTimeout);
			deleteTimeout = setTimeout(() => {
				deleteConfirm = false;
			}, 3000);
		}
	}

	function addRow() {
		group.costs = [
			...group.costs,
			{
				id: crypto.randomUUID(),
				name: `Cost ${group.costs.length + 1}`,
				qty: 1,
				cost: 0,
				estimatedInternal: 0,
				actualInternal: 0,
				externalSettlement: 0,
				internalNotes: '',
				externalNotes: '',
				reported: true
			}
		];
		triggerSave();
	}

	function removeRow(id: string) {
		group.costs = group.costs.filter((c: any) => c.id !== id);
		triggerSave();
	}

	const formatCurrency = (amount: number, currencyCode: string) => {
		try {
			const safeCode = currencyCode || 'CAD';
			const num = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: safeCode,
				currencyDisplay: 'narrowSymbol'
			}).format(amount || 0);
			return `${safeCode}${num}`;
		} catch (e) {
			return `CAD$${amount || 0}`;
		}
	};

	const formatDiff = (amount: number, currencyCode: string) => {
		if (amount === 0) return '';
		const isNegative = amount < 0;
		const formatted = formatCurrency(Math.abs(amount), currencyCode);
		return isNegative ? `(${formatted})` : formatted;
	};

	// --- Focus State Management ---
	let focusedCell: { rowId: string; field: string } | null = null;

	function setFocus(rowId: string, field: string) {
		focusedCell = { rowId, field };
	}

	function removeFocus(e: Event, field: string, idx: number, rowId: string) {
		focusedCell = null;
		checkEmpty(e, field, idx);
	}

	// Custom action to replace "autofocus" and satisfy a11y rules
	function focusOnMount(node: HTMLInputElement) {
		node.focus();
		node.select();
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

	function checkEmpty(e: Event, field: string, idx: number) {
		const val = group.costs[idx][field];
		if (val === null || val === undefined || val === '') {
			group.costs[idx][field] = field === 'name' ? 'Unnamed' : 0;
		}
		triggerSave();
	}

	// --- COLUMNS & RESIZING LOGIC ---
	let columns = [
		{ id: 'drag', label: '', width: 3 },
		{ id: 'name', label: 'Name', width: 12 },
		{ id: 'qty', label: 'QTY', width: 5 },
		{ id: 'cost', label: 'Cost', width: 8 },
		{ id: 'offerBudget', label: 'Offer Budget', width: 9 },
		{ id: 'estimatedInternal', label: 'Est. Internal', width: 10 },
		{ id: 'actualInternal', label: 'Actual Internal', width: 10 },
		{ id: 'externalSettlement', label: 'Ext. Settlement', width: 10 },
		{ id: 'internalNotes', label: 'Internal Notes', width: 11 },
		{ id: 'externalNotes', label: 'External Notes', width: 11 },
		{ id: 'reported', label: 'Reported', width: 6 },
		{ id: 'remove', label: 'Remove', width: 5 }
	];

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
		const diff = ((e.pageX - startX) / window.innerWidth) * 100;
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
	let isDragHandle = false;

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

			const originalCells = Array.from(target.children);
			Array.from(clone.getElementsByTagName('td')).forEach((td, i) => {
				td.style.backgroundColor = '#1A1A1A';
				td.style.borderColor = 'transparent';
				td.style.width = `${originalCells[i].getBoundingClientRect().width}px`;
				td.style.boxSizing = 'border-box';
			});

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
			e.dataTransfer.setDragImage(tableWrapper, 20, 20);

			setTimeout(() => {
				if (document.body.contains(tableWrapper)) document.body.removeChild(tableWrapper);
			}, 0);
		}
		setTimeout(() => {
			hideOriginal = true;
		}, 0);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
	}

	function handleDrop(e: DragEvent, dropIndex: number) {
		e.preventDefault();
		if (draggingRowIndex !== null && draggingRowIndex !== dropIndex) {
			const clone = [...group.costs];
			const movedItem = clone.splice(draggingRowIndex, 1)[0];
			clone.splice(dropIndex, 0, movedItem);
			group.costs = clone;
			triggerSave();
		}
		draggingRowIndex = null;
		isDragHandle = false;
	}

	function handleDragEnd() {
		draggingRowIndex = null;
		hideOriginal = false;
		isDragHandle = false;
	}

	// Calculate footers
	$: totals = (group?.costs || []).reduce(
		(acc: any, c: any) => {
			const rowCost = (Number(c.qty) || 0) * (Number(c.cost) || 0);

			acc.cost += rowCost;
			acc.estimated += Number(c.estimatedInternal) || 0;
			acc.actual += Number(c.actualInternal) || 0;

			if (c.reported) {
				acc.offerBudget += rowCost;
				acc.settlement += Number(c.externalSettlement) || 0;
			}
			return acc;
		},
		{ cost: 0, offerBudget: 0, estimated: 0, actual: 0, settlement: 0 }
	);

	$: totalActualDiff = totals.cost - totals.actual;
	$: totalExternalDiff = totals.offerBudget - totals.settlement;
</script>

<svelte:window on:click={handleWindowClick} />

<div class="w-full flex flex-col gap-3">
	<div class="flex items-center justify-between">
		<div class="flex items-center gap-3">
			<div id="cat-wrap-{group.id}" class="relative flex flex-col gap-1 w-32">
				<label
					for="cat-btn-{group.id}"
					class="text-xs pl-2 text-gray3 uppercase tracking-wider font-bold">Category</label
				>
				<button
					id="cat-btn-{group.id}"
					on:click={() => (showCategory = !showCategory)}
					class="w-full text-left bg-navbar text-white border border-gray1 rounded-3xl px-4 py-1.5 text-sm hover:cursor-pointer flex items-center justify-between transition-colors focus:border-lime"
				>
					{group.category}
					<svg class="w-4 h-4 text-gray2 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						></path></svg
					>
				</button>
				{#if showCategory}
					<div
						class="absolute top-[52px] left-0 w-full bg-gray1 border border-navbar rounded-xl shadow-xl z-50 overflow-hidden"
					>
						{#each categories as cat}
							<button
								on:click={() => selectCategory(cat)}
								class="w-full text-left px-4 py-2 text-sm text-white hover:text-lime hover:bg-navbar hover:cursor-pointer transition-colors"
								>{cat}</button
							>
						{/each}
					</div>
				{/if}
			</div>

			<div id="type-wrap-{group.id}" class="relative flex flex-col gap-1 w-40">
				<label
					for="type-btn-{group.id}"
					class="text-xs pl-2 text-gray3 uppercase tracking-wider font-bold">Type</label
				>
				<button
					id="type-btn-{group.id}"
					on:click={() => (showType = !showType)}
					class="w-full text-left bg-navbar text-white border border-gray1 rounded-3xl px-4 py-1.5 text-sm hover:cursor-pointer flex items-center justify-between transition-colors focus:border-lime"
				>
					{group.type}
					<svg class="w-4 h-4 text-gray2 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						></path></svg
					>
				</button>
				{#if showType}
					<div
						class="absolute top-[52px] left-0 w-full bg-gray1 border border-navbar rounded-xl shadow-xl z-50 overflow-y-auto max-h-60 custom-scrollbar"
					>
						{#each types as t}
							<button
								on:click={() => selectType(t)}
								class="w-full text-left px-4 py-2 text-sm text-white hover:text-lime hover:bg-navbar hover:cursor-pointer transition-colors"
								>{t}</button
							>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<div class="flex items-center gap-3">
			<button
				on:click={addRow}
				class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:opacity-90 transition-colors hover:cursor-pointer"
			>
				Create Fixed Cost
			</button>
			<button
				on:click={handleDeleteClick}
				class="w-9 h-9 flex items-center justify-center rounded-3xl border transition-all hover:cursor-pointer {deleteConfirm
					? 'bg-red-500 border-red-500 text-white'
					: 'bg-transparent border-gray1 border-2 text-gray2 hover:border-red-500 hover:text-problem'}"
				title="Remove Cost Group"
			>
				{#if deleteConfirm}
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						></path></svg
					>
				{:else}
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						></path></svg
					>
				{/if}
			</button>
		</div>
	</div>

	<div class="w-full bg-navbar overflow-hidden border border-gray1 rounded-sm mt-2">
		<table class="w-full text-xs text-white border-collapse">
			<colgroup>
				{#each columns as col, i}
					<col
						style="width: {col.width}%; {resizingColIndex === i
							? 'border: 1px solid #c4ef9b; background-color: rgba(196, 239, 155, 0.05);'
							: ''}"
					/>
				{/each}
			</colgroup>

			<thead class="text-xs tracking-wider text-gray2 font-bold bg-navbar border-b border-gray1">
				<tr>
					{#each columns as col, i}
						<th
							class="relative px-2 py-3 {col.id === 'name' ||
							col.id === 'internalNotes' ||
							col.id === 'externalNotes'
								? 'text-left'
								: col.id === 'drag' || col.id === 'remove' || col.id === 'reported'
									? 'text-center'
									: 'text-right'}"
						>
							<span class="truncate block">{col.label}</span>
							{#if col.id !== 'drag' && col.id !== 'remove'}
								<button
									type="button"
									class="resizer"
									aria-label="Resize column"
									on:mousedown={(e) => startResize(e, i)}
								></button>
							{/if}
						</th>
					{/each}
				</tr>
			</thead>

			<tbody class="divide-y divide-gray1 bg-gray1/20">
				{#each group?.costs || [] as row, index (row?.id || index)}
					{@const offerBudget = (Number(row.qty) || 0) * (Number(row.cost) || 0)}
					{@const actualDiff = offerBudget - (Number(row.actualInternal) || 0)}
					{@const externalDiff = offerBudget - (Number(row.externalSettlement) || 0)}

					<tr
						class="transition-colors border-b border-gray1 {draggingRowIndex === index &&
						hideOriginal
							? 'opacity-30 bg-gray2/10'
							: ''}"
						draggable="true"
						on:dragstart={(e) => handleDragStart(e, index)}
						on:dragend={handleDragEnd}
						on:dragover={handleDragOver}
						on:drop={(e) => handleDrop(e, index)}
					>
						<td
							class="px-2 py-3 text-center cursor-grab active:cursor-grabbing text-gray2 hover:text-white border-r border-gray1"
							on:mousedown={() => (isDragHandle = true)}
							on:mouseup={() => (isDragHandle = false)}
							on:mouseleave={() => (isDragHandle = false)}
						>
							<svg
								class="w-4 h-4 mx-auto pointer-events-none"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 8h16M4 16h16"
								></path></svg
							>
						</td>

						<td class="px-3 py-2 border-r border-gray1">
							<input
								type="text"
								use:selectOnFocus
								bind:value={row.name}
								on:blur={(e) => checkEmpty(e, 'name', index)}
								class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none truncate text-left"
							/>
						</td>
						<td class="px-2 py-2 border-r border-gray1">
							<input
								type="number"
								use:selectOnFocus
								bind:value={row.qty}
								on:blur={(e) => checkEmpty(e, 'qty', index)}
								class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-center"
							/>
						</td>

						<td class="px-2 py-2 border-r border-gray1 text-right">
							{#if focusedCell?.rowId === row.id && focusedCell?.field === 'cost'}
								<input
									type="number"
									step="0.01"
									bind:value={row.cost}
									on:blur={(e) => removeFocus(e, 'cost', index, row.id)}
									class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
									use:focusOnMount
								/>
							{:else}
								<div
									class="w-full text-right cursor-text"
									role="button"
									tabindex="0"
									on:click={() => setFocus(row.id, 'cost')}
									on:keydown={(e) => e.key === 'Enter' && setFocus(row.id, 'cost')}
								>
									{formatCurrency(row.cost, currency)}
								</div>
							{/if}
						</td>

						<td
							class="px-2 py-2 border-r border-gray1 text-right font-medium bg-black/20 {row.reported
								? 'text-gray2'
								: 'text-gray2/50 line-through'}"
						>
							{formatCurrency(offerBudget, currency)}
						</td>

						<td class="px-2 py-2 border-r border-gray1 text-right">
							{#if focusedCell?.rowId === row.id && focusedCell?.field === 'estimatedInternal'}
								<input
									type="number"
									step="0.01"
									bind:value={row.estimatedInternal}
									on:blur={(e) => removeFocus(e, 'estimatedInternal', index, row.id)}
									class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
									use:focusOnMount
								/>
							{:else}
								<div
									class="w-full text-right cursor-text"
									role="button"
									tabindex="0"
									on:click={() => setFocus(row.id, 'estimatedInternal')}
									on:keydown={(e) => e.key === 'Enter' && setFocus(row.id, 'estimatedInternal')}
								>
									{formatCurrency(row.estimatedInternal, currency)}
								</div>
							{/if}
						</td>

						<td class="px-2 py-2 border-r border-gray1 relative align-top pt-3 pb-1 text-right">
							{#if focusedCell?.rowId === row.id && focusedCell?.field === 'actualInternal'}
								<input
									type="number"
									step="0.01"
									bind:value={row.actualInternal}
									on:blur={(e) => removeFocus(e, 'actualInternal', index, row.id)}
									class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
									use:focusOnMount
								/>
							{:else}
								<div
									class="w-full text-right cursor-text"
									role="button"
									tabindex="0"
									on:click={() => setFocus(row.id, 'actualInternal')}
									on:keydown={(e) => e.key === 'Enter' && setFocus(row.id, 'actualInternal')}
								>
									{formatCurrency(row.actualInternal, currency)}
								</div>
							{/if}

							{#if actualDiff !== 0}
								<div
									class="text-right text-[10px] mt-1 pr font-bold {actualDiff > 0
										? 'text-confirmed'
										: 'text-problem'}"
								>
									{formatDiff(actualDiff, currency)}
								</div>
							{/if}
						</td>

						<td class="px-2 py-2 border-r border-gray1 relative align-top pt-3 pb-1 text-right">
							<div class={row.reported ? '' : 'invisible pointer-events-none'}>
								{#if focusedCell?.rowId === row.id && focusedCell?.field === 'externalSettlement'}
									<input
										type="number"
										step="0.01"
										bind:value={row.externalSettlement}
										on:blur={(e) => removeFocus(e, 'externalSettlement', index, row.id)}
										class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
										disabled={!row.reported}
										use:focusOnMount
									/>
								{:else}
									<div
										class="w-full text-right cursor-text"
										role="button"
										tabindex="0"
										on:click={() => {
											if (row.reported) setFocus(row.id, 'externalSettlement');
										}}
										on:keydown={(e) => {
											if (e.key === 'Enter' && row.reported) setFocus(row.id, 'externalSettlement');
										}}
									>
										{formatCurrency(row.externalSettlement, currency)}
									</div>
								{/if}

								{#if externalDiff !== 0}
									<div
										class="text-right text-[10px] mt-1 pr font-bold {externalDiff > 0
											? 'text-confirmed'
											: 'text-problem'}"
									>
										{formatDiff(externalDiff, currency)}
									</div>
								{/if}
							</div>
						</td>

						<td class="px-3 py-2 border-r border-gray1">
							<input
								type="text"
								use:selectOnFocus
								bind:value={row.internalNotes}
								on:change={triggerSave}
								class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none truncate text-left text-gray3 focus:text-white"
							/>
						</td>
						<td class="px-3 py-2 border-r border-gray1">
							<input
								type="text"
								use:selectOnFocus
								bind:value={row.externalNotes}
								on:change={triggerSave}
								class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none truncate text-left text-gray3 focus:text-white"
							/>
						</td>

						<td class="px-2 py-2 border-r border-gray1 text-center">
							<div
								class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in"
							>
								<input
									type="checkbox"
									name="toggle"
									bind:checked={row.reported}
									on:change={triggerSave}
									id="toggle-{row.id}"
									class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-black border-4 border-gray1 appearance-none cursor-pointer z-10 left-[2px] checked:left-auto checked:right-[2px] transition-all"
								/>
								<label
									for="toggle-{row.id}"
									class="toggle-label block overflow-hidden h-6 rounded-full bg-gray1 cursor-pointer transition-colors"
								></label>
							</div>
						</td>

						<td class="px-0 py-0 text-center">
							<button
								on:click={() => removeRow(row.id)}
								class="w-full h-full min-h-[44px] px-2 text-gray2 hover:text-red-500 hover:bg-red-500/10 hover:cursor-pointer transition-colors font-bold text-lg block"
								>×</button
							>
						</td>
					</tr>
				{/each}
			</tbody>
			<tfoot class="bg-navbar font-bold text-xs">
				<tr>
					<td colspan="3"></td>
					<td class="px-2 py-4 text-white truncate text-right"
						>{formatCurrency(totals.cost, currency)}</td
					>
					<td class="px-2 py-4 text-white truncate text-right"
						>{formatCurrency(totals.offerBudget, currency)}</td
					>
					<td class="px-2 py-4 text-white truncate text-right"
						>{formatCurrency(totals.estimated, currency)}</td
					>

					<td class="px-2 py-4 text-white truncate text-right align-top">
						{formatCurrency(totals.actual, currency)}
						{#if totalActualDiff !== 0}
							<div
								class="text-[10px] mt-1 font-bold {totalActualDiff > 0
									? 'text-confirmed'
									: 'text-problem'}"
							>
								{formatDiff(totalActualDiff, currency)}
							</div>
						{/if}
					</td>

					<td class="px-2 py-4 text-white truncate text-right align-top">
						{formatCurrency(totals.settlement, currency)}
						{#if totalExternalDiff !== 0}
							<div
								class="text-[10px] mt-1 font-bold {totalExternalDiff > 0
									? 'text-confirmed'
									: 'text-problem'}"
							>
								{formatDiff(totalExternalDiff, currency)}
							</div>
						{/if}
					</td>

					<td colspan="4"></td>
				</tr>
			</tfoot>
		</table>
	</div>
</div>

<style>
	input[type='number']::-webkit-outer-spin-button,
	input[type='number']::-webkit-inner-spin-button {
		-webkit-appearance: none;
		appearance: none;
		margin: 0;
	}
	input[type='number'] {
		-moz-appearance: textfield;
		appearance: textfield;
	}

	.resizer {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		width: 5px;
		cursor: col-resize;
		user-select: none;
		background: transparent;
		border: none;
		z-index: 10;
	}

	.toggle-checkbox:checked {
		right: 0;
		border-color: #e1ff00;
	}
	.toggle-checkbox:checked + .toggle-label {
		background-color: #e1ff00;
	}
</style>