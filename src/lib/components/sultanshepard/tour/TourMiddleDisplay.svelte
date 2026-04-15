<script lang="ts">
    import type { SSTour } from '$lib/types/tour';
    import TourMapView from './view/TourMapView.svelte';
    
    export let currentTour: SSTour | null = null;
    export let tourDates: any[] = [];
    export let activeView: 'map' | 'list' = 'map';
</script>

<div class="flex flex-col h-full bg-navbar rounded-2xl overflow-hidden relative">
    <div class="flex-1 relative bg-gray1/50 flex items-center justify-center min-h-0">
        {#if activeView === 'map' && currentTour}
            {#key currentTour.id}
                <TourMapView 
                    {tourDates} 
                    mapsInfo={currentTour.maps_info || ""} 
                />
            {/key}
        {:else if activeView === 'list' && currentTour}
            <div class="text-gray3 text-xs uppercase tracking-widest italic">List View Placeholder</div>
        {:else}
            <div class="text-center z-10 p-4">
                <p class="text-gray2 font-bold uppercase tracking-widest text-xs mb-1">No Tour Selected</p>
            </div>
        {/if}
    </div>

    <div class="h-32 shrink-0 border-t border-gray1 p-6 flex flex-col justify-center">
        {#if currentTour}
            <div class="flex items-center gap-3 mb-1">
                <h2 class="text-white font-bold text-xl truncate">{currentTour.name}</h2>
                <span class="bg-gray1 text-gray3 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase">{currentTour.year}</span>
            </div>
            <p class="text-gray2 text-sm line-clamp-2 leading-relaxed">{currentTour.description || 'No description available.'}</p>
        {/if}
    </div>
</div>