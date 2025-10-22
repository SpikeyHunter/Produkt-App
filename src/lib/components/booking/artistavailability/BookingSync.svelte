<!-- /src/lib/components/booking/artistavailability/BookingSync.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	const dispatch = createEventDispatcher();

	// --- PIKNIC LOGIC ---
	let isSyncingPiknic = false;
	let canCancelPiknic = false;
	let syncMessagePiknic = '';
	let progressPiknic = 0;
	let stagePiknic = '';
	let currentStepPiknic = '';
	
	// --- EVENKO LOGIC ---
	let isSyncingEvenko = false;
	let canCancelEvenko = false;
	let syncMessageEvenko = '';
	let progressEvenko = 0;
	let stageEvenko = '';
	let currentStepEvenko = '';

	// --- Utility Functions ---
	function getStageLabel(s: string) { return {fetching:'FETCHING',scraping:'SCRAPING',complete:'COMPLETE'}[s]||'SYNCING'; }

	async function handleSyncPiknic() {
		if (isSyncingPiknic) return;
		isSyncingPiknic = true;
		canCancelPiknic = true;
		syncMessagePiknic = '';
		progressPiknic = 0;
		try {
			const response = await fetch('/api/booking/piknic', { method: 'POST' });
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			if (!reader) return;

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));
							if (data.type === 'progress') {
								stagePiknic = data.stage;
								progressPiknic = Math.round(data.current);
								currentStepPiknic = data.message;
							} else if (data.type === 'complete' || data.type === 'cancelled') {
								syncMessagePiknic = data.message;
								if (data.type === 'complete') dispatch('syncComplete', data.data);
								isSyncingPiknic = false;
								canCancelPiknic = false;
							} else if (data.type === 'error') {
								syncMessagePiknic = `Error: ${data.message}`;
								isSyncingPiknic = false;
								canCancelPiknic = false;
							}
						} catch (e) {}
					}
				}
			}
		} catch (error) {
			syncMessagePiknic = `Error: ${error instanceof Error ? error.message : 'Network error'}`;
		} finally {
			isSyncingPiknic = false;
			canCancelPiknic = false;
			setTimeout(() => {
				if (!isSyncingPiknic) { syncMessagePiknic = ''; progressPiknic = 0; stagePiknic = ''; currentStepPiknic = ''; }
			}, 7000);
		}
	}

	async function handleCancelPiknic() {
		if (!canCancelPiknic) return;
		await fetch('/api/booking/piknic/cancel', { method: 'POST' });
		syncMessagePiknic = 'Cancellation requested...';
		canCancelPiknic = false;
		isSyncingPiknic = false;
	}

	async function handleSyncEvenko() {
		if (isSyncingEvenko) return;
		isSyncingEvenko = true;
		canCancelEvenko = true;
		syncMessageEvenko = '';
		progressEvenko = 0;
		try {
			const response = await fetch('/api/booking/evenko', { method: 'POST' });
			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			if (!reader) return;
			
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				for (const line of lines) {
					if (line.startsWith('data: ')) {
						try {
							const data = JSON.parse(line.slice(6));
							if (data.type === 'progress') {
								stageEvenko = data.stage;
								progressEvenko = Math.round(data.current);
								currentStepEvenko = data.message;
							} else if (data.type === 'complete' || data.type === 'cancelled') {
								syncMessageEvenko = data.message;
								if (data.type === 'complete') dispatch('syncComplete', data.data);
								isSyncingEvenko = false;
								canCancelEvenko = false;
							} else if (data.type === 'error') {
								syncMessageEvenko = `Error: ${data.message}`;
								isSyncingEvenko = false;
								canCancelEvenko = false;
							}
						} catch (e) {}
					}
				}
			}
		} catch (error) {
			syncMessageEvenko = `Error: ${error instanceof Error ? error.message : 'Network error'}`;
		} finally {
			isSyncingEvenko = false;
			canCancelEvenko = false;
			setTimeout(() => {
				if (!isSyncingEvenko) { syncMessageEvenko = ''; progressEvenko = 0; stageEvenko = ''; currentStepEvenko = ''; }
			}, 7000);
		}
	}

	async function handleCancelEvenko() {
		if (!canCancelEvenko) return;
		await fetch('/api/booking/evenko/cancel', { method: 'POST' });
		syncMessageEvenko = 'Cancellation requested...';
		canCancelEvenko = false;
		isSyncingEvenko = false;
	}
