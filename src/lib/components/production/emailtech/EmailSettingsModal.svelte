<script lang="ts">
    // Gear on the Email Tech page: the email settings, applied the moment
    // they are saved (every section reads the emailSettings store).
    import { createEventDispatcher } from 'svelte';
    import Modal from '$lib/components/modals/Modal.svelte';
    import EmailSettingsPanel from '$lib/components/settings/EmailSettingsPanel.svelte';

    export let isOpen = false;
    const dispatch = createEventDispatcher<{ close: void }>();
</script>

<Modal {isOpen} title="Email settings" maxWidth="max-w-4xl" on:close={() => dispatch('close')}>
    <p class="text-gray2 text-sm mb-4">
        Subject lines, CC/BCC, who gets attached automatically, crew-call defaults, stage specs and the
        lights / lounge options. Saved settings apply to the page right away.
    </p>
    <!-- the modal is portaled to <body>, so the page's cursor rule needs the class here too -->
    <div class="emailtech-page min-h-[560px] flex flex-col">
        {#if isOpen}
            <EmailSettingsPanel compact on:saved={() => dispatch('close')} />
        {/if}
    </div>
</Modal>
