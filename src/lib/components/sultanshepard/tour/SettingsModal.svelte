<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { SSCrew, MerchDefaultItem, TracklistTrack, RidersSettings } from '$lib/types/tour';
    import TourCrew from './settings/TourCrew.svelte';
    import TourMerch from './settings/TourMerch.svelte';
    import TourTracklist from './settings/TourTracklist.svelte';
    import TourRiders from './settings/TourRiders.svelte';
    import TourProduction from './settings/TourProduction.svelte';
    import TourOther from './settings/TourOther.svelte';

    export let open = false;
    export let crew: SSCrew[] = [];
    export let riders: RidersSettings | null = null;
    export let merchDefaults: MerchDefaultItem[] = [];
    export let tracklist: TracklistTrack[] = [];
    export let localCrewTemplate: { qty: number; role: string }[] = [];

    const dispatch = createEventDispatcher();
    type Tab = 'crew' | 'merch' | 'tracklist' | 'riders' | 'production' | 'other';
    let tab: Tab = 'crew';
    let savedFlash = false;

    let crewComponent: any;
    let isCrewEditing = false;
    let merchComponent: any;
    let tracklistComponent: any;
    let productionComponent: any;

    const TABS: { id: Tab; label: string }[] = [
        { id: 'crew', label: 'Crew' },
        { id: 'merch', label: 'Merch' },
        { id: 'tracklist', label: 'Set List' },
        { id: 'riders', label: 'Hospo Riders' },
        { id: 'production', label: 'Production' },
        { id: 'other', label: 'Other' }
    ];

    function flash() {
        savedFlash = true;
        setTimeout(() => (savedFlash = false), 1500);
    }

    function close() {
        open = false;
        dispatch('close');
    }
</script>

{#if open}
<div class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" on:click|self={close} role="presentation">
    <div class="bg-navbar rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden">
        <div class="flex items-center gap-3 px-6 py-4 border-b border-gray1 shrink-0">
            <svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <h2 class="text-lg font-bold text-white flex-1">Tour Data</h2>
            
            {#if savedFlash}
                <span class="text-xs font-bold text-lime">Saved ✓</span>
            {/if}
            <button class="text-gray2 hover:text-white transition cursor-pointer" on:click={close} aria-label="Close">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div class="flex items-center justify-between px-6 pt-3 border-b border-gray1 shrink-0 overflow-x-auto custom-scrollbar">
            <div class="flex gap-1">
                {#each TABS as t}
                    <button
                        class="px-4 py-2 cursor-pointer text-sm font-bold rounded-t-lg transition whitespace-nowrap {tab === t.id ? 'bg-black/40 text-lime' : 'text-gray2 hover:text-white'}"
                        on:click={() => (tab = t.id)}
                    >
                        {t.label}
                    </button>
                {/each}
            </div>
            
            {#if tab === 'crew' && !isCrewEditing}
                <button class="shrink-0 px-4 py-2 -translate-y-1.5 cursor-pointer rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition" on:click={() => crewComponent?.triggerNew()}>
                    + Add Crew Member
                </button>
            {:else if tab === 'merch'}
                <button class="shrink-0 px-4 py-2 -translate-y-1.5 cursor-pointer rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition" on:click={() => merchComponent?.triggerNew()}>
                    + Add Merch Item
                </button>
            {:else if tab === 'tracklist'}
                <button class="shrink-0 px-4 py-2 -translate-y-1.5 cursor-pointer rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition" on:click={() => tracklistComponent?.triggerNew()}>
                    + Add Track
                </button>
            {:else if tab === 'production'}
                <button class="shrink-0 px-4 py-2 -translate-y-1.5 cursor-pointer rounded-full bg-lime text-black text-xs font-bold hover:opacity-90 transition" on:click={() => productionComponent?.triggerNew()}>
                    + Add Local Crew
                </button>
            {/if}
        </div>
        
        <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {#if tab === 'crew'}
                <TourCrew bind:this={crewComponent} bind:crew bind:isEditing={isCrewEditing} on:saved={flash} />
            {:else if tab === 'merch'}
                <TourMerch bind:this={merchComponent} bind:merchDefaults on:saved={flash} />
            {:else if tab === 'tracklist'}
                <TourTracklist bind:this={tracklistComponent} bind:tracklist on:saved={flash} />
            {:else if tab === 'riders'}
                <TourRiders bind:riders on:saved={flash} />
            {:else if tab === 'production'}
                <TourProduction bind:this={productionComponent} bind:localCrewTemplate on:saved={flash} />
            {:else if tab === 'other'}
                <TourOther on:saved={flash} />
            {/if}
        </div>
    </div>
</div>
{/if}