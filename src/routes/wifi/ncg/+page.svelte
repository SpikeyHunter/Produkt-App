<script lang="ts">
	import { onMount } from 'svelte';

	let logs: string[] = [];
	let urlParams: any = {};
	let targetUrl = '';
	
	// --- CONFIGURATION ---
	// 1. Target the Videotron/Aruba Controller
	const CONTROLLER_URL = 'https://login.serviceswifi.com/cgi-bin/login';

	// 2. RADIUS CREDENTIALS
	// Since you want a "One-Click" experience with RADIUS, you must hardcode 
	// a generic user here, and create this EXACT user in your RADIUS/Local DB.
	const RADIUS_USER = 'guest';
	const RADIUS_PASS = 'connect'; 

	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString();
		logs = [...logs, `[${time}] ${msg}`];
	}

	onMount(() => {
		addLog('--- SYSTEM STARTED ---');
		
		// 1. Read URL Parameters from Aruba
		const params = new URLSearchParams(window.location.search);
		urlParams = Object.fromEntries(params.entries());
		
		addLog(`Detected SSID: ${urlParams.ssid || urlParams.essid || 'Unknown'}`);
		addLog(`Client MAC: ${urlParams.mac || 'Unknown'}`);

		// 2. Determine where the user initially wanted to go
		// Default to Google if no specific URL was requested
		const originalUrl = params.get('url') || params.get('original_url') || 'https://www.google.com';
		
		// 3. Build the "Unlock" URL for RADIUS
		// STRUCTURE: cmd=authenticate & user=... & password=... & url=...
		targetUrl = `${CONTROLLER_URL}?cmd=authenticate&user=${RADIUS_USER}&password=${RADIUS_PASS}&url=${encodeURIComponent(originalUrl)}`;
		
		addLog('--- READY TO CONNECT ---');
		addLog(`Target: ${CONTROLLER_URL}`);
		addLog(`Auth Mode: RADIUS (User: ${RADIUS_USER})`);
	});

	function connectInternet() {
		addLog('Initiating handshake...');
		addLog(`Redirecting to: ${targetUrl}`);
		
		// Small delay so you can read the log before the browser jumps
		setTimeout(() => {
			window.location.href = targetUrl;
		}, 1000);
	}
</script>

<svelte:head>
	<title>WiFi Access</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<main class="min-h-screen bg-gray-900 text-gray-100 p-6 font-mono flex flex-col items-center">
	
	<div class="w-full max-w-md space-y-6">
		<div class="text-center border-b border-gray-700 pb-4">
			<h1 class="text-2xl font-bold text-white tracking-wider">NCG WIFI</h1>
			<p class="text-sm text-gray-400 mt-1">One-Click Access</p>
		</div>

		<button 
			on:click={connectInternet}
			class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-6 rounded-xl shadow-lg transform transition active:scale-95 text-xl flex flex-col items-center justify-center gap-1"
		>
			<span>CONNECT NOW</span>
			<span class="text-xs font-normal opacity-70">No registration required</span>
		</button>

		<div class="bg-black rounded-lg border border-gray-700 p-4 shadow-inner mt-8">
			<div class="flex justify-between items-center mb-2 border-b border-gray-800 pb-2">
				<span class="text-xs font-bold text-gray-500">SYSTEM LOGS</span>
				<span class="text-[10px] text-gray-600">Live</span>
			</div>
			
			<div class="h-64 overflow-y-auto space-y-2 text-xs font-mono">
				{#each logs as log}
					<div class="break-all border-l-2 border-blue-900 pl-2 py-1 hover:bg-gray-900">
						{log}
					</div>
				{/each}
				{#if logs.length === 0}
					<div class="text-gray-600 italic">Waiting for activity...</div>
				{/if}
			</div>
		</div>

		<div class="text-[10px] text-gray-600 text-center">
			Targeting: login.serviceswifi.com | Auth: RADIUS
		</div>
	</div>

</main>