<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    export let events: any[] = [];
    export let currentEventId: number | string | null = null;
    export let secondEventId: number | string | null = null;

    const dispatch = createEventDispatcher();

    interface RiderGroup {
        venueName: string;
        artists: {
            name: string;
            fileUrl: string;
            fileName: string;
        }[];
    }

    let riderGroups: RiderGroup[] = [];

    // Helper: JSON Parser
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

    // Reactive: Update everything whenever events or IDs change
    $: {
        if (events) {
            updateRiderGroups(events, currentEventId, secondEventId);
            generateBacklineList(events, currentEventId, secondEventId);
        }
    }

    /**
     * Generates backline lists for both main and second events.
     * Keeps them separate so they appear as distinct blocks in the email.
     */
    function generateBacklineList(allEvents: any[], mainId: number | string | null, secondId: number | string | null) {
        if (!allEvents) {
            formData.backline = [];
            return;
        }

        const sections: { venue: string; items: string[] }[] = [];

        // 1. Process Main Event
        if (mainId) {
            const mainSection = getVenueBackline(allEvents, mainId, 'Main Room');
            if (mainSection) sections.push(mainSection);
        }

        // 2. Process Second Event (e.g. Bazart)
        if (secondId) {
            const secondSection = getVenueBackline(allEvents, secondId, 'Bazart');
            if (secondSection) sections.push(secondSection);
        }

        formData.backline = sections;
    }

    /**
     * Helper to process backline for a specific Event ID
     */
    function getVenueBackline(allEvents: any[], eventId: number | string, defaultVenueName: string) {
        const relevantEvents = allEvents.filter(e => e.event_id == eventId);
        if (relevantEvents.length === 0) return null;

        const equipmentMap = new Map<string, number>();
        const mixerMap = new Map<string, string[]>();
        
        // Try to get real venue name from the first row, fallback to default
        let realVenueName = defaultVenueName;
        const firstVenue = relevantEvents.find(e => e.event_venue)?.event_venue;
        if (firstVenue) {
            realVenueName = firstVenue === 'New City Gas' ? 'Main Room' : firstVenue;
        }

        relevantEvents.forEach(row => {
            const rider = parseJson(row.tech_rider);
            if (!rider) return;

            // Equipment: Max Quantity Wins
            if (rider.equipment) {
                Object.entries(rider.equipment).forEach(([item, details]: [string, any]) => {
                    if (details && details.selected) {
                        const currentQty = details.qty ? Number(details.qty) : 1;
                        const existingQty = equipmentMap.get(item) || 0;
                        if (currentQty > existingQty) {
                            equipmentMap.set(item, currentQty);
                        }
                    }
                });
            }

            // Mixers: Group by Type
            if (rider.selected_mixer) {
                const mixer = rider.selected_mixer;
                if (!mixerMap.has(mixer)) {
                    mixerMap.set(mixer, []);
                }
                mixerMap.get(mixer)?.push(row.artist_name || 'Artist');
            }
        });

        const finalItems: string[] = [];
        
        equipmentMap.forEach((qty, item) => {
            finalItems.push(`${qty}x ${item}`);
        });

        if (mixerMap.size > 0) {
            mixerMap.forEach((artists, mixerName) => {
                if (mixerMap.size === 1) {
                    finalItems.push(`1x ${mixerName}`);
                } else {
                    finalItems.push(`1x ${mixerName} (${artists.join(', ')})`);
                }
            });
        }
        
        finalItems.sort();

        if (finalItems.length === 0) return null;

        return {
            venue: realVenueName,
            items: finalItems
        };
    }

    function updateRiderGroups(allEvents: any[], mainId: number | string | null, secondId: number | string | null) {
        if (!allEvents) {
             riderGroups = [];
             return;
        }

        const groups: RiderGroup[] = [];

        // 1. Main Event Group
        if (mainId) {
            const mainArtists = getArtistsWithRiders(allEvents, mainId);
            if (mainArtists.length > 0) {
                let title = 'Main Room - Riders';
                if (mainArtists[0].venue) {
                     title = mainArtists[0].venue === 'New City Gas' ? 'Main Room - Riders' : `${mainArtists[0].venue} - Riders`;
                }
                groups.push({ venueName: title, artists: mainArtists });
            }
        }

        // 2. Second Event Group
        if (secondId) {
            const secondArtists = getArtistsWithRiders(allEvents, secondId);
            if (secondArtists.length > 0) {
                groups.push({ venueName: 'Bazart - Riders', artists: secondArtists });
            }
        }

        riderGroups = groups;
    }

    function getArtistsWithRiders(allEvents: any[], eventId: number | string) {
        const rows = allEvents.filter(e => e.event_id == eventId);
        return rows.map(row => {
            const files = parseJson(row.rider_files);
            const riderUrl = files?.tech_rider_url;

            if (!riderUrl) return null;

            let formattedFileName = '';
            // Format Date
            if (row.event_date) {
                 try {
                     const d = new Date(row.event_date.replace(/-/g, '/'));
                     const day = d.getDate();
                     const month = d.toLocaleString('en-US', { month: 'short' });
                     const year = d.getFullYear();
                     formattedFileName = `${day}-${month}-${year}`;
                } catch (e) {}
            }
            
            // Format Venue
            const venue = row.event_venue || 'Venue';
            if (venue) {
                const venueName = venue === 'New City Gas' ? 'NCG' : venue;
                formattedFileName += formattedFileName ? ` - ${venueName}` : venueName;
            }

            // Format Artist
            formattedFileName += formattedFileName ? ` - ${row.artist_name}` : row.artist_name;
            formattedFileName += ` - Tech Rider.pdf`;

            return {
                name: row.artist_name,
                fileUrl: riderUrl,
                fileName: formattedFileName,
                venue: row.event_venue 
            };
        }).filter(Boolean) as { name: string; fileUrl: string; fileName: string; venue: string }[];
    }

    function handleViewRider(fileUrl: string, fileName: string) {
        dispatch('view-rider', { fileUrl, fileName });
    }

    function handleToggle(e: CustomEvent) { 
        dispatch('toggle', e.detail);
    }
    
    function handleReset() {
        if(readOnly) return;
        dispatch('reset');
    }
