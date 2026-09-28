<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TechEmailForm, EmailTechEvent } from '$lib/types/emailtech';
    import { emailSettings } from '$lib/services/emailSettingsService';
    import { techCallTime, firstSoundcheckStart } from '$lib/services/techTemplateService';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    /** used for the soundcheck rule (call = first soundcheck − offset) */
    export let events: EmailTechEvent[] = [];
    /** every advance row (all artists), so every soundcheck is seen */
    export let allEvents: EmailTechEvent[] = [];
    const dispatch = createEventDispatcher();

    $: rule = $emailSettings.crewCall;
    $: autoTechTime = techCallTime(events, rule, allEvents);
    $: soundcheckStart = firstSoundcheckStart(events, allEvents);

    // No calls yet (or none with a time) and nothing typed by hand -> the
    // automatic times: soundcheck − offset, else the settings default (7PM).
    $: if (formData && autoTechTime && !formData.crew_calls_manual) {
        if (!formData.crew_calls) {
            formData.crew_calls = defaultCalls();
            dispatch('change');
        } else if (formData.crew_calls.length && formData.crew_calls.every((c) => !c.time)) {
            formData.crew_calls = formData.crew_calls.map((c, i) => ({ ...c, time: i === 0 ? autoTechTime : i === 1 ? rule.vjTime || '21:00' : c.time }));
            dispatch('change');
        } else if (formData.crew_calls[0] && formData.crew_calls[0].time !== autoTechTime) {
            // still automatic: follow the soundcheck / settings
            formData.crew_calls[0].time = autoTechTime;
            dispatch('change');
        }
    }

    function defaultCalls() {
        return [
            { time: autoTechTime || rule.techTime || '19:00', names: '' },
            { time: rule.vjTime || '21:00', names: '' }
        ];
    }

    // Any edit by hand pins the calls: autofill leaves them alone from then on.
    function handleChange() { formData.crew_calls_manual = true; dispatch('change'); }
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
        }
        handleChange();
    }

    /** Put the times back on automatic (settings default / soundcheck rule). */
    function useAutoTimes() {
        if (readOnly) return;
        const calls = formData.crew_calls.length ? [...formData.crew_calls] : defaultCalls();
        calls[0] = { ...calls[0], time: autoTechTime };
        if (calls[1]) calls[1] = { ...calls[1], time: rule.vjTime || '21:00' };
        formData.crew_calls = calls;
        formData.crew_calls_manual = false;
        dispatch('change');
    }

    // RESET: default calls from settings (empty names), automatic again
    function handleReset() {
        if (readOnly) return;
        formData.crew_calls = defaultCalls();
        formData.crew_calls_manual = false;
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
                    value={call.names} 
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
        <div class="flex items-center justify-between mt-1 gap-3">
            <button type="button" on:click={addCrewCall} class="text-xs text-lime font-bold hover:underline cursor-pointer flex items-center gap-1">
                <span>+</span> Add Call Time
            </button>
            {#if formData.crew_calls_manual}
                <!-- times were edited by hand; put them back on automatic -->
                <button type="button" on:click={useAutoTimes} class="text-[10px] font-bold uppercase text-gray2 hover:text-lime cursor-pointer shrink-0"
                    title="Back to automatic times (soundcheck − {rule.soundcheckOffsetMin} min, or {rule.techTime})">Auto times</button>
            {/if}
        </div>
    {/if}
</SectionCard>