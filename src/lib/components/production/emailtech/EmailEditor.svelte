<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    export let content: string = '';
    export let readOnly: boolean = false;
    export let placeholder: string = 'Enter email content here...';

    const dispatch = createEventDispatcher();

    function handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        content = target.value;
        dispatch('change', content);
    }
</script>

<div class="h-full flex flex-col relative group">
    <textarea
        class="w-full h-full bg-navbar text-white p-4 text-sm font-mono resize-none focus:outline-none focus:ring-1 focus:ring-lime rounded-lg placeholder-gray2 leading-relaxed"
        {placeholder}
        value={content}
        on:input={handleInput}
        readonly={readOnly}
    ></textarea>
    
    {#if readOnly}
        <div class="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg pointer-events-none">
            <span class="text-gray2 font-bold text-sm">Select an event to edit</span>
        </div>
    {/if}
</div>

<style>
    textarea::-webkit-scrollbar { width: 8px; }
    textarea::-webkit-scrollbar-track { background: transparent; }
    textarea::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    textarea::-webkit-scrollbar-thumb:hover { background: #444; }
</style>