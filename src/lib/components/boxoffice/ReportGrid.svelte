<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { BOX_OFFICE_CATEGORIES, CATEGORY_CONFIG } from '$lib/components/boxoffice/defaults';

    export let reportData: any;
    const dispatch = createEventDispatcher();

    // --- History Tracking (Undo / Redo) ---
    let history: any[] = [];
    let historyIndex = -1;
    let historyTimeout: ReturnType<typeof setTimeout>;
    let currentEventId: number | null = null;

    // Reset history cleanly when switching between events
    $: if (reportData) {
        if (reportData.event_id !== currentEventId) {
            currentEventId = reportData.event_id;
            clearTimeout(historyTimeout);
            history = [];
            historyIndex = -1;
            pushHistory(reportData);
        }
    }

    function pushHistory(dataToSave: any) {
        if (!dataToSave) return;
        const snapshot = JSON.stringify(dataToSave);
        
        // Prevent saving identical back-to-back states
        if (historyIndex >= 0 && JSON.stringify(history[historyIndex]) === snapshot) return;

        // If we are pushing a new change, slice off any "future" redos
        history = history.slice(0, historyIndex + 1);
        history.push(JSON.parse(snapshot));
        
        // Keep a max of 50 states to prevent memory bloat
        if (history.length > 50) history.shift();
        else historyIndex = history.length - 1;
    }

    function scheduleHistorySave() {
        clearTimeout(historyTimeout);
        // Debounce history captures by 400ms so a single word type equals one undo step
        historyTimeout = setTimeout(() => {
            pushHistory(reportData);
        }, 400);
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            const restored = history[historyIndex];
            const updates: any = {};
            BOX_OFFICE_CATEGORIES.forEach(cat => {
                if (restored[cat]) updates[cat] = restored[cat];
            });
            dispatch('update', updates);
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            const restored = history[historyIndex];
            const updates: any = {};
            BOX_OFFICE_CATEGORIES.forEach(cat => {
                if (restored[cat]) updates[cat] = restored[cat];
            });
            dispatch('update', updates);
        }
    }

    function handleGlobalKeydown(e: KeyboardEvent) {
        // Detect if the user is typing inside the grid
        const activeElement = document.activeElement;
        const isInsideGrid = activeElement?.closest('.report-grid-container');

        // Check for Cmd (Mac) or Ctrl (Windows)
        if ((e.metaKey || e.ctrlKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === 'z' || key === 'y') {
                // If they are typing in an input outside our grid (e.g. search bar), let standard OS undo handle it
                if (activeElement && activeElement.tagName === 'INPUT' && !isInsideGrid) return;
                e.preventDefault();
                
                // Redo: Cmd+Shift+Z or Ctrl+Y
                if (key === 'y' || (key === 'z' && e.shiftKey)) {
                    redo();
                } else {
                    // Undo: Cmd+Z
                    undo();
                }
            }
        }
    }
    // --------------------------------------

    // --- DRAG AND DROP ---
    let draggingRowIndex: number | null = null;
    let draggingCategory: string | null = null;
    let hideOriginal = false;
    let isDragHandle = false;

    function handleDragStart(e: DragEvent, category: string, index: number) {
        if (!isDragHandle) {
            e.preventDefault();
            return;
        }

        draggingRowIndex = index;
        draggingCategory = category;
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
            tableWrapper.className = 'w-full text-left text-[13px] border-collapse';
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

    function handleDrop(e: DragEvent, category: string, dropIndex: number) {
        e.preventDefault();
        if (draggingRowIndex !== null && draggingCategory === category && draggingRowIndex !== dropIndex) {
            const clone = [...reportData[category]];
            const movedItem = clone.splice(draggingRowIndex, 1)[0];
            clone.splice(dropIndex, 0, movedItem);
            
            dispatch('update', { [category]: clone });
            scheduleHistorySave();
        }
        draggingRowIndex = null;
        draggingCategory = null;
        isDragHandle = false;
    }

    function handleDragEnd() {
        draggingRowIndex = null;
        draggingCategory = null;
        hideOriginal = false;
        isDragHandle = false;
    }
    // --------------------------------------

    function updateItem(category: string, index: number, field: string, value: any) {
        const newData = [...reportData[category]];
        newData[index][field] = value;

        // ENFORCE: Table Tickets scanned = sold (unless prepaid)
        if (category === 'table_tickets') {
            const isPrepaid = (newData[index].ticket || '').toLowerCase().includes('prepaid');
            if (!isPrepaid) {
                newData[index].scanned = newData[index].sold;
            }
        }

        dispatch('update', { [category]: newData });
        scheduleHistorySave();
    }

    function addItem(category: string) {
        const newData = [...reportData[category], {
            id: crypto.randomUUID(),
            ticket: '', category: '', tier: '', price: null, sold: null, scanned: null,
            allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true
        }];
        dispatch('update', { [category]: newData });
        scheduleHistorySave();
    }

    function removeItem(category: string, index: number) {
        const newData = reportData[category].filter((_: any, i: number) => i !== index);
        dispatch('update', { [category]: newData });
        scheduleHistorySave();
    }

    function formatCurrency(val: number | null) {
        if (val === null || val === undefined) return '';
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
    }

    const EDITABLE_COLS = ['ticket', 'category', 'tier', 'price', 'sold', 'scanned'];

    function handleKeydown(e: KeyboardEvent, category: string, r: number, colName: string) {
        const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (!keys.includes(e.key)) return;

        const target = e.currentTarget as HTMLInputElement;

        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }

        if (target.type === 'text') {
            if (e.key === 'ArrowLeft' && target.selectionStart !== 0) return;
            if (e.key === 'ArrowRight' && target.selectionEnd !== target.value.length) return;
        }

        let c = EDITABLE_COLS.indexOf(colName);
        let nextR = r;
        let nextC = c;

        if (e.key === 'ArrowUp') nextR--;
        if (e.key === 'ArrowDown') nextR++;
        if (e.key === 'ArrowLeft') nextC--;
        if (e.key === 'ArrowRight') nextC++;

        let targetInput: HTMLInputElement | null = null;
        while (nextC >= 0 && nextC < EDITABLE_COLS.length) {
            targetInput = document.querySelector(`input[data-category="${category}"][data-row="${nextR}"][data-col="${EDITABLE_COLS[nextC]}"]:not([disabled])`) as HTMLInputElement | null;
            if (targetInput) break;
            
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') break;
            if (e.key === 'ArrowLeft') nextC--;
            else if (e.key === 'ArrowRight') nextC++;
            else break;
        }

        if (targetInput) {
            e.preventDefault();
            targetInput.focus();
            setTimeout(() => targetInput?.select(), 0);
        }
    }

    // --- Smart 2D Spreadsheet Paste Handler ---
    function handlePaste(e: ClipboardEvent, category: string, startRowIndex: number, startColName: string) {
        const pasteData = e.clipboardData?.getData('text');
        if (!pasteData) return;

        // If it's a single value without tabs or newlines, let the default browser paste handle it
        if (!pasteData.includes('\n') && !pasteData.includes('\t')) return;
        e.preventDefault();

        // Split by newlines to get rows
        const rows = pasteData.split(/\r?\n/).filter(r => r.trim() !== '');
        const newData = [...reportData[category]];
        const startColIndex = EDITABLE_COLS.indexOf(startColName);

        if (startColIndex === -1) return;

        for (let i = 0; i < rows.length; i++) {
            const targetRowIndex = startRowIndex + i;

            // Auto-expand: Create new rows if we paste past the current end of the category
            if (targetRowIndex >= newData.length) {
                newData.push({
                    id: crypto.randomUUID(),
                    ticket: '', category: '', tier: '', price: null, sold: null, scanned: null,
                    allowPrice: true, allowSold: true, allowScanned: true, allowEntry: true
                });
            }

            // Split by tabs to get columns
            const pastedCols = rows[i].split(/\t/);
            for (let j = 0; j < pastedCols.length; j++) {
                const currentColIndex = startColIndex + j;
                if (currentColIndex >= EDITABLE_COLS.length) break;

                const colName = EDITABLE_COLS[currentColIndex];
                const rawVal = pastedCols[j].trim();
                const item = newData[targetRowIndex];

                // Respect field permissions
                if (colName === 'price' && item.allowPrice === false) continue;
                if (colName === 'sold' && item.allowSold === false) continue;
                if (colName === 'scanned' && item.allowScanned === false) continue;

                // Format depending on the column type
                if (colName === 'price') {
                    const parsed = parseFloat(rawVal.replace(/[^0-9.-]+/g, ""));
                    item[colName] = isNaN(parsed) ? null : parsed;
                } else if (colName === 'sold' || colName === 'scanned') {
                    const parsed = parseInt(rawVal.replace(/[^0-9-]/g, ''), 10);
                    item[colName] = isNaN(parsed) ? null : parsed;
                } else {
                    item[colName] = rawVal;
                }
            }
        }

        // ENFORCE: Table Tickets rule on pasted data
        if (category === 'table_tickets') {
            newData.forEach(item => {
                const isPrepaid = (item.ticket || '').toLowerCase().includes('prepaid');
                if (!isPrepaid) {
                    item.scanned = item.sold;
                }
            });
        }

        dispatch('update', { [category]: newData });
        scheduleHistorySave();
    }

    // Reactive category subtotals
    $: categoryTotals = BOX_OFFICE_CATEGORIES.reduce((acc: any, cat: string) => {
        let sold = 0;
        let scanned = 0;
        let settle = 0;
        if (reportData && reportData[cat]) {
            reportData[cat].forEach((item: any) => {
                const itemSold = item.sold || 0;
                let itemScanned = item.scanned || 0;

                // ENFORCE: Table Tickets rule for subtotals
                if (cat === 'table_tickets' && !(item.ticket || '').toLowerCase().includes('prepaid')) {
                    itemScanned = itemSold;
                }

                sold += itemSold;
                scanned += itemScanned;
                settle += (item.price || 0) * itemSold;
            });
        }
        
        // Custom Rule: Door scanned equals sold sum
        if (cat === 'door') {
            scanned = sold; 
        }

        acc[cat] = { sold, scanned, settle };
        return acc;
    }, {});

