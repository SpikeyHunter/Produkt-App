<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    const dispatch = createEventDispatcher();
    
    const DEFAULT_POST_SHOW = "Please make sure your work space is clean THANK YOU! :)";

    function handleChange() { dispatch('change'); }
    function handleToggle(e: CustomEvent) { dispatch('toggle', e.detail); }

    // Initialize default value if empty on mount
    onMount(() => {
        if (!formData.post_show) {
            formData.post_show = DEFAULT_POST_SHOW;
            dispatch('change');
        }
    });

    function handleReset() {
        if (readOnly) return;
        formData.post_show = DEFAULT_POST_SHOW;
        dispatch('change');
    }
</script>

<SectionCard 
    title="Post Show" 
    id="sponsors" 
    isVisible={formData.visible_sections['sponsors']} 
    on:toggle={handleToggle}
    on:reset={handleReset}
>
    <div class="flex flex-col gap-4">
        
        <div class="flex flex-col gap-1.5 relative z-0">
           <textarea 
                bind:value={formData.post_show} 
                on:input={handleChange} 
                disabled={readOnly} 
                rows="2" 
                placeholder="Instructions..."
                class="w-full bg-navbar border border-gray1 rounded-2xl px-3 py-2.5 text-sm text-white focus:border-lime focus:outline-none placeholder-gray2/50 transition-colors resize-none"
            ></textarea>
        </div>

    </div>
</SectionCard>