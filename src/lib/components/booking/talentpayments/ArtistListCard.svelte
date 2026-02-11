<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    export let artist: any;
    export let selected = false;

    const dispatch = createEventDispatcher();
    
    function getStatusColor(status: string) {
        if (!status) return 'text-gray2 bg-gray1';
        switch(status.toLowerCase()) {
            case 'paid': return 'text-black bg-lime';
            case 'approved': return 'text-black bg-cyan-400';
            case 'submitted': return 'text-black bg-yellow-400';
            case 'invoiced': return 'text-white bg-purple-600';
            default: return 'text-gray2 bg-gray1 border border-gray2/30';
        }
    }
</script>

<button 
    class="w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between group
    {selected ? 'bg-transparent border-lime shadow-[0_0_0_1px_rgba(132,204,22,1)]' : 'bg-gray1/20 border-gray1 hover:border-gray2 hover:bg-gray1/40'}"
    on:click={() => dispatch('click', artist)}
>
    <div class="flex flex-col gap-1">
        <h3 class="font-bold text-white text-base group-hover:text-lime transition-colors">
            {artist.artist_name}
        </h3>
        <div class="flex">
             <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold {getStatusColor(artist.paymentData?.status || 'Draft')}">
                {artist.paymentData?.status || 'Draft'}
            </span>
        </div>
    </div>

    <div class="text-right">
        <div class="text-lg font-bold text-lime">
            ${artist.paymentData?.amount ?? 150}
        </div>
    </div>
</button>