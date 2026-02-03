<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    const dispatch = createEventDispatcher();

    // --- REACTIVE INIT (The Fix) ---
    // Ensure that if we switch to an event with missing crew data, 
    // it initializes correctly instead of showing nothing or crashing.
    $: if (formData && !formData.crew_calls) {
        formData.crew_calls = [
            { time: '19:00', names: '' },
            { time: '20:30', names: '' }
        ];
    }

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }

    function addCrewCall() { 
        formData.crew_calls = [...formData.crew_calls, { time: '', names: '' }];
        handleChange();
    }
    
    function removeCrewCall(i: number) { 
        formData.crew_calls = formData.crew_calls.filter((_, idx) => idx !== i);
        handleChange();
    }

    function handleNameInput(i: number, e: Event) {
        const input = e.target as HTMLInputElement;
        const val = input.value;
        const formatted = val.replace(/(^|,\s*)([a-z])/g, (match) => match.toUpperCase());
        if (formatted !== formData.crew_calls[i].names) {
            formData.crew_calls[i].names = formatted;
            handleChange();
        } else {
            handleChange();
        }
    }

    // RESET: Reverts to standard default calls (empty names)
    function handleReset() {
        if (readOnly) return;
        formData.crew_calls = [
            { time: '19:00', names: '' },
            { time: '20:30', names: '' }
        ];
        dispatch('change');
    }
</script>

<SectionCard 
    title="Crew Call" 
    id="crew_call" 
    isVisible={formData.visible_sections['crew_call']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <div class="flex flex-col gap-2">
        {#if formData.crew_calls}
            {#each formData.crew_calls as call, i}
                <div class="flex gap-3 items-center">
                    <input 
                        aria-label="Call Time" 
                        type="time" 
                        bind:value={call.time} 
                        on:input={handleChange} 
                        disabled={readOnly}
                        class="bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-sm text-white w-[5.5rem] text-center focus:border-lime focus:outline-none transition-colors" 
                    />
                    
                    <input 
                        aria-label="Crew Names" 
                        type="text" 
                        bind:value={call.names} 
                        on:input={(e) => handleNameInput(i, e)} 
                        disabled={readOnly} 
                        placeholder="Enter names here"
                        class="flex-1 bg-navbar border border-gray1 rounded-2xl px-4 py-2 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-colors" 
                    />
                    
                    {#if !readOnly}
                        <button type="button" aria-label="Remove crew call" on:click={() => removeCrewCall(i)} class="text-gray2 hover:text-problem cursor-pointer p-1 transition-colors">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>
    
    {#if !readOnly}
        <button type="button" on:click={addCrewCall} class="mt-1 text-xs text-lime font-bold hover:underline cursor-pointer flex items-center gap-1">
            <span>+</span> Add Call Time
        </button>
    {/if}
</SectionCard>