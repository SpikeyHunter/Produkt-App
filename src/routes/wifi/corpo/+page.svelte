<script lang="ts">
	import { onMount } from 'svelte';

	let logs: string[] = [];
	let urlParams: any = {};
	let targetUrl = '';
	
	const CONTROLLER_URL = 'https://login.serviceswifi.com/cgi-bin/login';

	// --- CONFIGURATION FOR CORPO ---
	// 1. Create a NEW user in Aruba called 'staff' with password 'secure'
	// This allows you to differentiate logs in the controller.
	const RADIUS_USER = 'corpo';
	const RADIUS_PASS = 'guest'; 

	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString();
		logs = [...logs, `[${time}] ${msg}`];
	}

	onMount(() => {
		addLog('--- CORPO SYSTEM STARTED ---');
		const params = new URLSearchParams(window.location.search);
		urlParams = Object.fromEntries(params.entries());
		
		addLog(`SSID: ${urlParams.ssid || 'Unknown'}`);
		addLog(`MAC: ${urlParams.mac || 'Unknown'}`);

		const originalUrl = params.get('url') || 'https://www.google.com';
		
		targetUrl = `${CONTROLLER_URL}?cmd=authenticate&user=${RADIUS_USER}&password=${RADIUS_PASS}&url=${encodeURIComponent(originalUrl)}`;
		
		addLog('Ready for Corporate Access');
	});

	function connectInternet() {
		addLog('Authenticating Staff...');
		setTimeout(() => {
			window.location.href = targetUrl;
		}, 1000);
	}
</script>

<svelte:head>
	<title>Corporate Access</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<main class="min-h-screen bg-slate-900 text-gray-100 p-6 font-mono flex flex-col items-center">
	
	<div class="w-full max-w-md space-y-6">
		<div class="text-center border-b border-slate-700 pb-4">
			<h1 class="text-2xl font-bold text-emerald-400 tracking-wider">NCG CORPORATE</h1>
			<p class="text-sm text-gray-400 mt-1">Staff & Authorized Access</p>
		</div>

		<button 
			on:click={connectInternet}
			class="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-6 rounded-xl shadow-lg transform transition active:scale-95 text-xl"
		>
			CONNECT TO CORP
		</button>

		<div class="bg-black rounded-lg border border-slate-700 p-4 shadow-inner mt-8">
			<div class="h-40 overflow-y-auto space-y-2 text-xs font-mono text-gray-300">
				{#each logs as log}
					<div class="border-l-2 border-emerald-500 pl-2">{log}</div>
				{/each}
			</div>
		</div>
	</div>

</main>