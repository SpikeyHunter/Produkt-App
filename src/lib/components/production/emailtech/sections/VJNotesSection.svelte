<script lang="ts">
    import { createEventDispatcher, tick } from 'svelte';
    import type { TechEmailForm } from '$lib/types/emailtech';
    import SectionCard from './SectionCard.svelte';

    export let formData: TechEmailForm;
    export let readOnly = false;
    export let vjName = 'VJ';
    const dispatch = createEventDispatcher();
    
    let textarea: HTMLTextAreaElement;
    let localNotes = '';

    // --- SYNC LOGIC ---
    $: if (formData) {
        syncNotes();
    }

    async function syncNotes() {
        if (formData.vj_notes === undefined) formData.vj_notes = '';
        
        if (formData.vj_notes !== localNotes) {
            localNotes = formData.vj_notes;
            await tick();
            if (textarea) adjustHeight(textarea);
        }
    }

    function handleChange() { 
        dispatch('change', formData);
    }

    function handleToggle(e: CustomEvent) { 
        const { id, isVisible } = e.detail;
        if (!formData.visible_sections) formData.visible_sections = {};
        formData.visible_sections[id] = isVisible;
        dispatch('toggle', e.detail); 
        handleChange(); 
    }

    function adjustHeight(el: HTMLTextAreaElement) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
    }

    function handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        localNotes = target.value;
        formData.vj_notes = localNotes;
        adjustHeight(target);
        handleChange();
    }

    async function handleReset() {
        if (readOnly) return;
        formData.vj_notes = '';
        localNotes = '';
        
        await tick();
        if (textarea) adjustHeight(textarea);
        
        handleChange(); 
    }
</script>

<SectionCard 
    title="VJ Notes" 
    id="vj_notes" 
    isVisible={formData.visible_sections?.['vj_notes']} 
    on:toggle={handleToggle} 
    on:reset={handleReset}
>
    <label>
        <span class="sr-only">VJ Notes</span>
        <textarea 
            bind:this={textarea}
            value={localNotes} 
            on:input={handleInput} 
            disabled={readOnly} 
            rows="1" 
            placeholder={`@${vjName} Notes...`}
            class="w-full bg-navbar border border-gray1 rounded-2xl p-3 text-sm text-white focus:border-lime focus:outline-none leading-relaxed placeholder-gray2/50 resize-none overflow-hidden min-h-[3rem]"
        ></textarea>
    </label>
</SectionCard>