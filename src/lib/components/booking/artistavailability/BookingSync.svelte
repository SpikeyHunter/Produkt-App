<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	const dispatch = createEventDispatcher();
    
	function getStageLabel(s: string) { return {fetching:'FETCHING',scraping:'SCRAPING',complete:'COMPLETE'}[s]||'SYNCING'; }

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

	// --- IGLOOFEST LOGIC ---
	let isSyncingIgloo = false;
	let canCancelIgloo = false;
	let syncMessageIgloo = '';
	let progressIgloo = 0;
	let stageIgloo = '';
	let currentStepIgloo = '';

	// Generic Sync Handler to reduce code duplication
	async function handleSyncGeneric(
		apiPath: string, 
		setSyncing: (v: boolean) => void, 
		setCancel: (v: boolean) => void, 
		setMessage: (v: string) => void, 
		setProgress: (v: number) => void, 
		setStage: (v: string) => void, 
		setStep: (v: string) => void
	) {
		setSyncing(true);
		setCancel(true);
		setMessage('');
		setProgress(0);
		
		try {
			const response = await fetch(apiPath, { method: 'POST' });
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
								setStage(data.stage);
								setProgress(Math.round(data.current));
								setStep(data.message);
							} else if (data.type === 'complete') {
								setMessage(data.message);
								dispatch('syncComplete', data.data);
								setSyncing(false);
								setCancel(false);
							} else if (data.type === 'cancelled') {
								setMessage(data.message);
								setSyncing(false);
								setCancel(false);
							} else if (data.type === 'error') {
								setMessage(`Error: ${data.message}`);
								setSyncing(false);
								setCancel(false);
							}
						} catch (e) { console.error('Parse error', e); }
					}
				}
			}
		} catch (error) {
			setMessage(`Error: ${error instanceof Error ? error.message : 'Network error'}`);
			setSyncing(false);
			setCancel(false);
		} finally {
			// Auto clear success message after 7s
			setTimeout(() => {
				// We check logic inside here to ensure we don't clear if a new sync started
			}, 7000);
		}
	}

	// Wrapper functions
	const handleSyncPiknic = () => handleSyncGeneric('/api/booking/piknic', (v) => isSyncingPiknic=v, (v) => canCancelPiknic=v, (v) => syncMessagePiknic=v, (v) => progressPiknic=v, (v) => stagePiknic=v, (v) => currentStepPiknic=v);
	const handleSyncEvenko = () => handleSyncGeneric('/api/booking/evenko', (v) => isSyncingEvenko=v, (v) => canCancelEvenko=v, (v) => syncMessageEvenko=v, (v) => progressEvenko=v, (v) => stageEvenko=v, (v) => currentStepEvenko=v);
	const handleSyncIgloo = () => handleSyncGeneric('/api/booking/igloofest', (v) => isSyncingIgloo=v, (v) => canCancelIgloo=v, (v) => syncMessageIgloo=v, (v) => progressIgloo=v, (v) => stageIgloo=v, (v) => currentStepIgloo=v);

	// Cancellation (Simplified)
	const handleCancelPiknic = async () => { await fetch('/api/booking/piknic/cancel', { method: 'POST' }); syncMessagePiknic = 'Cancelling...'; };
	const handleCancelEvenko = async () => { await fetch('/api/booking/evenko/cancel', { method: 'POST' }); syncMessageEvenko = 'Cancelling...'; };
	const handleCancelIgloo = async () => { await fetch('/api/booking/igloofest/cancel', { method: 'POST' }); syncMessageIgloo = 'Cancelling...'; };

	// Export for auto-sync access if needed
	export function triggerAutoSync() {
		// Chain them lightly
		if(!isSyncingPiknic) handleSyncPiknic();
		setTimeout(() => { if(!isSyncingIgloo) handleSyncIgloo(); }, 5000); 
	}
</script>

