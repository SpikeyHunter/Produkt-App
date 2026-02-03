<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    
    // Data props
    export let events: any[] = [];
    export let currentEventId: number | string | null = null;
    export let secondEventId: number | string | null = null;

    const dispatch = createEventDispatcher();
    
    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }
    
    // --- Helper: Robust JSON Parser ---
    function parseJson(data: any) {
        if (!data) return null;
        let currentData = data;
        for (let i = 0; i < 5; i++) {
            if (typeof currentData === 'string') {
                try {
                    currentData = JSON.parse(currentData);
                } catch (e) { return null; }
            } else {
                break;
            }
        }
        return typeof currentData === 'object' && currentData !== null ? currentData : null;
    }

    // --- Logic: Auto-Generate SFX List ---
    let sfxItems: string[] = [];

    // Reactive: Update list when IDs or Events change
    $: updateSFXList(events, currentEventId, secondEventId);

    function updateSFXList(allEvents: any[], mainId: number | string | null, secondId: number | string | null) {
        if (!allEvents || allEvents.length === 0) return;

        let allRows: any[] = [];

        // 1. Collect Rows
        if (mainId) {
            allRows = [...allRows, ...allEvents.filter(e => e.event_id == mainId)];
        }
        if (secondId) {
            allRows = [...allRows, ...allEvents.filter(e => e.event_id == secondId)];
        }

        // 2. Sort: Local -> Support -> Headliner
        const typePriority: Record<string, number> = {
            'local': 1,
            'support': 2,
            'headliner': 3
        };

        allRows.sort((a, b) => {
            const typeA = (a.artist_type || '').toLowerCase();
            const typeB = (b.artist_type || '').toLowerCase();
            const pA = typePriority[typeA] || 0;
            const pB = typePriority[typeB] || 0;
            return pA - pB;
        });

        // 3. Generate Strings
        const generatedItems: string[] = [];

        allRows.forEach(row => {
            const sfxRider = parseJson(row.sfx_rider);
            if (!sfxRider) return;

            const parts: string[] = [];

            // Standard Items
            if (sfxRider.sparkulars?.enabled) {
                const duration = sfxRider.sparkulars.duration ? `${sfxRider.sparkulars.duration}sec` : '';
                parts.push(`${sfxRider.sparkulars.qty}x Sparks ${duration}`.trim());
            }
            if (sfxRider.cryo_jets?.enabled) {
                const duration = sfxRider.cryo_jets.duration ? `${sfxRider.cryo_jets.duration}sec` : '';
                parts.push(`${sfxRider.cryo_jets.qty}x CO2 ${duration}`.trim());
            }
            if (sfxRider.lasers?.enabled) {
                parts.push(`${sfxRider.lasers.qty}x Laser`);
            }

            // Custom "Other" Items
            if (sfxRider.other && Array.isArray(sfxRider.other)) {
                sfxRider.other.forEach((item: any) => {
                    if (item.text) parts.push(item.text);
                });
            }

            // Only add if there are items
            if (parts.length > 0) {
                generatedItems.push(`${row.artist_name} - ${parts.join(' + ')}`);
            }
        });

        sfxItems = generatedItems;
        
        // Update form data string for email template compatibility
        const newString = sfxItems.join('\n');
        if (formData.sfx !== newString) {
            formData.sfx = newString;
            dispatch('change');
        }
    }
</script>

<SectionCard 
    title="SFX Allocation" 
    id="sfx" 
    isVisible={formData.visible_sections['sfx']} 
    on:toggle={handleToggle}
    stretch={stretch}
>
    <div class="h-full flex flex-col gap-2 {readOnly ? 'opacity-75' : ''}">
        {#if sfxItems.length > 0}
            {#each sfxItems as item}
                <div class="bg-navbar border border-gray1 rounded-2xl p-3 text-xs text-white font-bold shadow-sm">
                    {item}
                </div>
            {/each}
        {:else}
            <div class="text-gray2 text-xs italic p-2">No SFX confirmed...</div>
        {/if}
        <div class="flex-grow"></div>
    </div>
</SectionCard>