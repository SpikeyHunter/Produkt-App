<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { COMPLETED_BY_NAMES, BOX_OFFICE_CATEGORIES } from '$lib/components/boxoffice/defaults';

    export let reportData: any;
    export let isBookingUser = false;
    const dispatch = createEventDispatcher();

    $: totalSold = calculateMetric('sold');
    $: totalScanned = calculateMetric('scanned');
    $: totalSettle = calculateTotalSettle();

    function calculateMetric(key: 'sold' | 'scanned') {
        let total = 0;
        BOX_OFFICE_CATEGORIES.forEach(cat => {
            if (reportData[cat]) {
                reportData[cat].forEach((item: any) => total += (item[key] || 0));
            }
        });
        return total;
    }

    function calculateTotalSettle() {
        let total = 0;
        BOX_OFFICE_CATEGORIES.forEach(cat => {
            if (reportData[cat]) {
                reportData[cat].forEach((item: any) => {
                    total += (item.price || 0) * (item.sold || 0);
                });
            }
        });
        return total;
    }

    function formatCurrency(val: number) {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
    }
</script>

<div class="h-full bg-navbar flex flex-col overflow-y-auto">
    <div class="p-4 border-b border-gray2/20">
        <h3 class="text-xs font-bold text-gray3 mb-4 uppercase tracking-wider">Actions</h3>
        <div class="flex flex-col gap-2">
            <button class="w-full py-2 rounded-lg font-bold text-sm bg-gray1 text-gray3 cursor-not-allowed opacity-50 flex items-center justify-center gap-2" disabled>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                Import from TIXR
            </button>
            <button class="w-full py-2 rounded-lg font-bold text-sm bg-gray1 text-gray3 cursor-not-allowed opacity-50 flex items-center justify-center gap-2" disabled>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                Export PDF
            </button>
        </div>
    </div>

    <div class="p-4 border-b border-gray2/20 flex-1">
        <h3 class="text-xs font-bold text-gray3 mb-4 uppercase tracking-wider">Report Info</h3>
        
        <label class="block mb-4">
            <span class="text-[10px] text-gray2 uppercase font-bold block mb-1">Completed By</span>
            <select 
                class="w-full bg-black/40 border border-gray1 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-lime"
                value={reportData.completed_by || ''}
                on:change={(e) => dispatch('update', { completed_by: (e.target as HTMLSelectElement).value })}
            >
                <option value="" disabled>Select Team Member...</option>
                {#each COMPLETED_BY_NAMES as name}
                    <option value={name}>{name}</option>
                {/each}
            </select>
        </label>

        {#if reportData.status === 'approved'}
            <div class="mt-4 p-3 rounded-lg bg-[#86EFAC]/10 border border-[#86EFAC]/30">
                <p class="text-[10px] text-[#86EFAC] uppercase font-bold mb-1">Approved By</p>
                <p class="text-sm text-white font-medium">{reportData.approved_by}</p>
                <p class="text-xs text-gray2 mt-1">{new Date(reportData.approved_at).toLocaleString()}</p>
            </div>
        {/if}
    </div>

    {#if isBookingUser}
        <div class="p-5 bg-black/50 border-t border-gray2/20 mt-auto">
            <h3 class="text-xs font-bold text-gray3 mb-4 uppercase tracking-wider text-center">Summary</h3>
            
            <div class="flex justify-between items-center mb-3 text-sm">
                <span class="text-gray2">Total Sold</span>
                <span class="text-white font-bold">{totalSold}</span>
            </div>
            
            <div class="flex justify-between items-center mb-4 text-sm">
                <span class="text-gray2">Total Scanned</span>
                <span class="text-white font-bold">{totalScanned}</span>
            </div>

            <div class="pt-4 border-t border-gray1 flex justify-between items-center">
                <span class="text-lime font-black uppercase tracking-wide">Gross</span>
                <span class="text-lime font-black text-xl">{formatCurrency(totalSettle)}</span>
            </div>
        </div>
    {:else}
        <div class="p-5 bg-black/50 border-t border-gray2/20 mt-auto text-center">
            <p class="text-xs text-gray2 italic">Summary details restricted.</p>
        </div>
    {/if}
</div>