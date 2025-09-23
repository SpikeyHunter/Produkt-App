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
	
	// Extract URL parameters from Aruba captive portal
	let urlParams: URLSearchParams;
	let redirectUrl = '';
	
	onMount(() => {
		urlParams = new URLSearchParams(window.location.search);
		redirectUrl = urlParams.get('url') || '';
	});
	
	async function handleSubmit() {
		if (!validateForm()) return;
		
		isSubmitting = true;
		submitMessage = '';
		
		try {
			// Store guest data in Supabase
			const response = await fetch('/api/guests', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					...formData,
					timestamp: new Date().toISOString(),
					redirectUrl: redirectUrl
				})
			});
			
			if (response.ok) {
				isSuccess = true;
				submitMessage = 'Registration successful! Connecting to WiFi...';
				
				// Redirect to Aruba success URL or default
				setTimeout(() => {
					if (redirectUrl) {
						window.location.href = redirectUrl;
					} else {
						// Fallback redirect for Aruba captive portal
						window.location.href = 'http://1.1.1.1/';
					}
				}, 2000);
			} else {
				throw new Error('Registration failed');
			}
		} catch (error) {
			submitMessage = 'Registration failed. Please try again.';
			isSuccess = false;
		} finally {
			isSubmitting = false;
		}
	}
	
	function validateForm(): boolean {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
		
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
		if (!phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
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
	<title>WiFi Access - Guest Registration</title>
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
	<div class="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
				<svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
				</svg>
			</div>
			<h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Free WiFi</h1>
			<p class="text-gray-600">Please register to access the internet</p>
		</div>

		<!-- Registration Form -->
		<form on:submit|preventDefault={handleSubmit} class="space-y-6">
			<!-- First Name -->
			<div>
				<label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
					First Name *
				</label>
				<input
					type="text"
					id="firstName"
					bind:value={formData.firstName}
					required
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
					placeholder="Enter your first name"
					disabled={isSubmitting}
				>
			</div>

			<!-- Last Name -->
			<div>
				<label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
					Last Name *
				</label>
				<input
					type="text"
					id="lastName"
					bind:value={formData.lastName}
					required
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
					placeholder="Enter your last name"
					disabled={isSubmitting}
				>
			</div>

			<!-- Email -->
			<div>
				<label for="email" class="block text-sm font-medium text-gray-700 mb-2">
					Email Address *
				</label>
				<input
					type="email"
					id="email"
					bind:value={formData.email}
					required
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
					placeholder="Enter your email address"
					disabled={isSubmitting}
				>
			</div>

			<!-- Phone -->
			<div>
				<label for="phone" class="block text-sm font-medium text-gray-700 mb-2">
					Phone Number *
				</label>
				<input
					type="tel"
					id="phone"
					value={formData.phone}
					on:input={formatPhoneInput}
					required
					class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
					placeholder="Enter your phone number"
					disabled={isSubmitting}
				>
			</div>

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={isSubmitting}
				class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
			>
				{#if isSubmitting}
					<svg class="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Connecting...
				{:else}
					Connect to WiFi
				{/if}
			</button>

			<!-- Status Message -->
			{#if submitMessage}
				<div class="text-center p-3 rounded-lg {isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
					{submitMessage}
				</div>
			{/if}
		</form>

		<!-- Terms -->
		<div class="mt-6 text-center">
			<p class="text-xs text-gray-500">
				By connecting, you agree to our terms of service and privacy policy.
				Internet usage may be monitored for security purposes.
			</p>
		</div>
	</div>
</main>

<style>
	/* Additional Tailwind v4 compatible styles if needed */
	input:focus {
		outline: none;
	}
</style>