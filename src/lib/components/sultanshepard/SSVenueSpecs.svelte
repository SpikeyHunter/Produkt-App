<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';
    import { supabase } from '$lib/supabase';
    import { portal } from '$lib/utils/portalUtils';
    import UploadModal from '$lib/components/modals/UploadModal.svelte';
    import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    // Initialize from JSONB column (venue_info) or fallbacks
    let venueInfo = show.venue_info || {};
    let pixelMap = venueInfo.pixel_map || 'no';
    let camera = venueInfo.camera || 'no';
    let sdiConfirmed = venueInfo.sdi_confirmed || 'no';
    let bringOwnCamera = venueInfo.bring_own_camera || 'no';

    // Specs Link (Top Level Column)
    let specsLink = show.show_specs || '';

    // Modal State
    let showUploadModal = false;
    let showPreviewModal = false;
    let isUploading = false;
    let isDeleting = false;
    let debounceTimer: any;

    // --- Saving Logic ---

    async function saveVenueInfo() {
        // Update local object
        venueInfo = {
            ...venueInfo,
            pixel_map: pixelMap,
            camera: camera,
            sdi_confirmed: sdiConfirmed,
            bring_own_camera: bringOwnCamera
        };

        // Save to DB
        await updateSSShow(show.id, { venue_info: venueInfo });
        dispatch('update', { updates: { venue_info: venueInfo } });
    }

    // Debounce for Text Input (Specs Link)
    function handleLinkInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            await updateSSShow(show.id, { show_specs: specsLink });
            dispatch('update', { updates: { show_specs: specsLink } });
        }, 1000);
    }

    // --- UI Helpers ---

    function cycleStatus(current: string): string {
        return current === 'yes' ? 'no' : 'yes';
    }

    function getStatusColor(status: string) {
        // Colors: Confirmed (Green) / Problem (Red)
        if (status === 'yes') return '#86EFAC';
        return '#FCA5A5';
    }

    function getStatusText(status: string) {
        return status === 'yes' ? 'Yes' : 'No';
    }

    // --- File Handlers ---

    async function handleUpload(e: CustomEvent) {
        const { file } = e.detail;
        if (!file) return;

        isUploading = true;
        try {
            const fileName = `specs_${show.id}_${Date.now()}.pdf`;
            const { error } = await supabase.storage.from('documents').upload(`sultanshepard/${fileName}`, file);
            if (error) throw error;
            
            const { data } = supabase.storage.from('documents').getPublicUrl(`sultanshepard/${fileName}`);
            
            // Save file URL to DB
            await updateSSShow(show.id, { show_specs_file: data.publicUrl });
            dispatch('update', { updates: { show_specs_file: data.publicUrl } });
            
            showUploadModal = false;
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Failed to upload file.');
        } finally {
            isUploading = false;
        }
    }

    async function handleDelete() {
        if (!show.show_specs_file) return;
        isDeleting = true;
        try {
            // Clear URL in DB
            await updateSSShow(show.id, { show_specs_file: null });
            dispatch('update', { updates: { show_specs_file: null } });
            showPreviewModal = false;
        } catch (err) {
            console.error('Delete failed:', err);
        } finally {
            isDeleting = false;
        }
    }
</script>

<div class="bg-navbar rounded-2xl overflow-hidden flex flex-col h-full">
    <div class="px-5 py-4 border-b border-gray1 flex-shrink-0">
        <h3 class="text-lg font-bold text-white">Venue Specs</h3>
    </div>
    
    <div class="p-5 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
        
        <div class="space-y-3">
            <div class="text-[12px] text-gray3 font-bold uppercase">Stage Specs</div>
            
            <input 
                type="text" 
                class="w-full bg-gray1 rounded-2xl px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-lime placeholder-gray2 outline-none transition-all" 
                placeholder="Paste Link" 
                bind:value={specsLink} 
                on:input={handleLinkInput} 
            />

            <div>
                {#if show.show_specs_file}
                    <button 
                        class="w-full bg-transparent border border-lime text-lime hover:bg-lime hover:text-black font-bold text-xs py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                        on:click={() => showPreviewModal = true}
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        View Tech Specs
                    </button>
                {:else}
                    <button 
                        class="w-full bg-gray1 text-white font-bold text-xs py-2 rounded-xl hover:bg-lime hover:text-black transition-all cursor-pointer flex items-center justify-center gap-2"
                        on:click={() => showUploadModal = true}
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload PDF
                    </button>
                {/if}
            </div>
        </div>

        <hr class="border-gray1" />

        <div class="space-y-4">
            
            <div class="flex justify-between items-center">
                <span class="text-sm text-white font-medium">Pixel Map</span>
                <button
                    type="button"
                    class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                    style="background-color: {getStatusColor(pixelMap)}; color: #000000"
                    on:click={() => { pixelMap = cycleStatus(pixelMap); saveVenueInfo(); }}
                >
                    {getStatusText(pixelMap)}
                </button>
            </div>

            <div class="flex justify-between items-center">
                <span class="text-sm text-white font-medium">Camera Available</span>
                <button
                    type="button"
                    class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                    style="background-color: {getStatusColor(camera)}; color: #000000"
                    on:click={() => { camera = cycleStatus(camera); saveVenueInfo(); }}
                >
                    {getStatusText(camera)}
                </button>
            </div>

            {#if camera === 'yes'}
                <div class="flex justify-between items-center pl-3 border-l-4 border-lime animate-fade-in">
                    <span class="text-sm text-gray3">SDI Confirmed</span>
                    <button
                        type="button"
                        class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                        style="background-color: {getStatusColor(sdiConfirmed)}; color: #000000"
                        on:click={() => { sdiConfirmed = cycleStatus(sdiConfirmed); saveVenueInfo(); }}
                    >
                        {getStatusText(sdiConfirmed)}
                    </button>
                </div>
            {:else}
                <div class="flex justify-between items-center pl-3 border-l-4 border-lime animate-fade-in">
                    <span class="text-sm text-gray3">Bring our own Camera</span>
                    <button
                        type="button"
                        class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                        style="background-color: {getStatusColor(bringOwnCamera)}; color: #000000"
                        on:click={() => { bringOwnCamera = cycleStatus(bringOwnCamera); saveVenueInfo(); }}
                    >
                        {getStatusText(bringOwnCamera)}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</div>

{#if showUploadModal}
    <div use:portal>
        <UploadModal
            isOpen={showUploadModal}
            title="Upload Venue Specs"
            acceptedTypes=".pdf"
            allowRename={true}
            fileNameTemplate="Specs - {show.show_venue}"
            customFileName="Specs - {show.show_venue}"
            {isUploading}
            on:close={() => showUploadModal = false}
            on:upload={handleUpload}
        />
    </div>
{/if}

{#if showPreviewModal}
    <div use:portal>
        <PreviewModal
            isOpen={showPreviewModal}
            fileName="Specs - {show.show_venue}"
            fileUrl={show.show_specs_file || ''}
            {isDeleting}
            on:close={() => showPreviewModal = false}
            on:delete={handleDelete}
        />
    </div>
{/if}

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .animate-fade-in {
        animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>