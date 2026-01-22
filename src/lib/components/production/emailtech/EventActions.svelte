<script lang="ts">
    import { createEventDispatcher, onDestroy } from 'svelte';

    export let templateType: 'tech' | 'vj';
    export let currentStatus: string = 'todo';
    
    const dispatch = createEventDispatcher();

    // Reset Button Logic
    let resetStep = 0; // 0: Normal, 1: Are you sure?, 2: Click to reset
    let resetTimeout: any;

    // Defined Colors
    const COLORS = {
        problem: '#FCA5A5',   // Red/Pink
        proposed: '#FDBA74',  // Orange
        confirmed: '#86EFAC', // Green
        question: '#c4b5fd'   // Purple
    };

    const statuses = [
        { id: 'todo', label: 'To Do', color: COLORS.problem },
        { id: 'in_progress', label: 'In Progress', color: COLORS.proposed },
        { id: 'done', label: 'Done', color: COLORS.confirmed },
        { id: 'to_send', label: 'To Send', color: COLORS.question }
    ];

    function handleResetClick() {
        clearTimeout(resetTimeout);

        if (resetStep === 0) {
            resetStep = 1;
        } else if (resetStep === 1) {
            resetStep = 2;
        } else if (resetStep === 2) {
            dispatch('reset');
            resetStep = 0;
            return;
        }

        resetTimeout = setTimeout(() => {
            resetStep = 0;
        }, 5000);
    }

    onDestroy(() => {
        clearTimeout(resetTimeout);
    });

    function getStatusStyle(statusId: string, isActive: boolean, color: string): string {
        if (!isActive) {
            // Inactive: Thicker border (2px), gray2 text/border, transparent bg
            return `border-width: 2px; border-color: #333333; color: #333333; background-color: transparent;`; 
        }
        // Active: Filled with specific color, matching border
        return `background-color: ${color}; color: black; border-color: ${color}; border-width: 1px;`;
    }
</script>

<div class="flex flex-col gap-4">
    
    <div class="grid grid-cols-2 gap-3">
        <button 
            type="button"
            on:click={() => dispatch('autofill')}
            class="px-4 py-2 rounded-lg text-xs font-bold border border-lime text-lime hover:bg-lime hover:text-black transition-all cursor-pointer"
        >
            Autofill
        </button>

        <button 
            type="button"
            on:click={handleResetClick}
            class="px-4 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer text-center truncate text-black"
            style={
                resetStep === 0 
                    ? `border-color: ${COLORS.problem}; color: ${COLORS.problem}; background-color: rgba(252, 165, 165, 0.1);` // Problem Color
                : resetStep === 1 
                    ? `background-color: #F87171; border-color: #F87171; color: black;` // In-Between (Red-400)
                : `background-color: #DC2626; border-color: #DC2626; color: white;` // Red (Red-600)
            }
        >
            {#if resetStep === 0}
                Reset
            {:else if resetStep === 1}
                Are you sure?
            {:else}
                Click to reset
            {/if}
        </button>
    </div>

    <div class="bg-navbar border border-gray1 rounded-xl p-3">
        <h3 class="text-xs font-bold text-gray3 mb-2 uppercase tracking-wider">{templateType === 'tech' ? 'Tech' : 'VJ'} Email - Status</h3>
        <div class="grid grid-cols-2 gap-2">
            {#each statuses as status}
                {@const isActive = currentStatus === status.id}
                <button
                    type="button"
                    on:click={() => dispatch('updateStatus', status.id)}
                    class="py-2.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer hover:opacity-90 
                           {isActive ? '' : 'border-gray2 text-gray2 hover:border-gray3 hover:text-white'}"
                    style={getStatusStyle(status.id, isActive, status.color)}
                >
                    {status.label}
                </button>
            {/each}
        </div>
    </div>

</div>