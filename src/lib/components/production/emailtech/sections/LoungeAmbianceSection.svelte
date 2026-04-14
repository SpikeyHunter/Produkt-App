<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { fly } from 'svelte/transition';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let stretch = false;
    const dispatch = createEventDispatcher();

    // --- OPTIONS ---
    // "Other" is moved to the top. "Unselected" removed.
    const BACK_SIDE_OPTS = [
        'Other',
        'No Music',
        '5PM to Close - Playlist',
        '5PM - Playlist & 12AM - Bazart Music',
        '5PM - Playlist & 12AM - Main Room Music'
    ];

    const BACK_OPTS = [
        'Other',
        'No Music',
        '10PM - Main Room Music (ambiance/not too loud)'
    ];

    const LOUNGE_OPTS = [
        'Other',
        'No Music',
        '5PM - Playlist & 10PM - Bazart Music',
        '5PM - Playlist & 12AM - Main Room Music (when Bazart closed)'
    ];

    // --- LOCAL STATE ---
    $: if (formData && !formData.lounge_ambiance) {
        formData.lounge_ambiance = {
            terrasse_type: null,
            terrasse_option: '',
            terrasse_custom: '',
            lounge_option: '',
            lounge_custom: ''
        };
    }

    $: terrasseType = formData.lounge_ambiance?.terrasse_type || null;
    $: terrasseOption = formData.lounge_ambiance?.terrasse_option || '';
    $: terrasseCustom = formData.lounge_ambiance?.terrasse_custom || '';
    $: loungeOption = formData.lounge_ambiance?.lounge_option || '';
    $: loungeCustom = formData.lounge_ambiance?.lounge_custom || '';

    // --- ACTIONS ---

    function toggleTerrasseType(type: 'back-side' | 'back') {
        if (!formData.lounge_ambiance) return;

        if (formData.lounge_ambiance.terrasse_type === type) {
            // Unselect if clicked again
            formData.lounge_ambiance.terrasse_type = null;
            formData.lounge_ambiance.terrasse_option = ''; 
            formData.lounge_ambiance.terrasse_custom = '';
        } else {
            formData.lounge_ambiance.terrasse_type = type;
            formData.lounge_ambiance.terrasse_option = '';
            formData.lounge_ambiance.terrasse_custom = '';
        }
        dispatch('change');
    }

    function toggleOption(field: 'terrasse_option' | 'lounge_option', value: string) {
        if (!formData.lounge_ambiance) return;
        
        // If clicking the same option, unselect it (set to empty)
        if (formData.lounge_ambiance[field] === value) {
            formData.lounge_ambiance[field] = '';
        } else {
            formData.lounge_ambiance[field] = value;
        }
        dispatch('change');
        activeDropdown = null; // Close dropdown after selection
    }

    function handleCustomInput(field: 'terrasse_custom' | 'lounge_custom', e: Event) {
        if (!formData.lounge_ambiance) return;
        const target = e.target as HTMLInputElement;
        formData.lounge_ambiance[field] = target.value;
        dispatch('change');
    }

    function handleToggle(e: CustomEvent) {
        dispatch('toggle', e.detail);
    }

    function handleReset() {
        if (readOnly) return;
        formData.lounge_ambiance = {
            terrasse_type: null,
            terrasse_option: '',
            terrasse_custom: '',
            lounge_option: '',
            lounge_custom: ''
        };
        dispatch('change');
    }

    // Dropdown UI Helpers
    let activeDropdown: string | null = null;
    
    function toggleDropdown(id: string) {
        if (activeDropdown === id) activeDropdown = null;
        else activeDropdown = id;
    }
</script>

<svelte:window on:click={(e) => {
    const target = e.target as HTMLElement;
    if (target && !target.closest('.custom-dropdown')) {
        activeDropdown = null;
    }
}} />

<SectionCard 
    title="Lounge Ambiance" 
    id="lounge_ambiance" 
    isVisible={formData.visible_sections?.['lounge_ambiance']} 
    on:toggle={handleToggle} 
    on:reset={handleReset}
    {stretch}
