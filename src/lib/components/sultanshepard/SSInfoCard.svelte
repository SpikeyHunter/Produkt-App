<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';
    
    export let show: SSShow;
    const dispatch = createEventDispatcher();

    // Local state for address (Read Only here)
    let venueAddress = show.venue_address || '';

    // --- ROBUST DOS CONTACT INITIALIZATION ---
    let contactList: string[] = [''];

    // 1. Check if data exists
    if (show.dos_contact) {
        // Case A: It's already an array (rare, but good to handle)
        if (Array.isArray(show.dos_contact)) {
            contactList = show.dos_contact.map(c => typeof c === 'object' ? `${c.name} - ${c.phone}` : String(c));
        } 
        // Case B: It's a String
        else if (typeof show.dos_contact === 'string') {
            const raw = show.dos_contact.trim();
            
            // Check if it looks like a JSON Array e.g. '["Name - 123"]'
            if (raw.startsWith('[') && raw.endsWith(']')) {
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        contactList = parsed.map(c => {
                            // Handle if inner items are objects or strings
                            if (typeof c === 'object' && c !== null) {
                                return `${c.name || ''} ${c.phone ? '- ' + c.phone : ''}`.trim();
                            }
                            return String(c);
                        });
                    }
                } catch (e) {
                    console.warn("Failed to parse DOS contact JSON, using raw string", e);
                    contactList = [raw]; // Fallback
                }
            } 
            // Case C: It's just a plain text string (Legacy data)
            else if (raw.length > 0) {
                contactList = [raw];
            }
        }
    }

    // Ensure there is always at least one empty line if list is empty
    if (contactList.length === 0) contactList = [''];

    // --- END INITIALIZATION ---

    $: daysUntil = (() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const showDate = new Date(show.show_date);
        const diffTime = showDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        return `${diffDays} days until show`;
    })();

    $: dateDisplay = new Date(show.show_date).toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric', 
        timeZone: 'UTC' 
    });

    $: canAdd = contactList.length === 0 || contactList[contactList.length - 1].trim() !== '';

    function addContact() {
        if (canAdd) {
            contactList = [...contactList, ''];
        }
    }

    function removeContact(index: number) {
        contactList = contactList.filter((_, i) => i !== index);
        if (contactList.length === 0) contactList = [''];
        saveContacts();
    }

    function saveContacts() {
        const toSave = contactList.filter(c => c.trim() !== '');
        
        // IMPORTANT: Stringify the array before saving to match the Text column type
        const jsonString = JSON.stringify(toSave);
        
        updateSSShow(show.id, { dos_contact: jsonString });
        dispatch('update', { updates: { dos_contact: jsonString } });
    }
</script>

<div class="bg-navbar rounded-2xl p-4 flex gap-4 h-[220px] overflow-hidden">
    
    <div class="flex flex-col gap-2 w-28 flex-shrink-0 h-full">
        <div class="flex-1 w-full bg-gray-900 rounded-xl overflow-hidden relative min-h-0">
            {#if show.flyer_url}
                <img src={show.flyer_url} alt="Flyer" class="w-full h-full object-cover opacity-90" />
            {:else}
                <div class="w-full h-full flex items-center justify-center text-gray2 text-xs">No Flyer</div>
            {/if}
        </div>
        
        <div class="bg-gray3 text-black px-1 py-1.5 rounded-lg text-center font-bold text-[12px] leading-tight w-full flex-shrink-0">
            {dateDisplay}
        </div>
    </div>
    
    <div class="flex-1 flex flex-col min-w-0 h-full">
        <div class="flex-shrink-0 mb-2">
            <h2 class="text-xl font-bold text-white leading-tight whitespace-normal line-clamp-2">{show.show_venue}</h2>
            
            <div class="text-lime font-medium text-sm mt-0.5 whitespace-normal leading-tight">
                {show.show_city}, {show.show_country}
            </div>

            {#if show.venue_address}
                <div class="text-gray2 text-xs mt-0.5 whitespace-normal leading-tight">
                    {show.venue_address}
                </div>
            {/if}

            <div class="text-gray3 italic font-bold text-[10px] mt-1">{daysUntil}</div>
        </div>

        <div class="border-t border-gray1 w-full my-1 flex-shrink-0"></div>

        <div class="flex-1 flex flex-col min-h-0 relative">
            <div class="flex-shrink-0 mb-1">
                <span class="text-[12px] text-gray3 font-bold uppercase">DOS Contact(s)</span>
            </div>
            
            <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                <div class="space-y-1 pb-1">
                    {#each contactList as contact, i}
                        <div class="flex gap-2 items-center group">
                            <input 
                                type="text" 
                                class="flex-1 bg-gray1 rounded-2xl px-3 py-1 text-[11px] text-white border border-transparent focus:border-lime focus:ring-0 placeholder-gray2 outline-none transition-all w-full"
                                placeholder="Name - Number"
                                bind:value={contactList[i]}
                                on:blur={saveContacts}
                            />
                            
                            {#if contactList.length > 1 || contact.length > 0}
                                <button 
                                    class="text-[var(--color-problem)] hover:text-red-400 flex-shrink-0 cursor-pointer transition-colors p-1" 
                                    on:click={() => removeContact(i)}
                                    aria-label="Remove contact"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            {:else}
                                <div class="w-[20px]"></div>
                            {/if}
                        </div>
                    {/each}
                    
                    {#if canAdd}
                        <button 
                            class="text-[10px] text-lime hover:underline font-bold flex items-center gap-1 mt-1 cursor-pointer" 
                            on:click={addContact}
                        >
                            + Add Contact
                        </button>
                    {/if}
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 3px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>