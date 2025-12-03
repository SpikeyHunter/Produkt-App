<script lang="ts">
	import { onMount } from 'svelte';

	let logs: string[] = [];
	let urlParams: any = {};
	let targetUrl = '';
	
	// Configuration (Based on our findings)
	const SWITCH_DOMAIN = 'https://login.serviceswifi.com/cgi-bin/login';
	const AUTH_TEXT = 'connect'; // The secret word you set in Aruba Profile

	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString();
		logs = [...logs, `[${time}] ${msg}`];
	}

	onMount(() => {
		addLog('--- DIAGNOSTIC MODE STARTED ---');
		
		// 1. Dump all URL parameters to screen
		const params = new URLSearchParams(window.location.search);
		urlParams = Object.fromEntries(params.entries());
		
		addLog(`Full URL: ${window.location.href}`);
		addLog(`Detected Params: ${JSON.stringify(urlParams)}`);

		// 2. Determine Redirection
		const originalUrl = params.get('url') || params.get('original_url') || 'https://www.google.com';
		
		// 3. Construct the Handshake
		// We hardcode the Videotron domain because we know the IP fails the cert check
		targetUrl = `${SWITCH_DOMAIN}?cmd=authenticate&authtext=${AUTH_TEXT}&url=${encodeURIComponent(originalUrl)}`;
		
		addLog('--- READY ---');
		addLog(`Target Handshake: ${targetUrl}`);
	});

	function attemptConnection() {
		addLog('Attempting connection...');
		addLog(`Redirecting to: ${targetUrl}`);
		
		// Small delay so you can read the log before it vanishes
		setTimeout(() => {
			window.location.href = targetUrl;
		}, 1000);
	}
</script>

<svelte:head>
	<title>WiFi Diagnostic</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<main class="min-h-screen bg-black text-green-400 p-4 font-mono text-sm flex flex-col gap-4">
	
	<!-- Header -->
	<div class="border-b border-green-800 pb-2 mb-2">
		<h1 class="text-xl font-bold text-white">NETWORK DIAGNOSTIC</h1>
		<p class="opacity-70">NCG Wifi Debugger</p>
	</div>

	<!-- Status Board -->
	<div class="grid grid-cols-2 gap-2 text-xs">
		<div class="bg-gray-900 p-2 rounded border border-gray-700">
			<span class="text-gray-500 block">SSID</span>
			<span class="text-white text-lg">{urlParams.ssid || urlParams.essid || 'UNKNOWN'}</span>
		</div>
		<div class="bg-gray-900 p-2 rounded border border-gray-700">
			<span class="text-gray-500 block">MAC Address</span>
			<span class="text-white">{urlParams.mac || 'UNKNOWN'}</span>
		</div>
		<div class="bg-gray-900 p-2 rounded border border-gray-700 col-span-2">
			<span class="text-gray-500 block">Switch URL (From URL)</span>
			<span class="text-white">{urlParams.switch_url || 'Not Provided (Using Hardcoded)'}</span>
		</div>
	</div>

	<!-- Action Button -->
	<button 
		on:click={attemptConnection}
		class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded shadow-lg text-lg animate-pulse"
	>
		TEST CONNECTION
	</button>

	<!-- Console Output -->
	<div class="flex-1 bg-gray-900 rounded p-2 overflow-auto border border-gray-800" style="min-height: 300px;">
		<div class="text-gray-500 mb-2 border-b border-gray-800 pb-1">LIVE LOGS:</div>
		{#each logs as log}
			<div class="mb-1 font-mono break-all hover:bg-gray-800 p-1 rounded">{log}</div>
		{/each}
	</div>

</main>