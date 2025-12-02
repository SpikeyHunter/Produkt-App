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
	
	// Debug Logs
	let logs: string[] = [];
	function addLog(msg: string) {
		const time = new Date().toLocaleTimeString();
		const logEntry = `[${time}] ${msg}`;
		console.log(logEntry);
		logs = [...logs, logEntry]; // Update UI
	}

	onMount(() => {
		addLog('App mounted. Checking URL params...');
		const urlParams = new URLSearchParams(window.location.search);
		
		redirectUrl = urlParams.get('url') || urlParams.get('original_url') || 'https://www.google.com';
		ssid = urlParams.get('ssid') || urlParams.get('essid') || '';
		
		addLog(`Detected SSID: ${ssid || 'None'}`);
		addLog(`Redirect Target: ${redirectUrl}`);
	});

	async function handleSubmit() {
		if (!validateForm()) return;
		
		isSubmitting = true;
		submitMessage = '';
		addLog('Submitting form...');

		try {
			const payload = {
				...formData,
				timestamp: new Date().toISOString(),
				redirectUrl: redirectUrl,
				ssid: ssid 
			};
			
			addLog(`Sending Payload: ${JSON.stringify(payload)}`);

			// Send data to our backend
			const response = await fetch('/api/guests', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(payload)
			});

			addLog(`Response Status: ${response.status}`);
			
			const result = await response.json();
			addLog(`Response Body: ${JSON.stringify(result)}`);

			// We handle 409 (Duplicate) as a success
			if (response.ok || response.status === 409) {
				isSuccess = true;
				submitMessage = 'Connected! Redirecting...';
				addLog('Success! Starting redirect timer...');
				
				// Redirect logic
				setTimeout(() => {
					addLog(`Redirecting to: ${redirectUrl}`);
					window.location.href = redirectUrl;
				}, 1500);
			} else {
				throw new Error(result.error || 'Registration failed');
			}
		} catch (error: any) {
			addLog(`CRITICAL ERROR: ${error.message}`);
			console.error(error);
			submitMessage = `Connection failed: ${error.message}`;
			isSuccess = false;
		} finally {
			isSubmitting = false;
		}
	}
	
	function validateForm(): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;

		if (!formData.firstName.trim()) {
			submitMessage = 'First name is required';
			return false;
		}
		if (!formData.lastName.trim()) {
			submitMessage = 'Last name is required';
			return false;
		}
		if (!emailRegex.test(formData.email)) {
			submitMessage = 'Please enter a valid email address';
			return false;
		}
		if (!phoneRegex.test(formData.phone)) {
			submitMessage = 'Please enter a valid phone number';
			return false;
		}
		return true;
	}
	
	function formatPhoneInput(event: Event) {
		const input = event.target as HTMLInputElement;
		let value = input.value.replace(/\D/g, '');
		if (value.length >= 6) {
			value = value.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
		} else if (value.length >= 3) {
			value = value.replace(/(\d{3})(\d{0,3})/, '$1-$2');
		}
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
			<p class="text-gray-500 mt-2">Enter your details to connect</p>
			{#if ssid}
				<p class="text-xs text-blue-600 mt-1 font-medium bg-blue-50 inline-block px-2 py-1 rounded">Network: {ssid}</p>
			{/if}
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

			<button type="submit" disabled={isSubmitting} class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-70 disabled:cursor-not-allowed">
				{isSubmitting ? 'Connecting...' : 'Connect to WiFi'}
			</button>

			{#if submitMessage}
				<div class="p-3 rounded-lg text-sm text-center {isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
					{submitMessage}
				</div>
			{/if}
		</form>
	</div>

	<!-- DEBUG LOGS SECTION -->
	<div class="w-full max-w-md bg-black text-green-400 p-4 rounded-lg text-xs font-mono overflow-auto h-48 shadow-xl border border-gray-800">
		<div class="font-bold border-b border-gray-700 mb-2 pb-1 text-white">DEBUG LOGS (Copy this if it fails)</div>
		{#each logs as log}
			<div class="mb-1 border-b border-gray-900 pb-1">{log}</div>
		{/each}
		{#if logs.length === 0}
			<div class="text-gray-500 italic">Waiting for activity...</div>
		{/if}
	</div>
</main>