<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { updateSSShow, type SSShow } from '$lib/services/ssShowService';

    export let show: SSShow;
    const dispatch = createEventDispatcher();

    let tracklist = show.tracklist || { revised: 'no', sent: 'no', text: '', autoFormat: false };

    async function save() {
        if (tracklist.autoFormat) {
            formatText();
        }
        await updateSSShow(show.id, { tracklist });
        dispatch('update', { updates: { tracklist } });
    }

    function formatText() {
        if (!tracklist.text) return;
        const lines = tracklist.text.split('\n');
        const formatted = lines.map((line: string) => {
            let clean = line.trim();
            if (!clean) return '';
            return clean.toLowerCase().replace(/(?:^|\s)\S/g, function(a) { return a.toUpperCase(); });
        }).join('\n');
        tracklist.text = formatted;
    }

    function toggleStatus(field: 'revised' | 'sent') {
        const options = ['no', 'inprogress', 'yes'];
        const currentIdx = options.indexOf(tracklist[field] || 'no');
        tracklist[field] = options[(currentIdx + 1) % options.length];
        save();
    }

    function getColor(status: string) {
        if (status === 'yes') return 'bg-[#86EFAC] text-black'; 
        if (status === 'inprogress') return 'bg-[#FDBA74] text-black';
        return 'bg-gray1 text-gray2 border border-gray2';
    }

    function getLabel(status: string) {
        if (status === 'yes') return 'Yes';
        if (status === 'inprogress') return 'In Progress';
        return 'No';
    }
</script>

<div class="bg-navbar rounded-2xl overflow-hidden h-full flex flex-col">
    <div class="px-5 py-4 border-b border-gray1 flex justify-between items-center flex-shrink-0">
        <h3 class="text-lg font-bold text-white">Tracks</h3>
        <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray2 uppercase font-bold">Auto-Format</span>
            <button 
                class="w-8 h-4 rounded-full transition-colors relative {tracklist.autoFormat ? 'bg-lime' : 'bg-gray1'}"
                on:click={() => { tracklist.autoFormat = !tracklist.autoFormat; save(); }}
                aria-label="Toggle auto-format"
            >
                <div class="w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all {tracklist.autoFormat ? 'left-4.5' : 'left-0.5'}"></div>
            </button>
        </div>
    </div>
    <div class="p-5 space-y-4 flex-1 flex flex-col min-h-0">
        <div class="flex justify-between items-center">
            <span class="text-sm text-white">Revised</span>
            <button class="px-3 py-1 rounded-lg text-xs font-bold transition-colors {getColor(tracklist.revised)}" on:click={() => toggleStatus('revised')}>
                {getLabel(tracklist.revised)}
            </button>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-sm text-white">Sent to VJ</span>
            <button class="px-3 py-1 rounded-lg text-xs font-bold transition-colors {getColor(tracklist.sent)}" on:click={() => toggleStatus('sent')}>
                {getLabel(tracklist.sent)}
            </button>
        </div>
        
        <label for="tracklist-area-{show.id}" class="text-xs text-gray2 font-bold mt-2 uppercase">Tracklist</label>
        <textarea 
            id="tracklist-area-{show.id}"
            class="flex-1 w-full bg-gray1 rounded-xl p-3 text-sm text-white focus:ring-1 focus:ring-lime resize-none border-none custom-scrollbar"
            placeholder="Paste track list..."
            bind:value={tracklist.text}
            on:blur={save}
        ></textarea>
    </div>
</div>

<style>
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }
</style>