</script>

<style>
    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }
    input[type=number] {
        -moz-appearance: textfield;
        appearance: textfield;
    }
</style>

<svelte:window on:keydown={handleGlobalKeydown} />

<div class="report-grid-container p-4 text-white h-full overflow-y-auto pb-24">
    <h1 class="text-xl font-black uppercase mb-4 text-gray3">Scan Report</h1>

    {#each BOX_OFFICE_CATEGORIES as category}
        <div class="mb-6">
            <div class="flex justify-between items-center pb-2 border-b border-gray1 mb-2">
                <h2 class="text-md font-bold uppercase text-lime">{category === 'table_tickets' ? 'Table' : category.replace('_', ' ')}</h2>
                
                {#if CATEGORY_CONFIG[category]?.allowAdd}
                    <button class="text-xs font-bold text-lime border border-lime/30 rounded-3xl px-3 py-1 hover:bg-lime hover:text-black transition-colors cursor-pointer" on:click={() => addItem(category)}>+ Add Item</button>
                {/if}
            </div>

            <div class="w-full overflow-x-auto">
                <table class="w-full text-left text-[13px] border-collapse">
                    <thead>
                        <tr class="text-gray2 text-[10px] uppercase tracking-wider">
                            <th class="p-1 w-6"></th>
                            <th class="p-1 font-semibold w-1/4">Ticket Name</th>
                            <th class="p-1 font-semibold w-20">Category</th>
                            <th class="p-1 font-semibold w-20">Tier</th>
                            <th class="p-1 font-semibold w-10 text-center">$ Price</th>
                            <th class="p-1 font-semibold w-10 text-right"># Sold</th>
                            <th class="p-1 font-semibold w-10 text-right"># Scanned</th>
                            <th class="p-1 font-semibold w-20 text-right">% Entry</th>
                            <th class="p-1 font-semibold w-30 text-right">Settle</th>
                            <th class="p-1 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each reportData[category] || [] as item, i}
                            {@const isTableNonPrepaid = category === 'table_tickets' && !(item.ticket || '').toLowerCase().includes('prepaid')}
                            
                            {@const currentGroup = (item.ticket || '').split('-')[0].trim()}
                            {@const nextItem = reportData[category] ? reportData[category][i + 1] : null}
                            {@const nextGroup = nextItem ? (nextItem.ticket || '').split('-')[0].trim() : null}
                            {@const isGroupEnd = category === 'online' && nextGroup !== null && currentGroup !== nextGroup && currentGroup !== ''}

                            {@const allowPrice = item.allowPrice !== false}
                            {@const allowSold = item.allowSold !== false}
                            {@const allowScanned = item.allowScanned !== false && !isTableNonPrepaid}
                            {@const allowEntry = item.allowEntry !== false}
                            
                            {@const safeSold = item.sold || 0}
                            {@const safeScanned = isTableNonPrepaid ? safeSold : (item.scanned || 0)}
                            {@const safePrice = item.price || 0}
                            {@const entryPct = allowEntry && safeSold > 0 ? (safeScanned / safeSold) * 100 : 0}
                            {@const settle = safePrice * safeSold}
                            
                            <tr class="transition-colors group hover:bg-white/[0.02] {isGroupEnd ? 'border-b border-gray1' : ''} {draggingRowIndex === i && draggingCategory === category && hideOriginal ? 'opacity-30 bg-gray2/10' : ''}" 
                                draggable="true" 
                                on:dragstart={(e) => handleDragStart(e, category, i)} 
                                on:dragend={handleDragEnd} 
                                on:dragover={handleDragOver} 
                                on:drop={(e) => handleDrop(e, category, i)}>
                                
                                <td class="p-0.5 text-center cursor-grab active:cursor-grabbing text-gray2 hover:text-white"
                                    on:mousedown={() => isDragHandle = true}
                                    on:mouseup={() => isDragHandle = false}
                                    on:mouseleave={() => isDragHandle = false}>
                                    <svg class="w-4 h-4 mx-auto pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path></svg>
                                </td>

                                <td class="p-0.5">
                                    <input type="text" data-category={category} data-row={i} data-col="ticket" class="w-full bg-transparent px-2 py-1 focus:bg-white/10 outline-none rounded" value={item.ticket} on:input={(e) => updateItem(category, i, 'ticket', (e.currentTarget as HTMLInputElement).value)} on:keydown={(e) => handleKeydown(e, category, i, 'ticket')} on:paste={(e) => handlePaste(e, category, i, 'ticket')} />
                                </td>
                                <td class="p-0.5">
                                    <input type="text" data-category={category} data-row={i} data-col="category" class="w-full bg-transparent px-2 py-1 focus:bg-white/10 outline-none rounded" value={item.category} on:input={(e) => updateItem(category, i, 'category', (e.currentTarget as HTMLInputElement).value)} on:keydown={(e) => handleKeydown(e, category, i, 'category')} on:paste={(e) => handlePaste(e, category, i, 'category')} />
                                </td>
                                <td class="p-0.5">
                                    <input type="text" data-category={category} data-row={i} data-col="tier" class="w-full bg-transparent px-2 py-1 focus:bg-white/10 outline-none rounded" value={item.tier} on:input={(e) => updateItem(category, i, 'tier', (e.currentTarget as HTMLInputElement).value)} on:keydown={(e) => handleKeydown(e, category, i, 'tier')} on:paste={(e) => handlePaste(e, category, i, 'tier')} />
                                </td>
                                <td class="p-0.5">
                                    {#if allowPrice}
                                        <input type="text" 
                                            data-category={category} data-row={i} data-col="price"
                                            class="w-full bg-transparent px-2 py-1 text-center text-lime focus:bg-white/10 outline-none rounded" 
                                            value={formatCurrency(item.price)}
                                            on:focus={(e) => { 
                                                const target = e.currentTarget as HTMLInputElement;
                                                target.value = item.price !== null ? item.price.toString() : '';
                                            }}
                                            on:blur={(e) => { 
                                                const target = e.currentTarget as HTMLInputElement;
                                                const valStr = target.value.replace(/[^0-9.-]+/g, "");
                                                const val = valStr === "" ? null : parseFloat(valStr);
                                                updateItem(category, i, 'price', val);
                                                target.value = formatCurrency(val);
                                            }}
                                            on:keydown={(e) => { 
                                                if (e.key === 'Enter') {
                                                    (e.currentTarget as HTMLInputElement).blur();
                                                } 
                                                handleKeydown(e, category, i, 'price');
                                            }}
                                            on:paste={(e) => handlePaste(e, category, i, 'price')}
                                        />
                                    {:else}
                                        <div class="w-full text-center px-2 py-1 opacity-30">—</div>
                                    {/if}
                                </td>
                                <td class="p-0.5">
                                    {#if allowSold}
                                        <input type="number" 
                                            data-category={category} data-row={i} data-col="sold"
                                            class="w-full bg-transparent px-2 py-1 text-right focus:bg-white/10 outline-none rounded" 
                                            value={item.sold ?? ''} 
                                            on:input={(e) => {
                                                const v = (e.currentTarget as HTMLInputElement).value;
                                                updateItem(category, i, 'sold', v === '' ? null : parseInt(v, 10));
                                            }} 
                                            on:keydown={(e) => handleKeydown(e, category, i, 'sold')}
                                            on:paste={(e) => handlePaste(e, category, i, 'sold')}
                                        />
                                    {:else}
                                        <div class="w-full text-right px-2 py-1 opacity-30">—</div>
                                    {/if}
                                </td>
                                <td class="p-0.5">
                                    {#if category === 'door'}
                                        <div class="w-full text-right px-2 py-1 opacity-30">—</div>
                                    {:else}
                                        <input type="number" 
                                            data-category={category} data-row={i} data-col="scanned"
                                            class="w-full bg-transparent px-2 py-1 text-right focus:bg-white/10 outline-none rounded disabled:opacity-30 disabled:cursor-not-allowed" 
                                            value={isTableNonPrepaid ? (item.sold ?? '') : (item.scanned ?? '')} 
                                            disabled={!allowScanned}
                                            on:input={(e) => {
                                                const v = (e.currentTarget as HTMLInputElement).value;
                                                updateItem(category, i, 'scanned', v === '' ? null : parseInt(v, 10));
                                            }} 
                                            on:keydown={(e) => handleKeydown(e, category, i, 'scanned')}
                                            on:paste={(e) => handlePaste(e, category, i, 'scanned')}
                                        />
                                    {/if}
                                </td>
                                <td class="p-0.5 text-right text-xs text-gray3 font-bold">
                                    {#if allowEntry}
                                        {entryPct.toFixed(1)}%
                                    {:else}
                                        <span class="opacity-30">—</span>
                                    {/if}
                                </td>
                                <td class="p-0.5 text-right font-black text-white text-sm">
                                    {formatCurrency(settle)}
                                </td>
                                <td class="p-0.5 text-center align-middle">
                                    <button class="text-problem cursor-pointer hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" on:click={() => removeItem(category, i)}>✖</button>
                                </td>
                            </tr>
                        {/each}

                        {#if !reportData[category] || reportData[category].length === 0}
                            <tr>
                                <td colspan="10" class="p-4 text-center text-gray2 italic text-xs">No items in {category}</td>
                            </tr>
                        {:else}
                            {@const totals = categoryTotals[category]}
                            {@const entryPct = totals.sold > 0 ? (totals.scanned / totals.sold) * 100 : 0}
                            <tr class="bg-white/[0.03] border-t border-gray1 font-bold">
                                <td colspan="5" class="p-2 text-right text-gray2 uppercase text-[10px] tracking-wider">Subtotal</td>
                                <td class="p-2 text-right text-white">{totals.sold}</td>
                                <td class="p-2 text-right text-white">{totals.scanned}</td>
                                <td class="p-2 text-right text-lime">
                                    {#if category === 'online'}
                                        {entryPct.toFixed(2)}%
                                    {:else}
                                        <span class="opacity-30">—</span>
                                    {/if}
                                </td>
                                <td class="p-2 text-right text-white">{formatCurrency(totals.settle)}</td>
                                <td></td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    {/each}
</div>