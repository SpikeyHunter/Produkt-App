<script lang="ts">
    import type { EmailTechEvent } from '$lib/types/emailtech';

    export let event: EmailTechEvent | null = null;

    function formatDate(dateString: string | null): string {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        return localDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
</script>

{#if event}
    <div class="w-full bg-navbar border border-gray1 rounded-xl p-3 flex items-start gap-4">
        
        <div class="flex-shrink-0 w-28 bg-black rounded-lg overflow-hidden border border-gray1 relative self-start">
            {#if event.event_flyer}
                <img 
                    src={event.event_flyer} 
                    alt={event.event_name} 
                    class="w-full h-auto block"
                />
            {:else}
                <div class="w-full aspect-[3/4] flex items-center justify-center text-gray2 bg-gray1">
                    <span class="text-[10px]">No Flyer</span>
                </div>
            {/if}
            
            {#if event.event_status === 'LIVE'}
                <div class="absolute top-1 right-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-lime text-black shadow-sm">
                    LIVE
                </div>
            {/if}
        </div>

        <div class="flex flex-col justify-center min-w-0 py-1 space-y-1">
            
            <div class="text-white font-bold text-sm leading-snug break-words">
                {event.event_name || event.artist_name}
            </div>

            <div class="text-gray3 text-xs leading-snug break-words">
                {formatDate(event.event_date)}
            </div>

            <div class="text-lime text-xs font-bold leading-snug break-words">
                {event.event_venue || 'No Venue'}
            </div>

            <div class="text-gray2 text-xs font-mono pt-1">
                Event ID: {event.event_id}
            </div>
            
        </div>
    </div>
{:else}
    <div class="w-full bg-navbar border border-gray1 rounded-xl p-6 flex flex-col items-center justify-center text-gray2 gap-2">
        <svg class="w-8 h-8 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <span class="text-xs italic">Select an event</span>
    </div>
{/if}