</script>

<SectionCard 
    title="Backline / Riders" 
    id="backline" 
    isVisible={formData.visible_sections['backline']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
    stretch={stretch}
>
    <div class="flex flex-col gap-4">
        
        {#if formData.backline && formData.backline.length > 0}
            {#each formData.backline as venue}
                <div class="mt-2 p-3 border border-gray1 rounded-2xl bg-navbar/50">
                    <div class="font-bold text-xs text-lime mb-2 uppercase tracking-wide">
                        {venue.venue}
                    </div>
    
                    <div class="flex flex-col gap-1.5">
                        {#each venue.items as item}
                            <div class="flex items-start gap-2">
                                <span class="text-gray2 text-[10px] mt-1">•</span>
                                <span class="text-xs text-white/90">{item}</span>
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        {:else}
            <div class="text-xs text-gray2 italic mt-2">
                No backline data available in Tech Riders.
            </div>
        {/if}

        {#if riderGroups.length > 0}
            <div class="flex flex-col gap-4 mt-2 pt-2 border-t border-gray1/30">
                {#each riderGroups as group}
                    <div class="flex flex-col gap-2">
                        <span class="text-[10px] text-lime uppercase font-bold ml-1">{group.venueName}</span>
                        <div class="flex flex-col gap-2">
                            {#each group.artists as artist}
                                <button 
                                    type="button"
                                    on:click={() => handleViewRider(artist.fileUrl, artist.fileName)}
                                    class="flex items-center w-full gap-3 bg-navbar border border-gray1 hover:bg-gray1/50 hover:text-white text-gray2 text-xs px-3 py-3 rounded-2xl transition-colors duration-200 group cursor-pointer text-left"
                                >
                                    <svg class="w-4 h-4 text-lime flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                    <span class="font-bold truncate">{artist.name} - Rider</span>
                                </button>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

    </div>
</SectionCard>