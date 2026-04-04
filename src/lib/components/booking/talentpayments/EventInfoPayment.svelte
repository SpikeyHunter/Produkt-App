<script lang="ts">
    export let event: any | null = null;

    function formatDisplayDate(dateStr: string): string {
        if (!dateStr) return '';
        
        // Fixed Date Parsing: Append T12:00:00 (midday) if there isn't a time already
        // This ensures parsing YYYY-MM-DD doesn't shift backward to the previous day in local time
        const safeDateStr = dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`;
        
        return new Date(safeDateStr).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    function isHeadliner(entry: any): boolean {
        // Strict check as requested
        return entry.notes === 'Headliner';
    }
</script>

<div class="h-full bg-navbar border border-gray1 rounded-2xl overflow-hidden shadow-lg flex flex-col p-5">
    {#if event}
        <div class="mb-6 border-b border-gray1 pb-4 flex-shrink-0">
            <div class="flex items-center text-sm font-bold truncate mb-1">
                <span class="text-lime whitespace-nowrap">{formatDisplayDate(event.event_date)}</span>
                <span class="text-gray2 mx-2">•</span>
                <span class="text-white truncate">{event.event_venue || 'NCG'}</span>
            </div>
            
            <div class="text-xs text-gray2 font-bold font-mono uppercase tracking-wider flex items-center gap-2">
                <span class="opacity-60">Event ID:</span>
                <span class="text-white opacity-90">{event.event_id}</span>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto no-scrollbar flex flex-col justify-start">
            {#if event.timetable && event.timetable.length > 0}
                 <h3 class="text-xs font-bold text-gray2 uppercase tracking-wider mb-4 opacity-80">Set Times</h3>

                 <div class="flex flex-col gap-3">
                    {#each event.timetable as entry}
                        {@const headliner = isHeadliner(entry)}
                        
                        <div class="flex items-baseline gap-4">
                            <div class="w-16 text-right flex-shrink-0">
                                <span class="font-bold text-sm {headliner ? 'text-lime' : 'text-gray2'}">
                                    {entry.time}
                                </span>
                            </div>

                            <div class="flex-1 min-w-0">
                                <span class="block truncate text-sm {headliner ? 'text-lime font-black text-base' : 'text-white font-bold'}">
                                    {entry.artist}
                                </span>
                            </div>
                        </div>
                    {/each}
                 </div>
            {:else}
                <div class="mt-10 text-center text-gray2 text-xs italic opacity-50">
                    <p>No set times published</p>
                </div>
            {/if}
        </div>
    {:else}
         <div class="h-full flex flex-col items-center justify-center text-gray2 opacity-50 space-y-2">
            <div class="w-8 h-8 rounded-full border-2 border-gray2 flex items-center justify-center">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <span class="text-xs font-bold">Select event</span>
        </div>
    {/if}
</div>

<style>
    /* Completely hide scrollbars but keep functionality */
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none; /* IE and Edge */
        scrollbar-width: none; /* Firefox */
    }
</style>