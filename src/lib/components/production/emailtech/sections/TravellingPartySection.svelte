<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    
    // Data inputs required for auto-generation
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

    // --- Logic: Generate Travelling Party String ---
    
    // Reactive: Update text when IDs or Events change
    $: updateTravellingParty(events, currentEventId, secondEventId);

    function updateTravellingParty(allEvents: any[], mainId: number | string | null, secondId: number | string | null) {
        if (!allEvents || allEvents.length === 0) return;

        // 1. Get Sorted Artists for Main Event
        let mainStr = '';
        if (mainId) {
            const mainArtists = getSortedArtists(allEvents, mainId);
            mainStr = formatArtistList(mainArtists);
        }

        // 2. Get Sorted Artists for Second Event
        let secondStr = '';
        if (secondId) {
            const secondArtists = getSortedArtists(allEvents, secondId);
            secondStr = formatArtistList(secondArtists);
        }

        // 3. Combine them
        const finalString = [mainStr, secondStr].filter(s => s.trim() !== '').join('<br><br>');

        // 4. Update Form Data
        if (finalString && formData.travelling_party !== finalString) {
            formData.travelling_party = finalString;
            dispatch('change');
        }
    }

    function getSortedArtists(allEvents: any[], eventId: number | string) {
        // Loose equality (==) handles string vs number ID mismatch
        const rows = allEvents.filter(e => e.event_id == eventId);

        // Sort Priority: Headliner (1) -> Support (2) -> Local (3) -> Other (4)
        const typePriority: Record<string, number> = {
            'headliner': 1,
            'support': 2,
            'local': 3
        };

        return rows.sort((a, b) => {
            const typeA = (a.artist_type || '').toLowerCase();
            const typeB = (b.artist_type || '').toLowerCase();
            const pA = typePriority[typeA] || 4;
            const pB = typePriority[typeB] || 4;
            return pA - pB;
        });
    }

    function formatArtistList(rows: any[]): string {
        return rows.map(row => {
            const rolesData = parseJson(row.roles);
            const artistName = row.artist_name || 'Unknown Artist';

            // Scenario A: No roles defined -> Just Artist Name
            if (!rolesData || !Array.isArray(rolesData) || rolesData.length === 0) {
                return `${artistName} - Artist`;
            }

            // Scenario B: Roles exist -> Header + List
            // Using HTML bold and underline as requested
            let output = `<b><u>${artistName.toUpperCase()}</u></b>`; 
            
            rolesData.forEach((member: any) => {
                if (member.firstName && member.role) {
                    output += `<br>- ${member.firstName} - ${member.role}`;
                }
            });

            return output;
        }).join('<br><br>');
    }

    function handleReset() {
        if (readOnly) return;
        updateTravellingParty(events, currentEventId, secondEventId);
        dispatch('change');
    }
</script>

<SectionCard 
    title="Travelling Party" 
    id="travelling" 
    isVisible={formData.visible_sections['travelling']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
    stretch={stretch}
>
    <div class="h-full flex flex-col">
        <div 
            class="w-full bg-navbar border border-gray1 rounded-2xl p-4 text-sm text-white transition-colors h-auto min-h-[100px]"
        >
            {#if formData.travelling_party}
                {@html formData.travelling_party}
            {:else}
                <span class="text-gray2/50 italic">No travelling party info found...</span>
            {/if}
        </div>
    </div>
</SectionCard>