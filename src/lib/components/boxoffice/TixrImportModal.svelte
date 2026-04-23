<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import Modal from '$lib/components/modals/Modal.svelte';

    export let isOpen = false;
    export let eventId: number | null = null;

    const dispatch = createEventDispatcher();

    let loading = true;
    let error: string | null = null;
    
    let allTickets: any[] = [];
    let showHiddenTickets = false;

    // Derived states based on the backend's isHidden flag
    $: goodTickets = allTickets.filter(t => !t.isHidden);
    $: hiddenTickets = allTickets.filter(t => t.isHidden);
    
    // Master Checkbox State tracking
    $: isAllSelected = goodTickets.length > 0 && goodTickets.every(t => t.selected) && (!showHiddenTickets || hiddenTickets.every(t => t.selected));

    onMount(async () => {
        if (!eventId) {
            error = "No event ID selected.";
            loading = false;
            return;
        }

        try {
            const res = await fetch(`/api/tixr/import?eventId=${eventId}`);
           
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Failed to fetch from Tixr');
            
            // Transform data: divide price by 4 for "GA 4x" tickets
            allTickets = (data.tickets || []).map((t: any) => {
                const ticketName = (t.ticket || '').toLowerCase();
                const originalName = (t.originalName || '').toLowerCase();
                
                let adjustedPrice = t.price;
                if (ticketName.includes('ga 4x') || originalName.includes('ga 4x')) {
                    if (typeof adjustedPrice === 'number') {
                        adjustedPrice = adjustedPrice / 4;
                    }
                }
                
                return {
                    ...t,
                    price: adjustedPrice
                };
            });

        } catch (err: any) {
            error = err.message;
        } finally {
            loading = false;
        }
    });

    function formatCurrency(val: number) {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val);
    }

    function toggleAll() {
        const targetState = !isAllSelected;

        const visibleIds = new Set(goodTickets.map(t => t.id));
        if (showHiddenTickets) {
            hiddenTickets.forEach(t => visibleIds.add(t.id));
        }

        allTickets = allTickets.map(t => {
            if (visibleIds.has(t.id)) {
                return { ...t, selected: targetState };
            }
            return t;
        });
    }

    function handleImport() {
        const selectedTickets = allTickets.filter(t => t.selected);
        dispatch('import', selectedTickets);
    }
</script>

