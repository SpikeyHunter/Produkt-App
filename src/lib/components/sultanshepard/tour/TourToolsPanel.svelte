<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    
    export let activeView: 'map' | 'list' = 'map';
</script>

<div class="flex flex-col flex-1 min-h-0 bg-navbar rounded-2xl overflow-hidden p-5">
    <div class="flex items-center justify-between mb-5 border-b border-gray1 pb-4 shrink-0">
        <h3 class="text-lg font-bold text-white">Tour Settings</h3>
        <button 
            class="text-gray2 hover:text-lime transition-colors cursor-pointer"
            on:click={() => dispatch('editSettings')}
            aria-label="Edit Tour Settings"
        >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
        </button>
    </div>

    <div class="flex flex-col gap-2">
        <p class="text-[10px] font-bold text-gray3 uppercase tracking-widest mb-2">Display Mode</p>
        
        <button 
            class="flex items-center gap-3 p-3 rounded-xl border transition-all {activeView === 'map' ? 'bg-lime/10 border-lime text-lime' : 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
            on:click={() => dispatch('changeView', 'map')}
            aria-label="Show World Map"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            <span class="font-bold text-xs uppercase tracking-wider">Map View</span>
        </button>

        <button 
            class="flex items-center gap-3 p-3 rounded-xl border transition-all {activeView === 'list' ? 'bg-lime/10 border-lime text-lime' : 'bg-gray1/40 border-transparent text-gray2 hover:text-white'}"
            on:click={() => dispatch('changeView', 'list')}
            aria-label="Show List View"
        >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span class="font-bold text-xs uppercase tracking-wider">List View</span>
        </button>
    </div>
</div>