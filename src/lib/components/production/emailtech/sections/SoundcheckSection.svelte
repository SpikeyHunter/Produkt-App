<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    export let eventId: number | string | null = null;
    export let secondEventId: number | string | null = null;
    export let events: any[] = []; 

    const dispatch = createEventDispatcher();
    interface SoundcheckRow {
        start: string;
        end: string;
        artist: string;
        isManual: boolean;
    }

    let rows: SoundcheckRow[] = [];
    
    // State tracking to prevent overwrite loops
    let lastEventId: number | string | null = null;
    let lastSecondEventId: number | string | null = null;
    let lastParsedString: string = '';
    let isInternalUpdate = false; 

    // --- 1. Event Switch Watcher ---
    $: if (eventId !== lastEventId || secondEventId !== lastSecondEventId) {
        lastEventId = eventId;
        lastSecondEventId = secondEventId;
        rebuildRows();
    }

    // --- 2. Data Content Watcher ---
    $: if (formData.soundcheck !== undefined) {
        const currentString = formData.soundcheck;
        if (currentString !== lastParsedString) {
            if (!isInternalUpdate) {
                rebuildRows();
            }
            lastParsedString = currentString;
            isInternalUpdate = false;
        }
    }

    function rebuildRows() {
        const dbRows = getSystemRowsFromDB(events, eventId, secondEventId);
        const savedText = formData.soundcheck || '';
        const savedLines = parseLinesFromText(savedText);
        if (savedLines.length > 0) {
            rows = savedLines.map(lineObj => {
                const matchIndex = dbRows.findIndex(db => 
                    (db.start === lineObj.start && db.artist === lineObj.artist) ||
                    (db.artist === lineObj.artist && !lineObj.start) 
                );
                return matchIndex !== -1 
                    ? { ...lineObj, isManual: false } 
                    : { ...lineObj, isManual: true };
            });
        } else {
            rows = dbRows;
            updateFormData(false);
        }
        
        lastParsedString = formData.soundcheck || '';
    }

    // --- Time Helpers (12h <-> 24h) ---

    // Converts "14:00" -> "2:00PM"
    function format12h(time24: string): string {
        if (!time24) return '';
        // Handle full ISO strings or "HH:mm:ss"
        const cleanTime = time24.split('T')[1] || time24;
        const [hStr, mStr] = cleanTime.split(':');
        if (hStr === undefined || mStr === undefined) return time24;
        // Fallback

        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (isNaN(h) || isNaN(m)) return time24;

        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${mStr.padStart(2, '0')}${ampm}`;
    }

    // Converts "2:00PM" -> "14:00" (for input value)
    function to24h(time12: string): string {
        if (!time12) return '';
        const match = time12.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return ''; // Return empty if not a valid 12h string (or user is typing)

        let [_, hStr, mStr, period] = match;
        let h = parseInt(hStr, 10);
        const p = period.toUpperCase();

        if (p === 'PM' && h < 12) h += 12;
        if (p === 'AM' && h === 12) h = 0;

        return `${h.toString().padStart(2, '0')}:${mStr}`;
    }

    // --- Helpers ---

    function getSystemRowsFromDB(allEvents: any[], mainId: number | string | null, secondId: number | string | null) {
        if (!allEvents || (!mainId && !secondId)) return [];
        const relevantEvents = allEvents.filter(e => 
            e.event_id == mainId || (secondId && e.event_id == secondId)
        );
        const found: SoundcheckRow[] = [];
        relevantEvents.forEach(row => {
            const scData = parseJson(row.soundcheck);
            if (scData && scData.start_time && scData.status !== 'no') {
                found.push({
                    // Convert DB 24h time to 12h for consistency
                    start: format12h(scData.start_time),
                    end: format12h(scData.end_time || ''),
                    artist: row.artist_name || 'Artist',
                    isManual: false
                });
            }
        });
        // Sort using Date objects for accuracy, handling 12h AM/PM logic
        return found.sort((a, b) => {
            const timeA = to24h(a.start) || '00:00';
            const timeB = to24h(b.start) || '00:00';
            return timeA.localeCompare(timeB);
        });
    }

    function parseLinesFromText(str: string): SoundcheckRow[] {
        if (!str) return [];
        return str.split('\n').map(line => {
            const parts = line.split(' : ');
            const timePart = parts[0] || '';
            const artistPart = parts[1] || '';
            const times = timePart.split(' - ');
            return {
                start: times[0]?.trim() || '',
                end: times[1]?.trim() || '',
                artist: artistPart.trim(),
                isManual: true
            };
        }).filter(r => r.start || r.artist);
    }

    function parseJson(data: any) {
        if (!data) return null;
        let current = data;
        for (let i = 0; i < 3; i++) {
            if (typeof current === 'string') {
                try { current = JSON.parse(current);
                } catch (e) { return null; }
            } else { break;
            }
        }
        return (typeof current === 'object' && current !== null) ? current : null;
    }

    // --- Actions ---

    function addRow() {
        // Add empty row locally (No default time)
        rows = [...rows, { start: '', end: '', artist: '', isManual: true }];
        updateFormData(true);
    }

    function removeRow(index: number) {
        rows = rows.filter((_, i) => i !== index);
        updateFormData(true);
    }

    function handleTimeInput(index: number, field: 'start' | 'end', val24: string) {
        // Convert the Input's 24h value to 12h before saving to state
        rows[index][field] = format12h(val24);
        updateFormData(true);
    }

    function handleArtistInput() {
        updateFormData(true);
    }

    function updateFormData(internal = true) {
        if (internal) isInternalUpdate = true;
        // Sort by Time (using 24h conversion for correct sorting)
        rows.sort((a, b) => {
            if (!a.start) return 1;
            if (!b.start) return -1;
            const timeA = to24h(a.start) || '99:99';
            const timeB = to24h(b.start) || '99:99';
            return timeA.localeCompare(timeB);
        });

        const lines = rows
            .filter(r => r.start || r.artist)
            .map(r => {
                const timeStr = (r.start && r.end) ? `${r.start} - ${r.end}` : (r.start || '');
                return `${timeStr} : ${r.artist}`;
            });
        formData.soundcheck = lines.join('\n');
        dispatch('change');
    }

    function handleReset() {
        if (readOnly) return;
        formData.soundcheck = ''; 
        rebuildRows(); 
        dispatch('change');
    }

    function handleToggle(e: CustomEvent) { 
        dispatch('toggle', e.detail);
    }
</script>

<SectionCard 
    title="Soundcheck" 
    id="soundcheck" 
    isVisible={formData.visible_sections['soundcheck']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
    stretch={stretch}
>
    <div class="flex flex-col gap-2">
        {#each rows as row, i}
            <div class="relative flex flex-col gap-1.5 bg-black/20 p-2 rounded-lg border border-gray1/30">
                
                {#if !readOnly && row.isManual}
                    <button 
                        type="button" 
                        aria-label="Remove row"
                        on:click={() => removeRow(i)} 
                        class="absolute top-1 right-1 text-gray2 hover:cursor-pointer hover:text-problem transition-colors z-10 p-1"
                    >
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                {/if}

                <div class="flex items-center gap-2 pr-6">
                    <div class="flex flex-col gap-0.5 flex-1">
                        <span class="text-[9px] text-gray2 uppercase font-bold ml-1">From</span>
                        <input 
                            type="time"
                            value={to24h(row.start)} 
                            on:input={(e) => handleTimeInput(i, 'start', e.currentTarget.value)}
                            disabled={readOnly || !row.isManual} 
                            style="color-scheme: dark;"
                            class="w-full bg-navbar border border-gray1 rounded-lg px-1 py-1.5 text-sm text-white disabled:!text-gray3 text-center focus:border-lime focus:outline-none transition-colors placeholder-gray2/50 disabled:!opacity-100 disabled:cursor-not-allowed"
                        />
                    </div>

                    <div class="flex flex-col gap-0.5 flex-1">
                        <span class="text-[9px] text-gray2 uppercase font-bold ml-1">To</span>
                        <input 
                            type="time"
                            value={to24h(row.end)} 
                            on:input={(e) => handleTimeInput(i, 'end', e.currentTarget.value)}
                            disabled={readOnly || !row.isManual}
                            style="color-scheme: dark;"
                            class="w-full bg-navbar border border-gray1 rounded-lg px-1 py-1.5 text-sm text-white disabled:!text-gray3 text-center focus:border-lime focus:outline-none transition-colors placeholder-gray2/50 disabled:!opacity-100 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                <div class="flex flex-col gap-0.5 w-full">
                    <span class="text-[9px] text-gray2 uppercase font-bold ml-1">Artist</span>
                    <input 
                        type="text" 
                        bind:value={row.artist} 
                        on:input={handleArtistInput}
                        disabled={readOnly || !row.isManual}
                        placeholder="Artist Name"
                        class="w-full bg-navbar border border-gray1 rounded-lg px-2 py-1.5 text-sm text-white disabled:!text-gray3 focus:border-lime focus:outline-none placeholder-gray2/50 transition-colors disabled:!opacity-100 disabled:cursor-not-allowed"
                    />
                </div>
            </div>
        {/each}

        {#if rows.length === 0}
            <div class="text-xs text-gray2 italic p-1">No soundcheck times found.</div>
        {/if}

        {#if !readOnly}
            <button type="button" on:click={addRow} class="mt-1 text-xs text-lime font-bold hover:underline cursor-pointer flex items-center gap-1 self-start">
                <span>+</span> Add Custom Line
            </button>
        {/if}
    </div>
</SectionCard>