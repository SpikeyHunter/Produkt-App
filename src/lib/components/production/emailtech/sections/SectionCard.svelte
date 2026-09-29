<script lang="ts">
    import { createEventDispatcher, getContext } from 'svelte';
    import type { Readable } from 'svelte/store';
    import type { Touch } from '$lib/services/emailTechSync';

    export let title: string;
    export let isVisible: boolean = true;
    export let id: string = '';
    export let stretch: boolean = false; 

    const dispatch = createEventDispatcher();

    // Who else touched this section in the last few seconds (set by EmailEditor).
    const touched = getContext<Readable<Record<string, Touch>> | undefined>('emailtech-touched');
    $: touch = touched && id ? $touched?.[id] : undefined;
    
    let resetActive = false;
    let resetTimer: ReturnType<typeof setTimeout>;

    function toggleVisibility() {
        dispatch('toggle', { id, isVisible: !isVisible });
    }

    function handleResetClick() {
        if (!resetActive) {
            resetActive = true;
            clearTimeout(resetTimer);
            resetTimer = setTimeout(() => {
                resetActive = false;
            }, 3000);
        } else {
            resetActive = false;
            clearTimeout(resetTimer);
            dispatch('reset');
        }
    }
</script>

<!-- data-section lets the page know which card has focus (presence) -->
<div data-section={id} class="bg-gray1/30 border rounded-lg transition-all duration-200 
    {isVisible ? 'opacity-100' : 'opacity-60'} 
    {stretch ? 'h-full flex flex-col mb-0' : 'mb-4'}"
    style={touch ? `border-color: ${touch.color};` : 'border-color: var(--color-gray1);'}>
    
    <div class="w-full flex items-center justify-between p-3 bg-gray1/50 rounded-t-lg shrink-0">
        <span class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-bold text-lime uppercase tracking-wider">{title}</span>
            {#if touch}
                <span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-black truncate"
                      style="background-color: {touch.color};"
                      title="{touch.user} is editing this section">
                    ✎ {touch.user}
                </span>
            {/if}
        </span>
        
        <div class="flex items-center gap-3">
            {#if isVisible && !['set_times', 'travelling', 'vj', 'sfx', 'footer'].includes(id)} 
                <button 
                    type="button"
                    on:click={handleResetClick}
                    class="text-[10px] font-bold uppercase transition-all duration-200 focus:outline-none 
                    {resetActive ? 'text-problem animate-pulse' : 'text-gray2 hover:cursor-pointer hover:text-white'}"
                >
                    {resetActive ? 'Are you sure?' : 'Reset'}
                </button>
            {/if}

            <button 
                type="button"
                role="switch"
                aria-checked={isVisible}
                aria-label="Toggle {title} section"
                on:click={toggleVisibility}
                class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-lime
                {isVisible ? 'bg-lime' : 'bg-gray2'}"
            >
                <span
                    aria-hidden="true"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out
                    {isVisible ? 'translate-x-4' : 'translate-x-0'}"
                ></span>
            </button>
        </div>
    </div>
    
    {#if isVisible}
        <div class="p-3 space-y-3 border-t border-gray1/30 {stretch ? 'flex-1' : ''}">
            <slot />
        </div>
    {/if}
</div>
