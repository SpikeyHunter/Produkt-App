<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import { fly } from 'svelte/transition';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    const dispatch = createEventDispatcher();

    let textarea: HTMLTextAreaElement;
    let projectsInputValue = '';

    // --- 1. SYNC LOGIC (Load data from Prop) ---
    // This reactive block runs whenever formData changes (e.g. switching events or page load)
    $: if (formData) {
        syncProjectsFromProp();
        ensureSpecsInit();
    }

    function ensureSpecsInit() {
        if (!formData.specs_links || formData.specs_links.length === 0) {
            formData.specs_links = [{ label: '', url: '' }];
        }
    }

    async function syncProjectsFromProp() {
        const rawProjects = formData.projects as unknown;
        let newStr = '';

        if (Array.isArray(rawProjects)) {
            newStr = rawProjects.join('\n');
        } else if (typeof rawProjects === 'string') {
            newStr = rawProjects;
        }

        // Only update local state if it differs from the prop (prevents cursor jumping/loops)
        // OR if we are switching events (implicit via the fact that formData ref changed)
        if (newStr !== projectsInputValue) {
            projectsInputValue = newStr;
            
            // Wait for DOM to update with new text, then resize
            await tick();
            if (textarea) adjustHeight(textarea);
        } else {
            // Even if text didn't change (e.g. initial load), ensure height is correct
            await tick();
            if (textarea) adjustHeight(textarea);
        }
    }

    // --- 2. UPDATE LOGIC (Write data to Prop) ---
    function handleProjectInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        projectsInputValue = target.value; // Update local
        
        // Update Prop
        // @ts-ignore
        formData.projects = projectsInputValue.split('\n');
        
        adjustHeight(target);
        dispatch('change');
    }

    function adjustHeight(el: HTMLTextAreaElement) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }


    // --- DROPDOWN LOGIC ---
    const SPECS_OPTIONS = [
        { label: 'Bazart Specs', url: 'https://drive.google.com/drive/folders/1f-twa-hlssqjpUD2CN0zdqGn8cYnbpWY?usp=share_link', color: '#ffe089ff' },
        { label: 'DSTRKT Specs', url: 'https://drive.google.com/drive/folders/13ZyO3sv6suZHnkxn8jN1mnS2N_Foqzyx?usp=share_link', color: '#afd3e9ff' },
        { label: 'NCG Specs', url: 'https://drive.google.com/drive/folders/13_TFSl6-u6JF6mZ7XD9hJ9SRVAWTEc0e?usp=share_link', color: '#c4ef9bff' },
        { label: 'NCG 360 Specs', url: 'https://drive.google.com/file/d/13VNqmW0KWzLnsQTqn8bDEJpJGYJ35Tpq/view?usp=share_link', color: '#fa7a90ff' },
        { label: 'Other', url: '', color: '#9ca3af' }
    ];

    let showDropdown = false;

    // Reactive helpers for the dropdown UI
    $: currentSpec = formData.specs_links?.[0] || { label: '', url: '' };
    $: selectedOption = SPECS_OPTIONS.find(opt => opt.label === currentSpec.label) 
        || (currentSpec.label ? { label: currentSpec.label, color: '#9ca3af', url: '' } : null);

    function selectSpec(option: typeof SPECS_OPTIONS[0]) {
        if (!formData.specs_links) formData.specs_links = [];
        
        if (option.label === 'Other') {
            formData.specs_links[0] = { label: 'Other', url: '' };
        } else {
            formData.specs_links[0] = { label: option.label, url: option.url };
        }
        
        showDropdown = false;
        dispatch('change');
    }

    function handleOtherUrlChange(e: Event) {
        const target = e.target as HTMLInputElement;
        if (formData.specs_links[0]) {
            formData.specs_links[0].url = target.value;
            dispatch('change');
        }
    }

    // RESET: Clears projects and specs
    async function handleReset() {
        if (readOnly) return;
        
        formData.projects = [];
        projectsInputValue = '';
        formData.specs_links = [{ label: '', url: '' }];
        
        await tick();
        if (textarea) adjustHeight(textarea);
        
        dispatch('change');
    }
</script>

<svelte:window on:click={(e) => {
    if (showDropdown && !(e.target as Element).closest('.specs-dropdown')) {
        showDropdown = false;
    }
}} />

<SectionCard 
    title="Projects & Specs" 
    id="projects" 
    isVisible={formData.visible_sections['projects']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div class="md:col-span-2 flex flex-col gap-1.5">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Project List</span>
            <label class="block">
                <span class="sr-only">Projects Description</span>
                <textarea 
                    bind:this={textarea}
                    value={projectsInputValue} 
                    on:input={handleProjectInput} 
                    disabled={readOnly} 
                    rows="1" 
                    placeholder="Describe projects"
                    class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-sm text-white focus:border-lime focus:outline-none leading-relaxed placeholder-gray2/50 resize-none overflow-hidden min-h-[46px] transition-colors"
                ></textarea>
            </label>
        </div>

        <div class="md:col-span-1 flex flex-col gap-1.5 relative z-20">
            <span class="text-[10px] text-gray2 uppercase font-bold ml-1">Stage Specs</span>
            
            <div class="relative specs-dropdown">
                <button 
                    type="button"
                    disabled={readOnly}
                    on:click={() => showDropdown = !showDropdown}
                    class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-sm text-white flex items-center justify-between hover:bg-gray1/50 transition-colors focus:outline-none focus:ring-1 focus:ring-lime cursor-pointer min-h-[46px]"
                >
                    <span class="flex items-center gap-2 truncate">
                        {#if selectedOption && selectedOption.label}
                            <span class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {selectedOption.color};"></span>
                            <span>{selectedOption.label}</span>
                        {:else}
                            <span class="text-gray2/50">Select Specs</span>
                        {/if}
                    </span>
                    {#if !readOnly}
                        <svg class="w-4 h-4 text-gray2 transition-transform {showDropdown ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    {/if}
                </button>

                {#if showDropdown && !readOnly}
                    <div 
                        transition:fly={{ y: -5, duration: 150 }}
                        class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-gray1 rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                        {#each SPECS_OPTIONS as option}
                            <button 
                                type="button"
                                on:click={() => selectSpec(option)}
                                class="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-gray1 flex items-center gap-3 transition-colors border-b border-gray1 last:border-0 cursor-pointer"
                            >
                                <span class="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" style="background-color: {option.color};"></span>
                                {option.label}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if currentSpec.label === 'Other'}
                <div transition:fly={{ y: -5, duration: 150 }}>
                    <input 
                        type="text" 
                        value={currentSpec.url} 
                        on:input={handleOtherUrlChange}
                        disabled={readOnly}
                        placeholder="Paste custom link here"
                        class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-3 text-xs text-white placeholder-gray2/50 focus:border-lime focus:outline-none transition-colors" 
                    />
                </div>
            {/if}
            
        </div>
    </div>
</SectionCard>