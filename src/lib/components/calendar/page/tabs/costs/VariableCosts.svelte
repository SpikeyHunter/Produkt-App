<script lang="ts">
    import { slide } from 'svelte/transition';

    export let variableCosts: any[] = [];
    export let eventRevenue: any = {};
    export let currency: string = 'CAD';
    export let triggerSave: () => void;
    export let expanded: boolean = false;

    const variableTypes = [
        'Flat',
        '% of Gross',
        '% of Net Gross',
        '$ per Paid Ticket',
        '$ per Attendee'
    ];

    // --- REVENUE MATH ---
    $: tickets = eventRevenue?.tickets || [];
    $: financials = eventRevenue?.financials || { taxRate: 0, taxType: 'Divisor', facilityFee: 0 };

    function calculateMetrics(qtyField: 'allotment' | 'estSold' | 'sold') {
        let totalTickets = 0;
        let gross = 0;
        let taxes = 0;
        let fees = 0;

        for (const t of tickets) {
            const qty = Number(t[qtyField]) || 0;
            totalTickets += qty;
            const tierGross = qty * (Number(t.price) || 0);
            gross += tierGross;
            fees += qty * (Number(t.ticketFees) || 0) + qty * (Number(financials.facilityFee) || 0);
        }

        if (financials.taxType === 'Divisor') {
            const taxRate = Number(financials.taxRate) || 0;
            const netAfterDivisor = gross / (1 + (taxRate / 100));
            taxes = gross - netAfterDivisor;
        } else {
            const taxRate = Number(financials.taxRate) || 0;
            taxes = gross * (taxRate / 100);
        }

        const netGross = gross - taxes - fees;
        return { totalTickets, gross, netGross };
    }

    $: sellableMetrics = calculateMetrics('allotment');
    $: estMetrics = calculateMetrics('estSold');
    $: actualMetrics = calculateMetrics('sold');

    function calcValue(type: string, amount: number, metrics: any) {
        amount = Number(amount) || 0;
        switch(type) {
            case 'Flat': return amount;
            case '% of Gross': return (amount / 100) * metrics.gross;
            case '% of Net Gross': return (amount / 100) * metrics.netGross;
            case '$ per Paid Ticket': return amount * metrics.totalTickets;
            case '$ per Attendee': return amount * metrics.totalTickets;
            default: return amount;
        }
    }

    // Auto-calculate row fields
    $: enrichedCosts = variableCosts.map(row => {
        const estimatedInternal = calcValue(row.type, row.internalAmount, estMetrics);
        const actualInternal = calcValue(row.type, row.internalAmount, actualMetrics);
        const externalSettlement = calcValue(row.type, row.externalAmount, actualMetrics);
        
        return { ...row, estimatedInternal, actualInternal, externalSettlement };
    });

    // Calculate Footers
    $: totals = enrichedCosts.reduce((acc, c) => {
        // ALWAYS sum Estimated and Actual
        acc.estimated += c.estimatedInternal;
        acc.actual += c.actualInternal;

        // ONLY sum Settlement if toggled on
        if (c.reported) {
            acc.settlement += c.externalSettlement;
        }
        return acc;
    }, { estimated: 0, actual: 0, settlement: 0 });

    $: totalActualDiff = totals.estimated - totals.actual;
    $: totalExternalDiff = totals.estimated - totals.settlement;

    // --- ROW ACTIONS ---
    function addRow() {
        variableCosts = [
            ...variableCosts,
            {
                id: crypto.randomUUID(),
                name: `Variable Cost ${variableCosts.length + 1}`,
                externalAmount: 0,
                internalAmount: 0,
                type: 'Flat',
                reported: true
            }
        ];
        triggerSave();
    }

    function removeRow(id: string) {
        variableCosts = variableCosts.filter((c: any) => c.id !== id);
        triggerSave();
    }

    function handleAmountSync(rowId: string, field: 'internalAmount' | 'externalAmount', value: number) {
        const rowIndex = variableCosts.findIndex(c => c.id === rowId);
        if (rowIndex === -1) return;

        const row = variableCosts[rowIndex];
        if (field === 'internalAmount' && (row.externalAmount === 0 || row.externalAmount == null)) {
            variableCosts[rowIndex].externalAmount = value;
        } else if (field === 'externalAmount' && (row.internalAmount === 0 || row.internalAmount == null)) {
            variableCosts[rowIndex].internalAmount = value;
        }
        variableCosts = variableCosts; // trigger Svelte reactivity
        triggerSave();
    }

    // --- FORMATTING ---
    const formatCurrency = (amount: number, currencyCode: string) => {
        try {
            const safeCode = currencyCode || 'CAD';
            const num = new Intl.NumberFormat('en-US', {
                style: 'currency', currency: safeCode, currencyDisplay: 'narrowSymbol'
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

    function formatInputAmount(amount: number, type: string) {
        if (type.includes('%')) return `${amount || 0}%`;
        return amount || 0; 
    }

    // --- A11Y FOCUS LOGIC ---
    let focusedCell: { rowId: string, field: string } | null = null;

    function setFocus(rowId: string, field: string) { focusedCell = { rowId, field }; }
    function removeFocus(rowId: string, field: 'internalAmount' | 'externalAmount', value: number) {
        focusedCell = null;
        if (value === null || value === undefined) {
            const rowIndex = variableCosts.findIndex(c => c.id === rowId);
            if (rowIndex > -1) {
                variableCosts[rowIndex][field] = 0;
                variableCosts = variableCosts; // trigger Svelte reactivity
            }
        }
        handleAmountSync(rowId, field, value);
    }
    function focusOnMount(node: HTMLInputElement) { node.focus(); }

    // --- COLUMNS & RESIZING LOGIC ---
    let columns = [
        { id: 'drag', label: '', width: 3 },
        { id: 'name', label: 'Name', width: 14 },
        { id: 'extAmount', label: 'Ext. Amount', width: 8 },
        { id: 'intAmount', label: 'Int. Amount', width: 8 },
        { id: 'type', label: 'Type', width: 12 },
        { id: 'estimatedInternal', label: 'Est. Internal', width: 10 },
        { id: 'actualInternal', label: 'Actual Internal', width: 10 },
        { id: 'externalSettlement', label: 'Ext. Settlement', width: 11 },
        { id: 'reported', label: 'Reported', width: 6 },
        { id: 'remove', label: 'Remove', width: 4 }
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
        if (!isDragHandle) { e.preventDefault(); return; }
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
            setTimeout(() => { if (document.body.contains(tableWrapper)) document.body.removeChild(tableWrapper); }, 0);
        }
        setTimeout(() => { hideOriginal = true; }, 0);
    }
    function handleDragOver(e: DragEvent) { e.preventDefault(); }
    function handleDrop(e: DragEvent, dropIndex: number) {
        e.preventDefault();
        if (draggingRowIndex !== null && draggingRowIndex !== dropIndex) {
            const clone = [...variableCosts];
            const movedItem = clone.splice(draggingRowIndex, 1);
            clone.splice(dropIndex, 0, movedItem);
            variableCosts = clone;
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
</script>

<section class="flex flex-col mt-6">
    <div 
        class="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none px-4 py-3 rounded-t-xl transition-colors {expanded ? 'bg-gray1/80' : 'hover:bg-gray1'}"
        role="button"
        tabindex="0"
        on:click={() => expanded = !expanded}
        on:keydown={(e) => e.key === 'Enter' && (expanded = !expanded)}
    >
        <div class="flex items-center gap-2">
            <svg class="w-6 h-6 text-lime transition-transform {expanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
            <h3 class="text-xl font-black text-lime tracking-wide">Variable Costs</h3>
        </div>
        
        <div class="flex items-center gap-6 text-sm font-bold text-gray2">
            <div>Estimated: <span class="text-white">{formatCurrency(totals.estimated, currency)}</span></div>
            <div>/ Actual: <span class="text-white">{formatCurrency(totals.actual, currency)}</span></div>
        </div>
    </div>

    {#if expanded}
        <div transition:slide|local class="px-0 pb-6 rounded-b-xl border-t border-gray1/10">
            <div class="flex justify-end py-4">
                <button
                    on:click={addRow}
                    class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:opacity-90 transition-colors hover:cursor-pointer"
                >
                    Create Variable Cost
                </button>
            </div>

            <div class="w-full overflow-hidden border-y border-gray1 mt-2">
                <table class="w-full text-xs text-white border-collapse">
                    <colgroup>
                        {#each columns as col, i}
                            <col style="width: {col.width}%; {resizingColIndex === i ? 'border: 1px solid #c4ef9b; background-color: rgba(196, 239, 155, 0.05);' : ''}" />
                        {/each}
                    </colgroup>

                    <thead class="text-xs tracking-wider text-gray2 font-bold bg-navbar border-b border-gray1">
                        <tr>
                            {#each columns as col, i}
                                <th class="relative px-2 py-3 {col.id === 'name' ? 'text-left' : (col.id === 'drag' || col.id === 'remove' || col.id === 'reported' ? 'text-center' : 'text-right')}">
                                    <span class="truncate block">{col.label}</span>
                                    {#if col.id !== 'drag' && col.id !== 'remove'}
                                        <button type="button" class="resizer" aria-label="Resize column" on:mousedown={(e) => startResize(e, i)}></button>
                                    {/if}
                                </th>
                            {/each}
                        </tr>
                    </thead>

                    <tbody class="divide-y divide-gray1 bg-transparent">
                        {#each variableCosts as row, index (row.id)}
                            {@const enriched = enrichedCosts[index] || {}}
                            {@const actualDiff = (enriched.estimatedInternal || 0) - (enriched.actualInternal || 0)}
                            {@const externalDiff = (enriched.estimatedInternal || 0) - (enriched.externalSettlement || 0)}

                            <tr
                                class="transition-colors border-b border-gray1 {draggingRowIndex === index && hideOriginal ? 'opacity-30 bg-gray2/10' : ''}"
                                draggable="true"
                                on:dragstart={(e) => handleDragStart(e, index)}
                                on:dragend={handleDragEnd}
                                on:dragover={handleDragOver}
                                on:drop={(e) => handleDrop(e, index)}
                            >
                                <td class="px-2 py-3 text-center cursor-grab active:cursor-grabbing text-gray2 hover:text-white border-r border-gray1"
                                    on:mousedown={() => (isDragHandle = true)} on:mouseup={() => (isDragHandle = false)} on:mouseleave={() => (isDragHandle = false)}>
                                    <svg class="w-4 h-4 mx-auto pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h16M4 16h16"></path></svg>
                                </td>

                                <td class="px-3 py-2 border-r border-gray1">
                                    <input type="text" bind:value={row.name} on:blur={triggerSave} class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none truncate text-left" />
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 text-right">
                                    {#if focusedCell?.rowId === row.id && focusedCell?.field === 'externalAmount'}
                                        <input
                                            type="number"
                                            step="0.01"
                                            bind:value={row.externalAmount}
                                            on:blur={() => removeFocus(row.id, 'externalAmount', row.externalAmount)}
                                            class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
                                            use:focusOnMount
                                        />
                                    {:else}
                                        <div 
                                            class="w-full text-right cursor-text" 
                                            role="button" tabindex="0"
                                            on:click={() => setFocus(row.id, 'externalAmount')}
                                            on:keydown={(e) => e.key === 'Enter' && setFocus(row.id, 'externalAmount')}
                                        >
                                            {formatInputAmount(row.externalAmount, row.type)}
                                        </div>
                                    {/if}
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 text-right">
                                    {#if focusedCell?.rowId === row.id && focusedCell?.field === 'internalAmount'}
                                        <input
                                            type="number"
                                            step="0.01"
                                            bind:value={row.internalAmount}
                                            on:blur={() => removeFocus(row.id, 'internalAmount', row.internalAmount)}
                                            class="w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-right"
                                            use:focusOnMount
                                        />
                                    {:else}
                                        <div 
                                            class="w-full text-right cursor-text" 
                                            role="button" tabindex="0"
                                            on:click={() => setFocus(row.id, 'internalAmount')}
                                            on:keydown={(e) => e.key === 'Enter' && setFocus(row.id, 'internalAmount')}
                                        >
                                            {formatInputAmount(row.internalAmount, row.type)}
                                        </div>
                                    {/if}
                                </td>

                                <td class="px-2 py-2 border-r border-gray1">
                                    <select 
                                        bind:value={row.type} 
                                        on:change={triggerSave} 
                                        class="w-full bg-transparent text-white border-b border-transparent focus:border-lime focus:outline-none text-xs hover:cursor-pointer"
                                    >
                                        {#each variableTypes as t}
                                            <option value={t} class="bg-navbar text-white">{t}</option>
                                        {/each}
                                    </select>
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 text-right">
                                    {formatCurrency(enriched.estimatedInternal, currency)}
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 relative align-top pt-3 pb-1 text-right">
                                    {formatCurrency(enriched.actualInternal, currency)}
                                    {#if actualDiff !== 0}
                                        <div class="text-right text-[10px] mt-1 pr font-bold {actualDiff > 0 ? 'text-confirmed' : 'text-problem'}">
                                            {formatDiff(actualDiff, currency)}
                                        </div>
                                    {/if}
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 relative align-top pt-3 pb-1 text-right">
                                    <div class={row.reported ? '' : 'invisible'}>
                                        {formatCurrency(enriched.externalSettlement, currency)}
                                        {#if externalDiff !== 0}
                                            <div class="text-right text-[10px] mt-1 pr font-bold {externalDiff > 0 ? 'text-confirmed' : 'text-problem'}">
                                                {formatDiff(externalDiff, currency)}
                                            </div>
                                        {/if}
                                    </div>
                                </td>

                                <td class="px-2 py-2 border-r border-gray1 text-center">
                                    <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                                        <input type="checkbox" bind:checked={row.reported} on:change={triggerSave} id="toggle-var-{row.id}" class="toggle-checkbox absolute block w-6 h-6 rounded-full bg-black border-4 border-gray1 appearance-none cursor-pointer z-10 left-[2px] checked:left-auto checked:right-[2px] transition-all" />
                                        <label for="toggle-var-{row.id}" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray1 cursor-pointer transition-colors"></label>
                                    </div>
                                </td>

                                <td class="px-0 py-0 text-center">
                                    <button on:click={() => removeRow(row.id)} class="w-full h-full min-h-[44px] px-2 text-gray2 hover:text-red-500 hover:bg-red-500/10 hover:cursor-pointer transition-colors font-bold text-lg block">×</button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>

                    <tfoot class="bg-navbar font-bold text-xs">
                        <tr>
                            <td colspan="5"></td>
                            <td class="px-2 py-4 text-white truncate text-right">{formatCurrency(totals.estimated, currency)}</td>
                            <td class="px-2 py-4 text-white truncate text-right align-top">
                                {formatCurrency(totals.actual, currency)}
                                {#if totalActualDiff !== 0}
                                    <div class="text-[10px] mt-1 font-bold {totalActualDiff > 0 ? 'text-confirmed' : 'text-problem'}">
                                        {formatDiff(totalActualDiff, currency)}
                                    </div>
                                {/if}
                            </td>
                            <td class="px-2 py-4 text-white truncate text-right align-top">
                                {formatCurrency(totals.settlement, currency)}
                                {#if totalExternalDiff !== 0}
                                    <div class="text-[10px] mt-1 font-bold {totalExternalDiff > 0 ? 'text-confirmed' : 'text-problem'}">
                                        {formatDiff(totalExternalDiff, currency)}
                                    </div>
                                {/if}
                            </td>
                            <td colspan="2"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    {/if}
</section>

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
        position: absolute; right: 0; top: 0; bottom: 0; width: 5px;
        cursor: col-resize; user-select: none; background: transparent; border: none; z-index: 10;
    }

    .toggle-checkbox:checked { right: 0; border-color: #e1ff00; }
    .toggle-checkbox:checked + .toggle-label { background-color: #e1ff00; }
</style>