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
	let ssid = ''; // To store the WiFi name (e.g., NCG Wifi)
	
	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		
		// Aruba usually sends the original URL as 'url' or 'original_url'
		redirectUrl = urlParams.get('url') || urlParams.get('original_url') || 'https://www.google.com';
		
		// Aruba sends the WiFi name as 'ssid' or 'essid'
		ssid = urlParams.get('ssid') || urlParams.get('essid') || '';
		
		console.log('Detected SSID:', ssid);
	});
	
	async function handleSubmit() {
		if (!validateForm()) return;
		
		isSubmitting = true;
		submitMessage = '';
		
		try {
			// Send data to our backend
			const response = await fetch('/api/guests', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...formData,
					timestamp: new Date().toISOString(),
					redirectUrl: redirectUrl,
					ssid: ssid // Pass the detected WiFi name
				})
			});

			// We handle 409 (Duplicate) as a success so the user can still connect
			if (response.ok || response.status === 409) {
				isSuccess = true;
				submitMessage = 'Connected! Redirecting...';
				
				// Redirect logic
				setTimeout(() => {
					window.location.href = redirectUrl;
				}, 1500);
			} else {
				throw new Error('Registration failed');
			}
		} catch (error) {
			console.error(error);
			submitMessage = 'Connection failed. Please try again.';
			isSuccess = false;
		} finally {
			isSubmitting = false;
		}
	}
	
	function validateForm(): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		// Allow simple phone validation
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

<main class="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
	<div class="bg-white rounded-xl shadow-lg w-full max-w-md p-6 sm:p-8">
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
</main>