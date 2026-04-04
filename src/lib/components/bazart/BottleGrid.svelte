<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import FilterButton from './FilterButton.svelte';

    export let bottles: any[] = [];
    const dispatch = createEventDispatcher();
    
    let currentLang: 'en' = 'en';
    let currentSort: 'none' | 'a-z' | 'z-a' | 'price-asc' | 'price-desc' = 'none';
    let currentTypeFilter: string = 'none';
    let searchQuery: string = '';

    const typeColors: Record<string, string> = {
        'white wine': '#f8ebc0',
        'red wine': '#e05959',
        'rosé': '#f7a3b1',
        'natural wines': '#bcce7c',
        'orange wines': '#fd9c5c',
        'dessert wines': '#e097c4',
        'scotch': '#f17127',
        'whiskey': '#f17127',
        'liqueur': '#e6b294',
        'cream': '#e6b294',
        'gin': '#8ab5ee',
        'rum': '#c79357',
        'vodka': '#dfe4e7',
        'tequila': '#eec84d',
        'cognac': '#e49217',
        'brandy': '#e49217',
        'champagne': '#f5d3a0',
        'sparkling wine': '#f5d3a0',
        'prosecco': '#f5d3a0'
    };

    function getColorForType(typeRaw: string): string {
        if (!typeRaw) return 'var(--color-gray3, #333)';
        const cleanType = typeRaw.toLowerCase().trim();
        if (typeColors[cleanType]) return typeColors[cleanType];
        
        for (const [key, color] of Object.entries(typeColors)) {
            if (cleanType.includes(key) || key.includes(cleanType.replace('vin ', '').replace(' wine', ''))) {
                return color;
            }
        }
        return 'var(--color-gray3, #333)';
    }

    function getLocString(data: any, lang: string = 'en'): string {
        if (!data) return '';
        let parsed = data;
        if (typeof data === 'string') {
            try { parsed = JSON.parse(data);
            } catch (e) { return data; }
        }
        return parsed[lang] || parsed['en'] || parsed['fr'] || '';
    }

    function formatPrice(price: any): string {
        const num = parseFloat(price);
        if (isNaN(num)) return '0';
        
        // If it's a whole number, don't show decimal places (e.g., 10 instead of 10.00)
        if (num % 1 === 0) {
            return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        }
        
        // Otherwise, keep the 2 decimal places
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    $: availableTypes = [...new Set(bottles.map(b => getLocString(b.type, 'en')).filter(t => t !== ''))].sort();

    $: filteredBottles = bottles.filter(b => {
        if (currentTypeFilter !== 'none') {
            if (getLocString(b.type, 'en') !== currentTypeFilter) return false;
        }
        if (searchQuery.trim() !== '') {
            const query = searchQuery.toLowerCase();
            const bName = getLocString(b.name, 'en').toLowerCase();
            const bType = getLocString(b.type, 'en').toLowerCase();
            const bPrice = String(b.price);
            if (!bName.includes(query) && !bType.includes(query) && !bPrice.includes(query)) return false;
        }
        return true;
    });

    $: sortedBottles = [...filteredBottles].sort((a, b) => {
        const nameA = getLocString(a.name, 'en');
        const nameB = getLocString(b.name, 'en');
        const priceA = parseFloat(a.price) || 0;
        const priceB = parseFloat(b.price) || 0;

        if (currentSort === 'a-z') return nameA.localeCompare(nameB);
        if (currentSort === 'z-a') return nameB.localeCompare(nameA);
        if (currentSort === 'price-asc') return priceA - priceB;
        if (currentSort === 'price-desc') return priceB - priceA;
        return 0; 
    });

    function handleSort(event: CustomEvent) { currentSort = event.detail.sort; }
    function handleType(event: CustomEvent) { currentTypeFilter = event.detail.type; }

</script>

<div class="h-full flex flex-col bg-navbar rounded-2xl p-6 min-w-0 flex-1">
    
    <div class="flex flex-row justify-between items-end mb-6 pb-4 border-b-2 border-gray1 shrink-0 w-full gap-4">
        
        <div class="flex flex-col gap-4">
            <h1 class="text-xl font-black uppercase tracking-wide text-lime shrink-0">Menu Inventory</h1>
            <div class="flex items-center gap-2">
                <FilterButton 
                    currentSort={currentSort}
                    currentType={currentTypeFilter}
                    availableTypes={availableTypes}
                    on:sortChange={handleSort}
                    on:typeChange={handleType}
                />
            </div>
        </div>
        
        <div class="flex flex-col items-end gap-3 shrink-0">
            <button 
                on:click={() => dispatch('addCustom')}
                class="bg-lime text-black font-black uppercase tracking-wide px-4 py-1.5 rounded-full text-[11px] hover:opacity-90 hover:cursor-pointer transition-opacity flex items-center gap-1.5 "
            >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
                Add Custom
            </button>

            <div class="relative w-64">
                <input 
                    type="text" 
                    bind:value={searchQuery} 
                    placeholder="Search name, type, price..."
                    class="w-full bg-black/40 border border-gray1 text-white text-sm rounded-full py-1.5 pl-9 pr-4 focus:outline-none focus:border-lime transition-colors"
                />
                <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            </div>
        </div>
        
    </div>

    <div class="grid grid-cols-[repeat(auto-fill,170px)] gap-4 overflow-y-auto pr-2 pb-6 custom-scrollbar justify-start content-start flex-1 min-h-0">
        {#each sortedBottles as bottle (bottle.id)}
            
            <div class="bg-navbar rounded-xl flex flex-col overflow-hidden transition-all duration-300 border w-[170px] h-[260px] shrink-0 relative
                {bottle.status === 'Out of Stock' ? 'border-problem' :
                 bottle.status === 'Hidden' ? 'border-gray1' : 'border-transparent'}">
                 
                {#if bottle.status === 'Out of Stock'}
                    <div class="absolute inset-0 bg-problem/20 backdrop-saturate-[0.3] z-10 pointer-events-none"></div>
                {:else if bottle.status === 'Hidden'}
                    <div class="absolute inset-0 bg-black/60 backdrop-grayscale z-10 pointer-events-none"></div>
                {/if}
                
                <div class="relative w-full h-36 flex items-center justify-center p-2 shrink-0 {bottle.status === 'Out of Stock' ? 'bg-problem/10' : 'bg-gray3'}">
                    
                    <div class="absolute top-1.5 left-1.5 bg-black/70 px-1.5 py-0.5 rounded-3xl text-[9px] font-bold text-gray2 uppercase tracking-widest z-10 ">
                        {bottle.saq_code || 'Imported'}
                    </div>

                    <button 
                        on:click={() => dispatch('edit', { bottle })}
                        class="absolute top-1 right-1 p-1 text-gray2 hover:text-gray4 transition-colors z-20 cursor-pointer pointer-events-auto"
                        title="Edit Bottle"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                    
                    {#if bottle.bottle_image}
                        <div class="relative h-full w-full">
                            <img 
                                src={bottle.bottle_image} 
                                alt={getLocString(bottle.name, currentLang)} 
                                class="h-full w-full object-contain drop-shadow-lg transition-all duration-300
                                {bottle.status === 'Out of Stock' ? 'grayscale opacity-90' : ''}" 
                            />
                        </div>
                    {:else}
                        <span class="text-[10px] text-gray2 font-bold uppercase tracking-wider">No Img</span>
                    {/if}
                </div>
                
                <div class="p-3 flex flex-col flex-1 min-h-0 {bottle.status === 'Out of Stock' ? 'bg-problem/20' : 'bg-gray1'}">
                    <h3 class="text-white font-black text-[13px] leading-snug mb-2 line-clamp-3" title={getLocString(bottle.name, currentLang)}>
                        {getLocString(bottle.name, currentLang)}
                    </h3>
                    
                    <div class="flex flex-row justify-between items-end mt-auto gap-2 shrink-0">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {getColorForType(getLocString(bottle.type, currentLang))};"></span>
                            <p class="text-[10px] font-bold uppercase tracking-widest truncate" style="color: {getColorForType(getLocString(bottle.type, currentLang))};">
                                {getLocString(bottle.type, currentLang) || 'Uncategorized'}
                            </p>
                        </div>
                        
                        <p class="text-[13px] font-black whitespace-nowrap shrink-0 {bottle.status === 'Out of Stock' ? 'text-problem' : 'text-lime'}">
                            {#if bottle.glass_price}
                                ${formatPrice(bottle.glass_price)} /
                            {/if}
                            ${formatPrice(bottle.price)}
                        </p>
                    </div>
                </div>
            </div>
        {/each}
        
        {#if sortedBottles.length === 0}
            <div class="col-span-full py-20 flex flex-col items-center justify-center text-center">
                <div class="w-16 h-16 rounded-full bg-navbar border border-gray2/20 flex items-center justify-center mb-4">
                    <span class="text-gray2 text-2xl font-black">?</span>
                </div>
                <h3 class="text-white font-bold text-lg">No bottles found</h3>
                <p class="text-gray2 font-medium text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.1); border-radius: 10px; }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.2); }
</style>