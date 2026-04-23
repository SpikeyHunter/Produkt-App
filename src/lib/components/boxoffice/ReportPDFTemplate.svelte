<script lang="ts">
    import { BOX_OFFICE_CATEGORIES } from './defaults';

    export let reportData: any;
    export let selectedEvent: any;
    export let theme: 'color' | 'bw' = 'bw';
    export let rowLimit: number = 25; // Dynamic row limit prop

    $: isBW = theme === 'bw';
    $: bgMain = isBW ? 'bg-white' : 'bg-[#1e1e1e]';
    $: textMain = isBW ? 'text-black' : 'text-white';
    $: borderLine = isBW ? 'border-gray-400' : 'border-[#333333]';
    $: headerBg = isBW ? 'bg-gray-100' : 'bg-[#2a2a2a]';
    $: accentText = isBW ? 'text-black' : 'text-[#E1FF00]';

    function formatCurrency(val: number) {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
    }

    function formatDate(dateStr: string) {
        if (!dateStr) return 'TBD';
        try {
            const [year, month, day] = dateStr.split('-').map((x) => parseInt(x, 10));
            const date = new Date(year, month - 1, day);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    // Process table data per category
    $: categoriesData = BOX_OFFICE_CATEGORIES.map(cat => {
        const items = (reportData[cat] || []).filter((item: any) => item.ticket || (item.sold && item.sold > 0));
        
        let subSold = 0;
        let subScanned = 0;
        let subSettle = 0;

        items.forEach((item: any) => {
            const sold = item.sold || 0;
            let scanned = item.scanned || 0;
            
            if (cat === 'table_tickets' && !(item.ticket || '').toLowerCase().includes('prepaid')) {
                scanned = sold;
            }
        
            if (cat === 'door') {
                scanned = sold; // Special rule
            }

            subSold += sold;
            subScanned += scanned;
            subSettle += (item.price || 0) * sold;
        });

        if (cat === 'door') subScanned = subSold;

        return { id: cat, title: cat === 'table_tickets' ? 'Table' : cat.replace('_', ' '), items, subSold, subScanned, subSettle };
    }).filter(c => c.items.length > 0);

    // Global Totals
    $: summary = (() => {
        let sold = 0;
        let scanned = 0;
        let gross = 0;
        let onlineSold = 0;
        let onlineScanned = 0;

        categoriesData.forEach(c => {
            if (c.id === 'other') return; // Exclude 'other' from main gross

            sold += c.subSold;
            scanned += c.subScanned;
            gross += c.subSettle;

            if (c.id === 'online') {
                onlineSold = c.subSold;
                onlineScanned = c.subScanned;
            }
        });

        const net = gross / 1.14975;
        const onlineEntryPct = onlineSold > 0 ? (onlineScanned / onlineSold) * 100 : 0;
        const noShowPct = onlineSold > 0 ? Math.max(0, 100 - onlineEntryPct) : 0;

        return { sold, scanned, gross, net, noShowPct };
    })();

    // PAGINATION LOGIC: DYNAMIC DATA ROWS PER PAGE
    $: pages = (() => {
        const ROW_LIMIT = rowLimit; // Using the dynamic limit

        const result: Array<{ categories: any[], rowCount: number, hasSummary: boolean }> = [];
        let currentPage = { categories: [] as any[], rowCount: 0, hasSummary: false };

        categoriesData.forEach(cat => {
            let remainingItems = [...cat.items];
            let isContinued = false;

            while (remainingItems.length > 0) {
                const spaceLeft = ROW_LIMIT - currentPage.rowCount;

                if (remainingItems.length <= spaceLeft) {
                    currentPage.categories.push({
                        ...cat,
                        items: remainingItems,
                        showSubtotal: true, // Only show subtotal on the last chunk
                        isContinued: isContinued
                    });
                    currentPage.rowCount += remainingItems.length;
                    remainingItems = [];
                } else {
                    if (currentPage.rowCount === 0) {
                        const chunk = remainingItems.slice(0, ROW_LIMIT);
                        currentPage.categories.push({
                            ...cat,
                            items: chunk,
                            showSubtotal: false,
                            isContinued: isContinued
                        });
                        currentPage.rowCount += ROW_LIMIT;
                        remainingItems = remainingItems.slice(ROW_LIMIT);
                        isContinued = true; 

                        result.push(currentPage);
                        currentPage = { categories: [], rowCount: 0, hasSummary: false };
                    } else {
                        result.push(currentPage);
                        currentPage = { categories: [], rowCount: 0, hasSummary: false };
                    }
                }
            }
        });

        if (currentPage.categories.length > 0) {
            // Buffer: Assume summary visually takes up ~3 rows of space
            if (currentPage.rowCount + 3 > ROW_LIMIT) {
                result.push(currentPage);
                result.push({ categories: [], rowCount: 0, hasSummary: true });
            } else {
                currentPage.hasSummary = true;
                result.push(currentPage);
            }
        } else {
            if (result.length === 0) {
                result.push({ categories: [], rowCount: 0, hasSummary: true });
            } else {
                result.push({ categories: [], rowCount: 0, hasSummary: true });
            }
        }

        return result;
    })();
</script>

<div class="w-[8.5in] {bgMain} {textMain} font-sans" id="pdf-report-container">
    
    {#each pages as page, pageIdx}
        
        {#if pageIdx > 0}
            <div style="break-before: page; page-break-before: always; clear: both; width: 100%; height: 1px;"></div>
        {/if}

        <div class="p-6 {pageIdx > 0 ? 'pt-8' : ''}">
            
            {#if pageIdx === 0}
                <div class="flex justify-between items-center border-b-2 {borderLine} pb-4 mb-5">
                    <div class="flex flex-col">
                        <h1 class="text-2xl font-black uppercase tracking-widest {accentText} mb-1 leading-none">
                            Scan Report
                        </h1>
                        <h2 class="text-lg font-bold leading-tight mb-2">{selectedEvent?.event_name || selectedEvent?.artist_name || 'Event'}</h2>
                        <div class="flex items-center gap-2 text-[10px] font-medium opacity-70">
                            <span>Completed By: {reportData?.completed_by?.length ? reportData.completed_by.join(', ') : 'N/A'}</span>
                            <span class="opacity-50">•</span>
                            <span>{formatDate(selectedEvent?.event_date)}</span>
                            <span class="opacity-50">•</span>
                            <span class="font-mono">ID: {selectedEvent?.event_id}</span>
                        </div>
                    </div>
                    <div class="flex items-center justify-end">
                        <img 
                            src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/NCG_ProduktXX_NOIR.png" 
                            alt="Logo" 
                            class="h-16 max-w-[240px] object-contain object-right"
                            style="{isBW ? '' : 'filter: invert(1);'} image-rendering: high-quality; transform: translateZ(0);"
                        />
                    </div>
                </div>
            {/if}

            <div class="flex flex-col gap-3">
                {#each page.categories as cat, catIdx}
                    {@const showHeader = cat.id === 'online' || (pageIdx > 0 && catIdx === 0)}
                    
                    <div>
                        <table class="w-full text-left text-[10px] border-collapse table-fixed">
                            
                            <colgroup>
                                <col style="width: 30%;" />
                                <col style="width: 10%;" />
                                <col style="width: 10%;" />
                                <col style="width: 10%;" />
                                <col style="width: 10%;" />
                                <col style="width: 10%;" />
                                <col style="width: 8%;" />
                                <col style="width: 12%;" />
                            </colgroup>

                            {#if showHeader}
                                <thead>
                                    <tr class="{headerBg} text-[8px] uppercase tracking-wider">
                                        <th class="py-[2.5px] px-2 font-bold rounded-l-sm">Ticket</th>
                                        <th class="py-[2.5px] px-2 font-bold">Category</th>
                                        <th class="py-[2.5px] px-2 font-bold">Tier</th>
                                        <th class="py-[2.5px] px-2 font-bold text-center">$ Price</th>
                                        <th class="py-[2.5px] px-2 font-bold text-right"># Sold</th>
                                        <th class="py-[2.5px] px-2 font-bold text-right"># Scanned</th>
                                        <th class="py-[2.5px] px-2 font-bold text-right">% Entry</th>
                                        <th class="py-[2.5px] px-2 font-bold text-right rounded-r-sm">Settle</th>
                                    </tr>
                                </thead>
                            {/if}
                            
                            <tbody>
                                {#if showHeader}
                                    <tr><td colspan="8" class="h-1"></td></tr>
                                {/if}

                                {#each cat.items as item}
                                    {@const safeSold = item.sold || 0}
                                    {@const isTableNonPrepaid = cat.id === 'table_tickets' && !(item.ticket || '').toLowerCase().includes('prepaid')}
                                    {@const safeScanned = isTableNonPrepaid ? safeSold : (item.scanned || 0)}
                                    {@const entryPct = (item.allowEntry !== false && safeSold > 0) ? (safeScanned / safeSold) * 100 : null}
                                    
                                    <tr class="opacity-90">
                                        <td class="py-[2.5px] px-2 font-semibold leading-tight">{item.ticket}</td>
                                        <td class="py-[2.5px] px-2 leading-tight">{item.category}</td>
                                        <td class="py-[2.5px] px-2 leading-tight">{item.tier}</td>
                                        <td class="py-[2.5px] px-2 text-center leading-tight">{item.price !== null ? formatCurrency(item.price) : '—'}</td>
                                        <td class="py-[2.5px] px-2 text-right leading-tight">{item.sold ?? '—'}</td>
                                        <td class="py-[2.5px] px-2 text-right leading-tight">{(item.allowScanned !== false || cat.id === 'door') ? safeScanned : '—'}</td>
                                        <td class="py-[2.5px] px-2 text-right leading-tight">{entryPct !== null ? `${entryPct.toFixed(1)}%` : '—'}</td>
                                        <td class="py-[2.5px] px-2 text-right font-bold leading-tight">{formatCurrency((item.price || 0) * safeSold)}</td>
                                    </tr>
                                {/each}
                                
                                {#if cat.showSubtotal}
                                    <tr><td colspan="8" class="h-1"></td></tr>

                                    <tr class="{headerBg} font-bold text-[9px] uppercase">
                                        <td colspan="4" class="py-[2.5px] px-2 text-right rounded-l-sm">Subtotal {cat.title}</td>
                                        <td class="py-[2.5px] px-2 text-right">{cat.subSold}</td>
                                        <td class="py-[2.5px] px-2 text-right">{cat.subScanned}</td>
                                        <td class="py-[2.5px] px-2 text-right">
                                        {cat.id === 'online' && cat.subSold > 0 ? `${((cat.subScanned / cat.subSold) * 100).toFixed(2)}%` : '—'}
                                        </td>
                                        <td class="py-[2.5px] px-2 text-right rounded-r-sm {accentText}">{formatCurrency(cat.subSettle)}</td>
                                    </tr>
                                {/if}
                            </tbody>
                        </table>
                    </div>
                {/each}
            </div>

            {#if page.hasSummary}
                <div class="mt-5">
                    <h3 class="text-xs font-bold uppercase mb-1 {accentText}">Summary</h3>
                    <table class="w-full text-left text-[10px] border-collapse table-fixed">
                        <thead>
                            <tr class="{headerBg} text-[8px] uppercase tracking-wider">
                                <th class="py-[2.5px] px-2 font-bold rounded-l-sm w-1/5">Total Sold</th>
                                <th class="py-[2.5px] px-2 font-bold w-1/5">Total Scanned</th>
                                <th class="py-[2.5px] px-2 font-bold w-1/5">No Show %</th>
                                <th class="py-[2.5px] px-2 font-bold text-right w-1/5">Total Gross</th>
                                <th class="py-[2.5px] px-2 font-bold text-right rounded-r-sm w-1/5">Total Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td colspan="5" class="h-1"></td></tr>

                            <tr class="opacity-90">
                                <td class="py-[2.5px] px-2 font-bold leading-tight">{summary.sold}</td>
                                <td class="py-[2.5px] px-2 font-bold leading-tight">{summary.scanned}</td>
                                <td class="py-[2.5px] px-2 font-bold text-red-500 leading-tight">{summary.noShowPct.toFixed(2)}%</td>
                                <td class="py-[2.5px] px-2 font-bold text-right leading-tight">{formatCurrency(summary.gross)}</td>
                                <td class="py-[2.5px] px-2 font-black {accentText} text-right leading-tight">{formatCurrency(summary.net)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            {/if}

        </div>
    {/each}

</div>

<style>
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
</style>