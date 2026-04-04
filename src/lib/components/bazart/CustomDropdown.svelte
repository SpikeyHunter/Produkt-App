<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';

    export let options: { value: string, label: string }[] = [];
    export let selectedValue: string = options.length > 0 ? options[0].value : '';
    
    let isOpen = false;
    let dropdownRef: HTMLDivElement;
    
    const dispatch = createEventDispatcher();

    $: selectedLabel = options.find(o => o.value === selectedValue)?.label || 'Select...';

    function selectOption(value: string) {
        selectedValue = value;
        isOpen = false;
        dispatch('change', value);
    }

    function handleClickOutside(event: MouseEvent) {
        if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
            isOpen = false;
        }
    }

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });
</script>

<div class="relative" bind:this={dropdownRef}>
    <button 
        type="button"
        class="flex items-center justify-between w-56 bg-navbar border border-gray2/20 hover:border-gray2 text-white px-6 py-2.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-lime cursor-pointer"
        on:click={() => isOpen = !isOpen}
    >
        <span class="text-sm font-bold">{selectedLabel}</span>
        <svg class="w-4 h-4 text-gray2 transition-transform {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
    </button>

    {#if isOpen}
        <div class="absolute z-50 w-full mt-2 bg-navbar border border-gray2/20 rounded-2xl shadow-2xl overflow-hidden py-2">
            {#each options as option}
                <button
                    class="w-full text-left px-6 py-2.5 text-sm transition-colors cursor-pointer {selectedValue === option.value ? 'bg-lime/10 text-lime font-bold' : 'text-gray3 hover:bg-white/5 hover:text-white font-medium'}"
                    on:click={() => selectOption(option.value)}
                >
                    {option.label}
                </button>
            {/each}
        </div>
    {/if}
</div>