<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { CrewAssignments, CrewTimeGroup } from '$lib/types/emailtech';

    export let crew: CrewAssignments = {};
    export let groups: CrewTimeGroup[] = [];
    export let readOnly: boolean = false;

    const dispatch = createEventDispatcher();

    // Configuration: Define which DB roles map to which "Call"
    const TECH_ROLES = ['LD', 'Video', 'Sound', 'Stage/Tech', 'DT'];
    const VJ_ROLES = ['VJ'];

    // -- INIT --
    // Create default structure if empty
    $: if (groups.length === 0 && !readOnly) {
        initGroups();
    }

    // -- SYNC LOGIC --
    // Watch for changes in the global 'crew' prop (triggered by Autofill button).
    // We compare with a local reference to ensure we only sync when the parent actually updates the prop.
    let prevCrew: CrewAssignments | null = null;
    
    $: if (crew && crew !== prevCrew) {
        // Only run sync if we have groups to sync against
        if (groups.length > 0) {
            syncCrewNames();
        }
        prevCrew = crew;
    }

    function initGroups() {
        groups = [
            { id: 'tech_call', label: 'CREW CALL', time: '19:00', roles: [...TECH_ROLES], content: '' },
            { id: 'vj_call', label: 'VJ CALL', time: '21:00', roles: [...VJ_ROLES], content: '' }
        ];
        syncCrewNames(); // Initial population
        dispatchChange();
    }

    /**
     * Reads the Crew DB object, extracts First Names, and populates the text area.
     */
    function syncCrewNames() {
        let hasChanges = false;

        groups = groups.map(g => {
            // Only autofill if the content is empty OR if we just ran an autofill action (detected via prevCrew change)
            // To be safe and responsive to the button, we regenerate the list if DB data exists.
            
            const namesList: string[] = [];

            g.roles.forEach(role => {
                const dbNames = crew[role] || [];
                dbNames.forEach(fullName => {
                    // Extract First Name (split by space, take first part)
                    const firstName = fullName.trim().split(' ')[0];
                    if (firstName) namesList.push(firstName);
                });
            });

            // Join with commas
            const newContent = namesList.length > 0 ? namesList.join(', ') : '';

            // Update if different
            if (newContent !== g.content) {
                // If user has manually edited, we might hesitate to overwrite.
                // However, user specifically asked for Autofill to work. 
                // We will overwrite if the calculated list is not empty.
                if (newContent) {
                    hasChanges = true;
                    return { ...g, content: newContent };
                }
            }
            return g;
        });

        if (hasChanges) {
            groups = groups; // Trigger Svelte update
            dispatchChange();
        }
    }

    function dispatchChange() {
        dispatch('change', groups);
    }

    function updateTime(index: number, time: string) {
        groups[index].time = time;
        dispatchChange();
    }

    function updateContent(index: number, text: string) {
        groups[index].content = text;
        dispatchChange();
    }
</script>

<div class="flex flex-col gap-6">
    {#each groups as group, idx}
        <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between">
                <span class="text-lime font-bold text-sm uppercase tracking-wider">{group.label}</span>
                
                <input 
                    type="time" 
                    value={group.time}
                    on:input={(e) => updateTime(idx, e.currentTarget.value)}
                    disabled={readOnly}
                    class="bg-transparent text-white text-xs font-mono font-bold border border-gray2 rounded px-2 py-1 focus:border-lime focus:outline-none w-24 text-center hover:border-white transition-colors cursor-pointer"
                />
            </div>

            <input 
                type="text"
                value={group.content || ''}
                on:input={(e) => updateContent(idx, e.currentTarget.value)}
                readonly={readOnly}
                placeholder="List names..."
                class="w-full bg-transparent text-white text-sm font-medium border-b border-gray1 focus:border-lime focus:outline-none py-1 placeholder-gray1/30 transition-colors"
            />
        </div>
    {/each}
</div>