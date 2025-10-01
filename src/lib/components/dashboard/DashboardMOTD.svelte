<script lang="ts">
	import { onMount } from 'svelte';
	import motdList from '$lib/data/motd.json';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	let currentMotd = '';
	let displayText = '';
	let isTyping = false;

	function generateMotd() {
		if (!motdList || motdList.length === 0) {
			currentMotd = 'Welcome to Produkt App!';
			return;
		}
		const randomIndex = Math.floor(Math.random() * motdList.length);
		currentMotd = motdList[randomIndex];
		typewriterEffect();
	}

	function typewriterEffect() {
		isTyping = true;
		displayText = '';
		let index = 0;

		const interval = setInterval(() => {
			if (index < currentMotd.length) {
				displayText += currentMotd[index];
				index++;
			} else {
				clearInterval(interval);
				isTyping = false;
			}
		}, 30);
	}

	function refreshMotd() {
		generateMotd();
	}

	onMount(() => {
		generateMotd();
	});
</script>

<DashboardTemplate title="Message of the Day" width={300} height={242}>
	<div slot="icon">
		<svg class="w-5 h-5 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path
				d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
			></path>
		</svg>
	</div>

	<div slot="header-actions">
		<button
			on:click={refreshMotd}
			class="p-1.5 text-gray3 hover:text-lime transition-all hover:rotate-180 duration-300"
			disabled={isTyping}
			aria-label="Get new message"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<polyline points="23 4 23 10 17 10"></polyline>
				<polyline points="1 20 1 14 7 14"></polyline>
				<path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 
10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
			</svg>
		</button>
	</div>

	<div class="flex-1 grid place-items-center text-center px-2 pt-10">
		<p class="text-white text-lg leading-relaxed italic">
			"{displayText}"
			{#if isTyping}
				<span class="inline-block w-0.5 h-4 bg-lime animate-blink ml-0.5"></span>
			{/if}
		</p>
	</div>
</DashboardTemplate>

<style>
	@keyframes blink {
		0%,
		50% {
			opacity: 1;
		}
		51%,
		100% {
			opacity: 0;
		}
	}

	.animate-blink {
		animation: blink 1s infinite;
	}
</style>