</script>

<div class="w-full space-y-6">
    <!-- === PIKNIC SYNC CONTROLS === -->
    <div class="w-full space-y-3">
        <div class="flex items-center gap-2">
            <button on:click={handleSyncPiknic} disabled={isSyncingPiknic} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm text-black bg-gray3 hover:bg-lime rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class:animate-spin={isSyncingPiknic} class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                <span>{#if isSyncingPiknic}Syncing Piknic... {progressPiknic}%{:else}Sync Piknic Electronik{/if}</span>
            </button>
            {#if canCancelPiknic}
                <button on:click={handleCancelPiknic} class="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm text-white bg-problem hover:bg-red-600 rounded-2xl transition-all">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Cancel
                </button>
            {/if}
        </div>
        {#if isSyncingPiknic && progressPiknic > 0}
            <div class="space-y-2">
                <div class="w-full h-2 bg-gray3 rounded-full overflow-hidden">
                    <div class="h-full bg-lime transition-all" style="width: {progressPiknic}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-lime text-black font-bold rounded-md uppercase">{getStageLabel(stagePiknic)}</span>
                        <span class="text-gray2">{currentStepPiknic}</span>
                    </div>
                    <span class="text-gray1 font-bold">{progressPiknic}%</span>
                </div>
            </div>
        {/if}
        {#if syncMessagePiknic}
            <div class="px-4 py-3 rounded-xl text-sm {syncMessagePiknic.includes('Error') || syncMessagePiknic.includes('cancel') ? 'bg-problem/10 text-red-700 border border-problem' : 'bg-confirmed/10 text-green-700 border border-confirmed'}">
                {syncMessagePiknic}
            </div>
        {/if}
    </div>

    <!-- === EVENKO SYNC CONTROLS === -->
    <div class="w-full space-y-3">
        <div class="flex items-center gap-2">
            <button on:click={handleSyncEvenko} disabled={isSyncingEvenko} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm text-black bg-gray3 hover:bg-lime rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class:animate-spin={isSyncingEvenko} class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                <span>{#if isSyncingEvenko}Syncing Evenko... {progressEvenko}%{:else}Sync Evenko{/if}</span>
            </button>
            {#if canCancelEvenko}
                <button on:click={handleCancelEvenko} class="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm text-white bg-problem hover:bg-red-600 rounded-2xl transition-all">
                    <svg class="w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    Cancel
                </button>
            {/if}
        </div>
        {#if isSyncingEvenko && progressEvenko > 0}
            <div class="space-y-2">
                <div class="w-full h-2 bg-gray3 rounded-full overflow-hidden">
                    <div class="h-full bg-lime transition-all" style="width: {progressEvenko}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-lime text-black font-bold rounded-md uppercase">{getStageLabel(stageEvenko)}</span>
                        <span class="text-gray2">{currentStepEvenko}</span>
                    </div>
                    <span class="text-gray1 font-bold">{progressEvenko}%</span>
                </div>
            </div>
        {/if}
        {#if syncMessageEvenko}
            <div class="px-4 py-3 rounded-xl text-sm {syncMessageEvenko.includes('Error') || syncMessageEvenko.includes('cancel') ? 'bg-problem/10 text-red-700 border border-problem' : 'bg-confirmed/10 text-green-700 border border-confirmed'}">
                {syncMessageEvenko}
            </div>
        {/if}
    </div>
</div>