>
    <div class="flex flex-col gap-2">
        
        <div class="flex flex-col gap-2">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Terrasse Selection</span>
            
            <div class="grid grid-cols-2 gap-2">
                <button 
                    type="button" 
                    disabled={readOnly}
                    on:click={() => toggleTerrasseType('back-side')}
                    class="py-1.5 px-3 rounded-xl hover:cursor-pointer border text-xs font-bold transition-all {terrasseType === 'back-side' ? 'bg-lime text-black border-lime' : 'bg-navbar border-gray1 text-gray2 hover:border-gray3 hover:text-white'}"
                >
                    Back-Side Terrasse
                </button>
                <button 
                    type="button" 
                    disabled={readOnly}
                    on:click={() => toggleTerrasseType('back')}
                    class="py-1.5 px-3 rounded-xl border hover:cursor-pointer text-xs font-bold transition-all {terrasseType === 'back' ? 'bg-lime text-black border-lime' : 'bg-navbar border-gray1 text-gray2 hover:border-gray3 hover:text-white'}"
                >
                    Back Terrasse
                </button>
            </div>

            {#if terrasseType}
                <div class="relative custom-dropdown" transition:fly={{ y: -5, duration: 200 }}>
                    <button 
                        type="button"
                        disabled={readOnly}
                        on:click={() => toggleDropdown('terrasse')}
                        class="w-full bg-navbar border border-gray1 hover:cursor-pointer rounded-2xl px-3 py-2 text-xs text-white flex items-center justify-between hover:bg-gray1/50 transition-colors focus:outline-none focus:ring-1 focus:ring-lime min-h-[34px]"
                    >
                        <span class={terrasseOption ? "text-white font-bold" : "text-gray2"}>
                            {terrasseOption || 'Select Option...'}
                        </span>
                        <svg class="w-3.5 h-3.5 text-gray2 transition-transform {activeDropdown === 'terrasse' ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>

                    {#if activeDropdown === 'terrasse' && !readOnly}
                        <div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-gray1 rounded-xl shadow-xl z-50 overflow-hidden">
                            {#each (terrasseType === 'back-side' ? BACK_SIDE_OPTS : BACK_OPTS) as opt}
                                {@const isSelected = terrasseOption === opt}
                                <button 
                                    type="button"
                                    on:click={() => toggleOption('terrasse_option', opt)}
                                    class="w-full text-left px-4 py-2 hover:cursor-pointer text-xs hover:bg-gray1 border-b border-gray1 last:border-0 flex items-center justify-between {isSelected ? 'text-lime font-bold' : 'text-white'}"
                                >
                                    <span>{opt}</span>
                                    {#if isSelected}
                                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    {/if}
                                </button>
                            {/each}
                        </div>
                    {/if}
                </div>

                {#if terrasseOption === 'Other'}
                    <div transition:fly={{ y: -5, duration: 150 }}>
                        <input 
                            type="text" 
                            value={terrasseCustom} 
                            on:input={(e) => handleCustomInput('terrasse_custom', e)}
                            disabled={readOnly}
                            placeholder="Specify details"
                            class="w-full bg-navbar border border-gray1 hover:cursor-pointer rounded-2xl px-3 py-2 text-xs text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors" 
                        />
                    </div>
                {/if}
            {/if}
        </div>

        <div class="h-[1px] bg-gray1/30 w-full my-0.5"></div>

        <div class="flex flex-col gap-2">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Lounge</span>
            
            <div class="relative custom-dropdown">
                <button 
                    type="button"
                    disabled={readOnly}
                    on:click={() => toggleDropdown('lounge')}
                    class="w-full bg-navbar border border-gray1 hover:cursor-pointer rounded-2xl px-3 py-2 text-xs text-white flex items-center justify-between hover:bg-gray1/50 transition-colors focus:outline-none focus:ring-1 focus:ring-lime min-h-[34px]"
                >
                    <span class={loungeOption ? "text-white font-bold" : "text-gray2"}>
                        {loungeOption || 'Select Option...'}
                    </span>
                    <svg class="w-3.5 h-3.5 text-gray2 transition-transform {activeDropdown === 'lounge' ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
                </button>

                {#if activeDropdown === 'lounge' && !readOnly}
                    <div class="absolute top-full left-0 right-0 mt-1 hover:cursor-pointer bg-navbar border border-gray1 rounded-xl shadow-xl z-50 overflow-hidden">
                        {#each LOUNGE_OPTS as opt}
                            {@const isSelected = loungeOption === opt}
                            <button 
                                type="button"
                                on:click={() => toggleOption('lounge_option', opt)}
                                class="w-full text-left px-4 py-2 text-xs hover:cursor-pointer hover:bg-gray1 border-b border-gray1 last:border-0 flex items-center justify-between {isSelected ? 'text-lime font-bold' : 'text-white'}"
                            >
                                <span>{opt}</span>
                                {#if isSelected}
                                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if loungeOption === 'Other'}
                <div transition:fly={{ y: -5, duration: 150 }}>
                    <input 
                        type="text" 
                        value={loungeCustom} 
                        on:input={(e) => handleCustomInput('lounge_custom', e)}
                        disabled={readOnly}
                        placeholder="Specify details"
                        class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-2 text-xs text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors" 
                    />
                </div>
            {/if}
        </div>

    </div>
</SectionCard>