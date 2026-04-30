<script lang="ts">
    import type { SSTour } from '$lib/types/tour';
    import TourMapView from './view/TourMapView.svelte';
    
    export let currentTour: SSTour | null = null;
    export let tourDates: any[] = [];
    export let activeView: 'map' | 'list' = 'map';
    export let selectedDateId: string | null = null;
</script>

<div class="flex flex-col flex-1 min-h-0 bg-navbar rounded-2xl overflow-hidden relative">
    <div class="flex-1 relative flex items-center justify-center min-h-0">
        {#if activeView === 'map' && currentTour}
            {#key currentTour.id}
                <TourMapView 
                    {tourDates} 
                    bind:selectedDateId
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
</div>