<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';
	import { onMount } from 'svelte';

	import DatePickerRange from '$lib/components/buttons/DatePickerRange.svelte';
	import PopupNotification from '$lib/components/modals/PopupNotification.svelte';

	export let show = false;

	// State
	let startDate = '';
	let endDate = '';
	let showHoldsCount = false;
	let loading = false;
	let showCopyPopup = false;

	// 0 = Sunday, 1 = Monday, etc.
	let selectedDays: number[] = [0, 1, 2, 3, 4, 5, 6];
	const daysOfWeek = [
		{ label: 'Su', val: 0 },
		{ label: 'M', val: 1 },
		{ label: 'T', val: 2 },
		{ label: 'W', val: 3 },
		{ label: 'Th', val: 4 },
		{ label: 'F', val: 5 },
		{ label: 'Sa', val: 6 }
	];

	// Dynamic Venues State
	let dynamicVenues: { category: string; room: string }[] = [];
	let generatedText = '';
	let rawEvents: any[] = [];

	onMount(() => {
		// Default to current month
		const today = new Date();
		const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
		const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

		startDate = formatDateForInput(firstDay);
		endDate = formatDateForInput(lastDay);
	});

	$: if (show && startDate && endDate) {
		fetchEvents();
	}

	$: if (show && dynamicVenues.length === 0) {
		fetchVenues();
	}

	$: {
		// Re-generate text whenever filters change or data loads
		if (rawEvents && selectedDays && showHoldsCount !== null && dynamicVenues.length > 0) {
			generateAvailsText();
		}
	}

	function formatDateForInput(date: Date) {
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${y}-${m}-${d}`;
	}

	function parseLocalDate(dateStr: string) {
		const [y, m, d] = dateStr.split('-').map(Number);
		return new Date(y, m - 1, d);
	}

	function toggleDay(val: number) {
		if (selectedDays.includes(val)) {
			selectedDays = selectedDays.filter((d) => d !== val);
		} else {
			selectedDays = [...selectedDays, val].sort();
		}
	}

	async function fetchVenues() {
		try {
			const { data, error } = await supabase
				.from('calendar_settings')
				.select('*')
				.eq('setting_type', 'VENUE'); // Filter added here

			if (!error && data) {
				const vList: { category: string; room: string }[] = [];

				data.forEach((row) => {
					let params = row.setting_params;
					if (typeof params === 'string') {
						try {
							params = JSON.parse(params);
						} catch (e) {
							console.error('Error parsing venue params:', e);
						}
					}
					
					// Filter for venue/stages related settings
					if (params?.stages && Array.isArray(params.stages)) {
						params.stages.forEach((stage: any) => {
							vList.push({ category: row.setting_name, room: stage.name });
						});
					}
				});
				dynamicVenues = vList;
				generateAvailsText(); // Trigger text generation after venues load
			}
		} catch (err) {
			console.error('Error fetching venues for avails:', err);
		}
	}

	async function fetchEvents() {
		if (!startDate || !endDate) return;
		loading = true;

		try {
			const { data, error } = await supabase
				.from('calendar_events')
				.select('date, status, venue')
				.gte('date', startDate)
				.lte('date', endDate)
				.neq('status', 'HIDDEN');

			if (!error && data) {
				rawEvents = data;
			}
		} catch (err) {
			console.error('Error fetching events for avails:', err);
		} finally {
			loading = false;
		}
	}

	function generateAvailsText() {
		if (!startDate || !endDate || dynamicVenues.length === 0) return;

		// Map events: { 'New City Gas|Main Room': { '2026-02-01': { confirmed: 0, holds: 2 } } }
		const statsMap: Record<string, Record<string, { confirmed: number; holds: number }>> = {};

		rawEvents.forEach((ev) => {
			if (!ev.venue) return;
			const key = `${ev.venue.category}|${ev.venue.room || ev.venue.category}`;

			if (!statsMap[key]) statsMap[key] = {};
			if (!statsMap[key][ev.date]) statsMap[key][ev.date] = { confirmed: 0, holds: 0 };

			if (ev.status === 'CONFIRMED') {
				statsMap[key][ev.date].confirmed++;
			} else if (ev.status === 'HOLD' || ev.status === 'PENDING') {
				statsMap[key][ev.date].holds++;
			}
		});

		let text = '';
		const startObj = parseLocalDate(startDate);
		const endObj = parseLocalDate(endDate);

		for (const venue of dynamicVenues) {
			const venueKey = `${venue.category}|${venue.room}`;

			// Formatted to output exactly "Category | Room" on one line
			let venueText = `${venue.category} | ${venue.room}\n`;
			let hasDates = false;

			let curr = new Date(startObj);
			while (curr <= endObj) {
				if (selectedDays.includes(curr.getDay())) {
					hasDates = true;

					const dateStr = formatDateForInput(curr);

					// Format output date: "Sat, Feb 7, 2026"
					const displayDate = curr.toLocaleDateString('en-US', {
						weekday: 'short',
						month: 'short',
						day: 'numeric',
						year: 'numeric'
					});

					const stats = statsMap[venueKey]?.[dateStr] || { confirmed: 0, holds: 0 };

					let statusText = 'OPEN';

					if (stats.confirmed > 0) {
						statusText = 'NOT AVAILABLE';
					} else if (stats.holds > 0) {
						if (showHoldsCount) {
							statusText = `${stats.holds} HOLD${stats.holds > 1 ? 'S' : ''}`;
						} else {
							statusText = 'HOLDS';
						}
					}

					venueText += `  ${displayDate} - ${statusText}\n`;
				}
				curr.setDate(curr.getDate() + 1);
			}

			if (hasDates) {
				text += venueText + '\n';
			}
		}

		generatedText = text.trim();
	}

	async function copyToClipboard() {
		try {
			await navigator.clipboard.writeText(generatedText);
			showCopyPopup = true;

			// Hide popup after 3 seconds
			setTimeout(() => {
				showCopyPopup = false;
			}, 3000);
		} catch (err) {
			console.error('Failed to copy text: ', err);
		}
	}

	function closeModal() {
		show = false;
	}
</script>

{#if show}
	<div use:portal class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/50"
			transition:fade={{ duration: 200 }}
			on:click={closeModal}
			aria-hidden="true"
		></div>

		<div
			class="bg-gray1 border border-gray2/20 rounded-3xl shadow-2xl w-full max-w-md relative z-10 flex flex-col max-h-[90vh]"
			transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
		>
			<div class="flex items-center justify-between p-6 border-b border-gray2/10 shrink-0">
				<h2 class="text-xl font-black text-white">Share Avails</h2>
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
						<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-6">
				<div class="flex flex-col gap-1.5 w-full">
					<span class="block text-xs font-bold text-gray2">Select Date Range</span>
					<DatePickerRange bind:startDate bind:endDate on:change={fetchEvents} />
				</div>

				<div class="flex items-center gap-3">
					<div
						class="relative flex items-center justify-center w-5 h-5 bg-black/30 border border-gray2/30 rounded-lg cursor-pointer has-[:checked]:bg-lime has-[:checked]:border-lime transition-colors"
					>
						<input
							id="holds-count-check"
							type="checkbox"
							class="appearance-none w-full h-full absolute inset-0 cursor-pointer peer"
							bind:checked={showHoldsCount}
						/>
						<svg
							class="w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 pointer-events-none z-10"
							viewBox="0 0 14 10"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M1 5L4.5 8.5L13 1" />
						</svg>
					</div>
					<label for="holds-count-check" class="text-white font-bold text-sm cursor-pointer">
						Show Holds Count
					</label>
				</div>

				<div class="flex gap-2 justify-center">
					{#each daysOfWeek as day}
						<button
							class="w-10 h-10 rounded-full font-bold text-sm transition-all cursor-pointer flex items-center justify-center border-2
            {selectedDays.includes(day.val)
								? 'bg-lime border-lime text-black'
								: 'bg-transparent border-gray2/30 text-gray2 hover:border-gray2 hover:text-white'}"
							on:click={() => toggleDay(day.val)}
						>
							{day.label}
						</button>
					{/each}
				</div>

				<div class="relative flex-1 min-h-[300px]">
					{#if loading}
						<div
							class="absolute inset-0 bg-black/30 rounded-2xl flex items-center justify-center z-10 backdrop-blur-[2px]"
						>
							<div
								class="w-8 h-8 border-4 border-lime/20 border-t-lime rounded-full animate-spin"
							></div>
						</div>
					{/if}
					<textarea
						readonly
						class="w-full h-full min-h-[300px] bg-black/30 border border-gray2/20 rounded-2xl p-4 text-sm text-gray3 font-mono focus:outline-none focus:border-lime transition-all resize-none custom-scrollbar"
						value={generatedText}
					></textarea>
				</div>
			</div>

			<div
				class="p-6 border-t border-gray2/10 flex justify-end gap-4 shrink-0 bg-gray1 rounded-b-3xl"
			>
				<button
					class="px-6 py-3 bg-lime text-black font-bold rounded-full hover:bg-lime/90 transition-all cursor-pointer flex items-center justify-center gap-2"
					on:click={copyToClipboard}
				>
					Copy to Clipboard
				</button>
			</div>
		</div>
	</div>
{/if}

<PopupNotification
	bind:show={showCopyPopup}
	message="Copied to clipboard!"
	variant="navbar"
	iconType="success"
/>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 8px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(189, 189, 187, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: var(--color-lime);
	}
</style>