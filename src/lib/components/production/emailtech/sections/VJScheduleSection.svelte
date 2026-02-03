<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false; 
    
    export let events: any[] = []; 
    export let fullEventData: any = null; 

    const dispatch = createEventDispatcher();
    
    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }
    
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

    function cleanTime(timeStr: string): string {
        if (!timeStr) return '';
        // Remove :00 but keep AM/PM. e.g., 10:00PM -> 10PM, 11:40PM -> 11:40PM
        return timeStr.replace(/:00([AP]M)/, '$1');
    }

    $: generateVJSchedule(events, fullEventData);

    function generateVJSchedule(advanceEvents: any[], eventDetails: any) {
        if (!eventDetails || !eventDetails.timetable) return;

        const timetable = parseJson(eventDetails.timetable);
        if (!Array.isArray(timetable)) return;

        const doorsEntry = timetable.find(t => t.artist === 'DOORS');
        const curfewEntry = timetable.find(t => t.artist === 'CURFEW');
        
        if (!doorsEntry || !curfewEntry) return;

        // 1. Determine Default VJ Name
        let houseVJ = "In House VJ";
        if (eventDetails.crew && eventDetails.crew['VJ'] && eventDetails.crew['VJ'].length > 0) {
             houseVJ = eventDetails.crew['VJ'][0].split(' ')[0]; 
        }

        // 2. Map Guest VJs
        const artistVJMap: Record<string, string> = {};
        advanceEvents.forEach(row => {
            const roles = parseJson(row.roles);
            if (roles && Array.isArray(roles)) {
                const vjRole = roles.find((r: any) => r.role === 'VJ' || (r.customRole && r.customRole.includes('VJ')));
                if (vjRole) {
                    artistVJMap[row.artist_name] = vjRole.firstName;
                }
            }
        });

        // 3. Build Raw Slots
        let rawSlots: { start: string, end: string, vj: string }[] = [];
        let lastTime = doorsEntry.time;

        const sets = timetable.filter(t => 
            t.status === 'Confirmed' && 
            t.artist !== 'Changeover' && 
            t.artist !== 'DOORS' && 
            t.artist !== 'CURFEW'
        );

        sets.forEach(set => {
            // Gap before set -> House VJ
            if (set.time !== lastTime) {
                rawSlots.push({ start: lastTime, end: set.time, vj: houseVJ });
            }

            // Current Set
            let currentVJ = houseVJ;
            const guestVJ = artistVJMap[set.artist];
            if (guestVJ) {
                currentVJ = `${guestVJ} (${set.artist})`;
            }

            // Determine End Time
            const currentIndex = timetable.findIndex(t => t.id === set.id);
            let endTime = curfewEntry.time;
            for(let i = currentIndex + 1; i < timetable.length; i++) {
                const next = timetable[i];
                if(next.artist === 'CURFEW' || (next.status === 'Confirmed' && next.artist !== 'Changeover')) {
                    endTime = next.time;
                    break;
                }
            }
            
            rawSlots.push({ start: set.time, end: endTime, vj: currentVJ });
            lastTime = endTime;
        });

        // Remaining time after last set
        if (lastTime !== curfewEntry.time) {
             rawSlots.push({ start: lastTime, end: curfewEntry.time, vj: houseVJ });
        }

        // 4. Merge Consecutive Slots
        if (rawSlots.length === 0) return;

        const mergedSlots = [rawSlots[0]];
        for (let i = 1; i < rawSlots.length; i++) {
            const prev = mergedSlots[mergedSlots.length - 1];
            const curr = rawSlots[i];

            if (prev.vj.trim() === curr.vj.trim()) {
                prev.end = curr.end;
            } else {
                mergedSlots.push(curr);
            }
        }

        // 5. Format Output
        const finalString = mergedSlots.map(s => `${cleanTime(s.start)}-${cleanTime(s.end)} : ${s.vj}`).join('\n');
        
        if (formData.vj_schedule !== finalString) {
            formData.vj_schedule = finalString;
            dispatch('change');
        }
    }
    
    $: displayLines = formData.vj_schedule ? formData.vj_schedule.split('\n') : [];
</script>

<SectionCard 
    title="VJ Schedule" 
    id="vj" 
    isVisible={formData.visible_sections['vj']} 
    on:toggle={handleToggle}
    stretch={stretch}
>
    <div class="h-full flex flex-col gap-2 {readOnly ? 'opacity-75' : ''}">
        {#if displayLines.length > 0}
            {#each displayLines as line}
                {@const parts = line.split(' : ')}
                <div class="bg-navbar border border-gray1 rounded-2xl p-3 flex items-center justify-between text-xs text-white">
                    <span class="font-mono text-gray2 font-bold">{parts[0]}</span>
                    <span class="font-bold truncate ml-4">{parts[1] || ''}</span>
                </div>
            {/each}
        {:else}
            <div class="text-gray2 text-xs italic p-2">No schedule generated...</div>
        {/if}
        <div class="flex-grow"></div>
    </div>
</SectionCard>