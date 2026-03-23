<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut, cubicIn } from 'svelte/easing';
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import { authStore } from '$lib/stores/authStore';

	export let isOpen = false;

	let loading = true;
	let isSaving = false;

	const daysOfWeek = [
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday'
	];
	
	let selectedDay = 'Sunday';

	async function fetchPreferences() {
		const userId = $authStore.profile?.id;
		if (!userId) return;

		loading = true;
		const { data, error } = await supabase
			.from('user_profiles')
			.select('user_settings')
			.eq('id', userId)
			.single();

		if (!error && data?.user_settings) {
			// Extract start_week_on from the JSONB, defaulting to Sunday
			selectedDay = data.user_settings.start_week_on || 'Sunday';
		}
		
		loading = false;
	}

	$: if (isOpen) {
		fetchPreferences();
	}

	async function savePreferences() {
		const userId = $authStore.profile?.id;
		if (!userId) return;

		isSaving = true;

		// 1. Fetch current settings so we don't overwrite other JSONB keys (like 'theme')
		const { data: currentData } = await supabase
			.from('user_profiles')
			.select('user_settings')
			.eq('id', userId)
			.single();

		const currentSettings = currentData?.user_settings || {};
		
		// 2. Merge our new setting
		const newSettings = { 
			...currentSettings, 
			start_week_on: selectedDay 
		};

		// 3. Update the user_profiles table
		const { error } = await supabase
			.from('user_profiles')
			.update({ user_settings: newSettings })
			.eq('id', userId);

		isSaving = false;
		
		if (!error) {
			closeModal();
			// Force the browser to refresh the page to apply the new calendar start day instantly
			window.location.reload();
		}
	
	}

	function closeModal() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div use:portal class="fixed inset-0 z-[90] flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/80 backdrop-blur-sm"
			transition:fade|local={{ duration: 200 }}
			on:click={closeModal}
			aria-hidden="true"
		></div>

		<div
			class="bg-gray1 border border-gray2/20 rounded-3xl shadow-2xl w-full max-w-2xl relative z-10 flex flex-col"
			in:fly|local={{ y: 20, duration: 250, easing: cubicOut }}
			out:fly|local={{ y: 20, duration: 200, easing: cubicIn }}
		>
			<div class="flex items-center justify-between p-6 border-b border-gray2/10 shrink-0">
				<h2 class="text-xl font-black text-white tracking-wide">My Preferences</h2>
				<button
					class="text-gray2 hover:text-white transition-colors cursor-pointer"
					on:click={closeModal}
					aria-label="Close modal"
				>
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="p-6 flex-1 flex flex-col gap-8">
				{#if loading}
					<div class="flex justify-center p-8">
						<div class="w-8 h-8 border-4 border-lime border-t-lime rounded-full animate-spin"></div>
					</div>
				{:else}
					<section class="space-y-4">
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-black text-lime uppercase tracking-widest">
								Calendar Display
							</h3>
						</div>
						
						<div class="bg-black/30 rounded-2xl p-5 border border-gray2/5 flex flex-col gap-4">
							<div>
								<p class="text-sm font-bold text-white">Start week on</p>
								<p class="text-xs text-gray2 mt-1 mb-4">
									Choose which day should appear first in your calendar views.
								</p>
							</div>

							<div class="flex w-full gap-1 sm:gap-2">
								{#each daysOfWeek as day}
									{@const isSelected = selectedDay === day}
									<button
										class="flex-1 py-2 px-1 rounded-3xl text-[10px] sm:text-xs font-bold border transition-all cursor-pointer truncate {isSelected
											? 'bg-lime text-black border-lime'
											: 'bg-black/30 text-gray3 border-transparent hover:bg-white/5 hover:text-white'}"
										on:click={() => (selectedDay = day)}
										title={day}
									>
										{day}
									</button>
								{/each}
							</div>
						</div>
					</section>
				{/if}
			</div>

			<div class="p-6 border-t border-gray2/10 flex justify-end">
				<button
					class="px-5 py-4 font-bold text-sm rounded-full transition-all duration-300 flex items-center justify-center min-w-[140px] cursor-pointer disabled:cursor-not-allowed bg-lime text-black hover:bg-lime/90 {isSaving || loading ? 'opacity-50' : ''}"
					on:click={savePreferences}
					disabled={isSaving || loading}
				>
					{#if isSaving}
						<div in:fade={{ duration: 150 }} class="flex items-center">
							<svg
								class="animate-spin -ml-1 mr-2 h-4 w-4 text-black"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
							>
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Saving...
						</div>
					{:else}
						<div in:fade={{ duration: 150 }}>Save & Close</div>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}