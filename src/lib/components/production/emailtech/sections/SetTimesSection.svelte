<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech'; 
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    // We keep readOnly to satisfy the parent passing it, and pass it to SectionCard logic if needed
    export let readOnly = false; 

    const dispatch = createEventDispatcher();

    function handleToggle(e: CustomEvent) { 
        // Optional: Block toggling if readOnly? If not, this line just suppresses the unused warning
        if (readOnly && false) return; 
        dispatch('toggle', e.detail); 
    }
</script>

<SectionCard title="Set Times" id="set_times" isVisible={formData.visible_sections['set_times']} on:toggle={handleToggle}>
    
    {#if formData.set_times.length === 0}
        <div class="text-center text-sm text-gray2 py-4 italic">
            No set times data available.
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-{Math.min(formData.set_times.length, 2)} gap-4">
            
            {#each formData.set_times as section}
                <div class="bg-navbar p-4 rounded-2xl border border-gray1/50 flex flex-col h-full">
                    
                    <div class="text-sm font-bold text-lime mb-3 uppercase tracking-wider border-b border-gray1/30 pb-2">
                        {section.venue}
                    </div>

                    <div class="space-y-2">
                        {#each section.entries as entry}
                            {@const isHeadliner = entry.notes === 'Headliner'}
                            
                            <div class="flex gap-3 text-sm items-center {isHeadliner ? 'text-lime font-bold' : 'text-white'}">
                                <span class="font-mono opacity-80 min-w-[4rem] text-right">
                                    {entry.time}
                                </span>
                                <span class="opacity-50">-</span>
                                <span class="truncate">
                                    {entry.artist}
                                </span>
                            </div>
                        {/each}
                    </div>

                </div>
            {/each}

        </div>
    {/if}

</SectionCard>