<Modal {isOpen} title="Import Tickets from TIXR" maxWidth="max-w-4xl" hasFooter={true} on:close>
    
    <div class="flex justify-between items-center mb-4 pb-4 border-b border-gray1">
        <div class="text-sm text-gray2">
            Review and map Tixr data before importing.
        </div>
        
        <label class="flex items-center gap-2 cursor-pointer group">
            <div class="relative inline-flex items-center">
                <input type="checkbox" bind:checked={showHiddenTickets} class="sr-only peer" />
                <div class="w-10 h-5 bg-[#333333] rounded-full peer peer-checked:bg-lime after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#888888] peer-checked:after:bg-black after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider transition-colors {showHiddenTickets ? 'text-lime' : 'text-gray2'}">
                Hidden Tickets
            </span>
        </label>
    </div>

    <div class="w-full pr-3">
        <table class="w-full text-left text-[13px] border-collapse table-fixed">
            <colgroup>
                <col style="width: 40px;" />
                <col style="width: 32px;" />
                <col style="width: auto;" />  
                <col style="width: 150px;" /> 
                <col style="width: 80px;" />  
                <col style="width: 90px;" />  
                <col style="width: 80px;" />  
            </colgroup>
            <thead>
                <tr class="text-gray2 text-[10px] uppercase tracking-wider border-b border-gray1">
                    <th class="p-2 text-center align-middle">
                        <label class="relative flex items-center justify-center cursor-pointer p-1">
                            <input type="checkbox" checked={isAllSelected} on:change={toggleAll} class="hidden" />
                            <div class="w-4 h-4 rounded border flex items-center justify-center transition-all {isAllSelected ? 'bg-lime border-lime' : 'border-gray2'}">
                                {#if isAllSelected}
                                    <svg class="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                {/if}
                            </div>
                        </label>
                    </th>
                    <th class="p-2 text-center"></th>
                    <th class="p-2">Ticket Name</th>
                    <th class="p-2">Category</th>
                    <th class="p-2">Tier</th>
                    <th class="p-2 text-right">Price</th>
                    <th class="p-2 text-right"># Sold</th>
                </tr>
            </thead>
        </table>
    </div>

    <div class="max-h-[50vh] overflow-y-auto w-full pr-1 custom-scrollbar">
        {#if loading}
            <div class="flex justify-center items-center py-12">
                <div class="animate-spin w-8 h-8 border-4 border-lime border-t-transparent rounded-full"></div>
            </div>
        {:else if error}
            <div class="p-6 text-center text-problem bg-problem/10 rounded-xl border border-problem/30 font-bold">
                {error}
            </div>
        {:else if allTickets.length === 0}
            <div class="p-6 text-center text-gray2 italic border border-dashed border-gray1 rounded-xl">
                No tickets found for this event in Tixr.
            </div>
        {:else if goodTickets.length === 0 && !showHiddenTickets}
            <div class="p-6 text-center text-gray2 italic border border-dashed border-gray1 rounded-xl">
                All available tickets are $0 or have 0 sold.
                Enable "Hidden Tickets" to view them.
            </div>
        {:else}
            <table class="w-full text-left text-[13px] border-collapse table-fixed">
                <colgroup>
                    <col style="width: 40px;" />
                    <col style="width: 32px;" />
                    <col style="width: auto;" />  
                    <col style="width: 150px;" /> 
                    <col style="width: 80px;" />  
                    <col style="width: 90px;" />  
                    <col style="width: 80px;" />  
                </colgroup>
                <tbody>
                    {#each goodTickets as item}
                        <tr class="border-b border-gray1/30 last:border-0 hover:bg-white/[0.03] transition-colors">
                            <td class="p-2 text-center align-middle">
                                <label class="relative flex items-center justify-center cursor-pointer p-1">
                                    <input type="checkbox" bind:checked={item.selected} class="hidden" />
                                    <div class="w-4 h-4 rounded border flex items-center justify-center transition-all {item.selected ? 'bg-lime border-lime' : 'border-gray2'}">
                                        {#if item.selected}
                                            <svg class="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        {/if}
                                    </div>
                                </label>
                            </td>
                            <td class="p-2 text-center align-middle relative">
                                <div class="relative flex items-center justify-center group">
                                    <svg class="w-4 h-4 text-gray2 group-hover:text-white transition-colors cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16v-4m0-4h.01"></path></svg>
                                    
                                    <div class="absolute left-8 top-1/2 -translate-y-1/2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity bg-[#1e1e1e] text-white text-[11px] p-2.5 rounded-lg border border-gray1 shadow-xl z-[100] whitespace-nowrap text-left pointer-events-none">
                                        <span class="text-gray2 block mb-1 uppercase text-[9px] tracking-wider font-bold">Original Tixr Name</span>
                                        {item.originalName}
                                    </div>
                                </div>
                            </td>
                            <td class="p-2 font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{item.ticket}</td>
                            <td class="p-2 text-gray3 text-xs">{item.category}</td>
                            <td class="p-2 text-gray3 text-xs">{item.tier}</td>
                            <td class="p-2 text-right font-mono text-lime">{formatCurrency(item.price)}</td>
                            <td class="p-2 text-right font-bold text-white">{item.sold ?? '-'}</td>
                        </tr>
                    {/each}

                    {#if showHiddenTickets && hiddenTickets.length > 0}
                        <tr>
                            <td colspan="7" class="p-2 pt-6 bg-transparent text-[10px] font-bold text-gray2 uppercase tracking-wider border-b border-gray1">
                                Hidden Tickets ($0 or 0 Sold)
                            </td>
                        </tr>
                        {#each hiddenTickets as item}
                            <tr class="border-b border-gray1/30 last:border-0 hover:bg-white/[0.03] transition-colors opacity-60 hover:opacity-100">
                                <td class="p-2 text-center align-middle">
                                    <label class="relative flex items-center justify-center cursor-pointer p-1">
                                        <input type="checkbox" bind:checked={item.selected} class="hidden" />
                                        <div class="w-4 h-4 rounded border flex items-center justify-center transition-all {item.selected ? 'bg-lime border-lime' : 'border-gray2'}">
                                            {#if item.selected}
                                                <svg class="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            {/if}
                                        </div>
                                    </label>
                                </td>
                                <td class="p-2 text-center align-middle relative">
                                    <div class="relative flex items-center justify-center group">
                                        <svg class="w-4 h-4 text-gray2 group-hover:text-white transition-colors cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-width="2"></circle><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16v-4m0-4h.01"></path></svg>
                                        
                                        <div class="absolute left-8 top-1/2 -translate-y-1/2 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity bg-[#1e1e1e] text-white text-[11px] p-2.5 rounded-lg border border-gray1 shadow-xl z-[100] whitespace-nowrap text-left pointer-events-none">
                                            <span class="text-gray2 block mb-1 uppercase text-[9px] tracking-wider font-bold">Original Tixr Name</span>
                                            {item.originalName}
                                        </div>
                                    </div>
                                </td>
                                <td class="p-2 font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{item.ticket}</td>
                                <td class="p-2 text-gray3 text-xs">{item.category}</td>
                                <td class="p-2 text-gray3 text-xs">{item.tier}</td>
                                <td class="p-2 text-right font-mono text-lime">{formatCurrency(item.price)}</td>
                                <td class="p-2 text-right font-bold text-white">{item.sold ?? '-'}</td>
                            </tr>
                        {/each}
                    {/if}
                </tbody>
            </table>
        {/if}
    </div>

    <div slot="footer" class="flex justify-between items-center w-full">
        <div class="text-xs text-gray2">
            Selected: <span class="font-bold text-white">{allTickets.filter(t => t.selected).length}</span> / {allTickets.length}
        </div>
        <div class="flex gap-3">
            <button class="px-5 py-2 rounded-full font-bold text-sm bg-gray1 text-white hover:bg-gray2 transition-colors cursor-pointer" on:click={() => dispatch('close')}>
                Cancel
            </button>
            <button 
                class="px-5 py-2 rounded-full font-bold text-sm bg-lime text-black hover:bg-lime/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed" 
                disabled={loading || allTickets.filter(t => t.selected).length === 0}
                on:click={handleImport}
            >
                Import Selected
            </button>
        </div>
    </div>
</Modal>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>