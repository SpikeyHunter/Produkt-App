<script lang="ts">
	import { onMount } from 'svelte';
	
	interface FormData {
		firstName: string;
		lastName: string;
		email: string;
		phone: string;
	}
	
	let formData: FormData = {
		firstName: '',
		lastName: '',
		email: '',
		phone: ''
	};
	
	let isSubmitting = false;
	let submitMessage = '';
	let isSuccess = false;
	
	// Variables to hold Aruba parameters
	let redirectUrl = '';
	let ssid = '';
	let switchUrl = ''; // <--- NEW: The address of the Aruba Controller
	let clientMac = '';
	
	// Debug Logs
	let logs: string[] = [];
	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString();
		logs = [...logs, `[${time}] ${msg}`];
	}

	onMount(() => {
		addLog('App mounted. Reading Aruba params...');
		const urlParams = new URLSearchParams(window.location.search);
		
		// 1. Capture the destination (where the user wanted to go)
		redirectUrl = urlParams.get('url') || urlParams.get('original_url') || 'https://www.google.com';
		
		// 2. Capture the WiFi Name
		ssid = urlParams.get('ssid') || urlParams.get('essid') || '';
		
		// 3. Capture the Aruba Controller URL (The "Gatekeeper")
		// Aruba usually sends 'switch_url', but if it's missing, we default to the standard address.
		switchUrl = urlParams.get('switch_url') || 'https://securelogin.arubanetworks.com/cgi-bin/login';
		
		// 4. Capture Client MAC (useful for debugging)
		clientMac = urlParams.get('mac') || 'unknown';

		addLog(`SSID: ${ssid}`);
		addLog(`Gatekeeper (Switch URL): ${switchUrl}`);
		addLog(`Client MAC: ${clientMac}`);
	});

	async function handleSubmit() {
		if (!validateForm()) return;
		
		isSubmitting = true;
		submitMessage = '';
		addLog('Saving to database...');

		try {
			// 1. Save to Supabase
			const response = await fetch('/api/guests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...formData,
					timestamp: new Date().toISOString(),
					redirectUrl: redirectUrl,
					ssid: ssid 
				})
			});

			// 2. Handle Response
			const result = await response.json();
			
			if (response.ok || response.status === 409) {
				isSuccess = true;
				submitMessage = 'Registered! Authenticating with WiFi...';
				addLog('Database Success. Initiating Aruba Handshake...');
				
				// 3. THE FIX: Redirect to Aruba Controller to "Unlock" the internet
				// We pass the email as the user/password to satisfy the "InternalServer" requirement.
				const arubaHandshake = `${switchUrl}?cmd=authenticate&user=${formData.email}&password=${formData.email}&url=${encodeURIComponent(redirectUrl)}`;
				
				addLog(`Handshake URL: ${arubaHandshake}`);

				setTimeout(() => {
					window.location.href = arubaHandshake;
				}, 1000);
			} else {
				throw new Error(result.error || 'Registration failed');
			}
		} catch (error: any) {
			addLog(`ERROR: ${error.message}`);
			submitMessage = `Connection failed: ${error.message}`;
			isSuccess = false;
		} finally {
			isSubmitting = false;
		}
	}
	
	function validateForm(): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!formData.firstName.trim()) { submitMessage = 'First name is required'; return false; }
		if (!formData.lastName.trim()) { submitMessage = 'Last name is required'; return false; }
		if (!emailRegex.test(formData.email)) { submitMessage = 'Invalid email'; return false; }
		return true;
	}
	
	function formatPhoneInput(event: Event) {
		const input = event.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '');
		if (value.length >= 6) value = value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
		else if (value.length >= 3) value = value.replace(/(\d{3})(\d{0,3})/, '$1-$2');
		formData.phone = value;
	}
</script>

<svelte:head>
	<title>WiFi Access</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<main class="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans pb-20">
	<div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8 mb-8">
		<div class="text-center mb-8">
			<h1 class="text-2xl font-bold text-gray-900">WiFi Login</h1>
			{#if ssid}<p class="text-xs text-blue-600 mt-1 font-medium bg-blue-50 inline-block px-2 py-1 rounded">Network: {ssid}</p>{/if}
		</div>

		<form on:submit|preventDefault={handleSubmit} class="space-y-5">
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="firstName" class="block text-sm font-medium text-gray-700 mb-1">First Name</label>
					<input type="text" id="firstName" bind:value={formData.firstName} class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required placeholder="John">
				</div>
				<div>
					<label for="lastName" class="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
					<input type="text" id="lastName" bind:value={formData.lastName} class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required placeholder="Doe">
				</div>
			</div>
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
				<input type="email" id="email" bind:value={formData.email} class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required placeholder="john@example.com">
			</div>
			<div>
				<label for="phone" class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
				<input type="tel" id="phone" value={formData.phone} on:input={formatPhoneInput} class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" required placeholder="123-456-7890">
			</div>
			<button type="submit" disabled={isSubmitting} class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-70">
				{isSubmitting ? 'Authenticating...' : 'Connect to WiFi'}
			</button>
			{#if submitMessage}
				<div class="p-3 rounded-lg text-sm text-center {isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">{submitMessage}</div>
			{/if}
		</form>
	</div>

	<!-- DEBUG LOGS -->
	<div class="w-full max-w-md bg-black text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto h-48 shadow-xl border border-gray-800">
		<div class="font-bold border-b border-gray-700 mb-2 pb-1 text-white">DEBUG LOGS</div>
		{#each logs as log}<div class="mb-1 border-b border-gray-900 pb-1">{log}</div>{/each}
	</div>
</main>