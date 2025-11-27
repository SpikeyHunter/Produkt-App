<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    // Default State
    let vjInfo = show.vj_info || { needed: 'no', confirmed: 'no', name: 'Other' };
    // Updated videocheck structure to support start/end times
    let videocheck = show.videocheck || { needed: 'no', startTime: '', endTime: '', confirmed: 'no' };

    // Helpers
    function cycleStatus(current: string): string {
        return current === 'yes' ? 'no' : 'yes';
    }

    function getStatusColor(status: string) {
        if (status === 'yes') return '#86EFAC'; // Green
        return '#FCA5A5'; // Red
    }

    function getStatusText(status: string) {
        return status === 'yes' ? 'Yes' : 'No';
    }

    async function save() {
        const updates = { vj_info: vjInfo, videocheck: videocheck };
        await updateSSShow(show.id, updates);
        dispatch('update', { updates });
    }

    function toggleName() {
        const names = ['Other', 'Keegan', 'Marco'];
        const idx = names.indexOf(vjInfo.name || 'Other');
        vjInfo.name = names[(idx + 1) % names.length];
        save();
    }
</script>

<div class="bg-navbar rounded-2xl overflow-hidden h-[340px] flex flex-col">
    <div class="px-5 py-4 border-b border-gray1 flex-shrink-0">
        <h3 class="text-lg font-bold text-white">VJ Info</h3>
    </div>
    <div class="p-5 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        
        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-sm text-white font-medium">VJ Needed</span>
                <button
                    type="button"
                    class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                    style="background-color: {getStatusColor(vjInfo.needed)}; color: #000000"
                    on:click={() => { vjInfo.needed = cycleStatus(vjInfo.needed); save(); }}
                >
                    {getStatusText(vjInfo.needed)}
                </button>
            </div>

            {#if vjInfo.needed === 'yes'}
                <div class="space-y-3 pl-3 border-l-4 border-lime animate-fade-in">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray3">Confirmed</span>
                        <button
                            type="button"
                            class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                            style="background-color: {getStatusColor(vjInfo.confirmed)}; color: #000000"
                            on:click={() => { vjInfo.confirmed = cycleStatus(vjInfo.confirmed); save(); }}
                        >
                            {getStatusText(vjInfo.confirmed)}
                        </button>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray3">VJ Name</span>
                        <button 
                            class="text-xs bg-gray1 hover:bg-lime hover:text-black px-3 py-1.5 rounded-xl transition-colors font-bold cursor-pointer min-w-[70px]" 
                            on:click={toggleName}
                        >
                            {vjInfo.name}
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        <hr class="border-gray1" />

        <div class="space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-sm text-white font-medium">Video Check</span>
                <button
                    type="button"
                    class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                    style="background-color: {getStatusColor(videocheck.needed)}; color: #000000"
                    on:click={() => { videocheck.needed = cycleStatus(videocheck.needed); save(); }}
                >
                    {getStatusText(videocheck.needed)}
                </button>
            </div>

            {#if videocheck.needed === 'yes'}
                <div class="space-y-3 pl-3 border-l-4 border-lime animate-fade-in">
                    
                    
                        
                        <div class="flex items-center gap-2">
                            <span class="text-sm text-gray3">From</span>
                            <input 
                                type="time" 
                                class="bg-gray1 text-white text-xs rounded-2xl px-2.5 py-1 border-none focus:ring-1 focus:ring-lime cursor-pointer w-full text-center" 
                                bind:value={videocheck.startTime} 
                                on:change={save} 
                            />
                            <span class="text-gray3 text-sm">to</span>
                            <input 
                                type="time" 
                                class="bg-gray1 text-white text-xs rounded-2xl px-2.5 py-1 border-none focus:ring-1 focus:ring-lime cursor-pointer w-full text-center" 
                                bind:value={videocheck.endTime} 
                                on:change={save} 
                            />
                        </div>
                    

                    <div class="flex justify-between items-center pt-1">
                        <span class="text-sm text-gray3">Confirmed</span>
                        <button
                            type="button"
                            class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center gap-2 font-bold min-w-[50px]"
                            style="background-color: {getStatusColor(videocheck.confirmed)}; color: #000000"
                            on:click={() => { videocheck.confirmed = cycleStatus(videocheck.confirmed); save(); }}
                        >
                            {getStatusText(videocheck.confirmed)}
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

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