<div class="w-full space-y-6">
    <div class="w-full space-y-3">
        <div class="flex items-center gap-2">
            <button on:click={handleSyncIgloo} disabled={isSyncingIgloo} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm text-black bg-gray3 hover:bg-yellow-400 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed group">
                <span class="text-xl group-hover:scale-110 transition-transform">❄️</span>
                <span>{#if isSyncingIgloo}Syncing Igloofest... {progressIgloo}%{:else}Sync Igloofest (All Locations){/if}</span>
            </button>
             {#if canCancelIgloo}
                <button on:click={handleCancelIgloo} class="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm text-white bg-problem hover:bg-red-600 rounded-2xl transition-all">Cancel</button>
            {/if}
        </div>
        {#if isSyncingIgloo && progressIgloo > 0}
            <div class="space-y-2">
                <div class="w-full h-2 bg-gray3 rounded-full overflow-hidden">
                    <div class="h-full bg-yellow-400 transition-all" style="width: {progressIgloo}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs">
                     <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-yellow-400 text-black font-bold rounded-md uppercase">{getStageLabel(stageIgloo)}</span>
                        <span class="text-gray2">{currentStepIgloo}</span>
                    </div>
                    <span class="text-gray1 font-bold">{progressIgloo}%</span>
                </div>
            </div>
        {/if}
        {#if syncMessageIgloo}
            <div class="px-4 py-3 rounded-xl text-sm {syncMessageIgloo.includes('Error') ? 'bg-problem/10 text-red-700 border border-problem' : 'bg-confirmed/10 text-green-700 border border-confirmed'}">
                {syncMessageIgloo}
            </div>
        {/if}
    </div>

    <div class="w-full space-y-3">
        <div class="flex items-center gap-2">
            <button on:click={handleSyncPiknic} disabled={isSyncingPiknic} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm text-black bg-gray3 hover:bg-lime rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class:animate-spin={isSyncingPiknic} class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                <span>{#if isSyncingPiknic}Syncing Piknic... {progressPiknic}%{:else}Sync Piknic Electronik{/if}</span>
            </button>
            {#if canCancelPiknic}
                <button on:click={handleCancelPiknic} class="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm text-white bg-problem hover:bg-red-600 rounded-2xl transition-all">Cancel</button>
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
            <div class="px-4 py-3 rounded-xl text-sm {syncMessagePiknic.includes('Error') ? 'bg-problem/10 text-red-700 border border-problem' : 'bg-confirmed/10 text-green-700 border border-confirmed'}">
                {syncMessagePiknic}
            </div>
        {/if}
    </div>

    <div class="w-full space-y-3">
        <div class="flex items-center gap-2">
            <button on:click={handleSyncEvenko} disabled={isSyncingEvenko} class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-sm text-black bg-gray3 hover:bg-blue-300 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <svg class:animate-spin={isSyncingEvenko} class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                <span>{#if isSyncingEvenko}Syncing Evenko... {progressEvenko}%{:else}Sync Evenko{/if}</span>
            </button>
            {#if canCancelEvenko}
                <button on:click={handleCancelEvenko} class="flex items-center gap-1.5 px-4 py-2.5 font-semibold text-sm text-white bg-problem hover:bg-red-600 rounded-2xl transition-all">Cancel</button>
            {/if}
        </div>
        {#if isSyncingEvenko && progressEvenko > 0}
            <div class="space-y-2">
                <div class="w-full h-2 bg-gray3 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-300 transition-all" style="width: {progressEvenko}%"></div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-1 bg-blue-300 text-black font-bold rounded-md uppercase">{getStageLabel(stageEvenko)}</span>
                        <span class="text-gray2">{currentStepEvenko}</span>
                    </div>
                    <span class="text-gray1 font-bold">{progressEvenko}%</span>
                </div>
            </div>
        {/if}
        {#if syncMessageEvenko}
             <div class="px-4 py-3 rounded-xl text-sm {syncMessageEvenko.includes('Error') ? 'bg-problem/10 text-red-700 border border-problem' : 'bg-confirmed/10 text-green-700 border border-confirmed'}">
                {syncMessageEvenko}
            </div>
        {/if}
    </div>
</div>