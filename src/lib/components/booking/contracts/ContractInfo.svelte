<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { EventAdvance } from '$lib/services/eventsService';

    export let advance: EventAdvance | null = null;
    const dispatch = createEventDispatcher();
</script>

{#if advance}
    <div class="w-full bg-navbar border border-gray1 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
        <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-24 aspect-[3/4] bg-black rounded-lg overflow-hidden border border-gray1 relative">
                {#if advance.poster}
                    <img src={advance.poster} alt={advance.event_name} class="w-full h-full object-cover" />
                {:else}
                    <div class="w-full h-full flex items-center justify-center text-gray2 bg-gray1"><span class="text-[10px]">No Poster</span></div>
                {/if}
                
                {#if advance.event_id === -1 || (advance as any).is_custom}
                    <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-lime/90 text-black shadow-sm">
                        CUSTOM
                    </div>
                {/if}
            </div>

            <div class="flex flex-col justify-center min-w-0 space-y-1">
                <div class="text-lime text-[10px] font-bold uppercase tracking-wider">{advance.artist_type || 'Main Artist'}</div>
                <div class="text-white font-bold text-lg leading-tight break-words">{advance.artist_name}</div>
                <div class="text-gray3 text-xs pt-1">{advance.event_name}</div>
                <div class="text-gray3 text-[10px]">{advance.date} • {advance.venue || 'TBA'}</div>
                <div class="text-gray2 text-[10px] font-mono">Event ID: {advance.event_id === -1 ? 'N/A' : advance.event_id}</div>
            </div>
        </div>

        <div class="w-full h-[1px] bg-gray1"></div>

        <div class="flex gap-2 w-full">
            {#if advance.gdrive_folder_url}
                <a href={advance.gdrive_folder_url} target="_blank" class="flex-1 text-center bg-gray1 text-white text-xs font-bold py-2.5 rounded-lg hover:bg-gray2 transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    Drive Folder
                </a>
            {:else}
                <button disabled class="flex-1 bg-gray1/30 text-gray2 text-xs font-bold py-2.5 rounded-lg cursor-not-allowed">
                    No Folder Linked
                </button>
            {/if}
            <button 
                on:click={() => dispatch('edit')}
                class="px-5 bg-lime text-black text-xs font-bold rounded-lg hover:opacity-80 transition-opacity cursor-pointer flex items-center justify-center gap-1.5"
            >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Edit
            </button>
        </div>
    </div>
{:else}
    <div class="w-full bg-navbar border border-gray1 rounded-xl p-8 flex flex-col items-center justify-center text-gray2 gap-3 shadow-xl">
        <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        <span class="text-xs italic">Select an advance to view details</span>
    </div>
{/if}