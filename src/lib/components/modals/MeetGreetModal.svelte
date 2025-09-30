<script lang="ts">
	import Modal from './Modal.svelte';
	import Button from '../buttons/Button.svelte';
	import { createEventDispatcher } from 'svelte';
	import { updateEventAdvance, type EventAdvance } from '../../services/eventsService';
	import type { MeetGreetInfo } from '$lib/types/events';

	export let isOpen = false;
	export let event: EventAdvance;

	$: artistName = event ? event.artist_name : 'Artist Name';
	$: meetGreetEnabled = event?.meetgreet_enabled === true;

	const dispatch = createEventDispatcher();
	let isSaving = false;

	// Form state
	let time = '22:00';
	let peopleCount = 1;
	let contactName = '';
	let contactNumber = '';
	let details = '';

	// Load data when modal opens
	$: if (isOpen && event) {
		let info = event.meetgreet_info;
		if (info && typeof info === 'string') {
			try {
				info = JSON.parse(info) as MeetGreetInfo;
			} catch (e) {
				console.error('Failed to parse meetgreet_info:', e);
				info = null;
			}
		}

		if (info && typeof info === 'object' && info !== null) {
			const validInfo = info as MeetGreetInfo;
			time = validInfo.time || '22:00';
			peopleCount = validInfo.peopleCount || 1;
			contactName = validInfo.contactName || '';
			contactNumber = validInfo.contactNumber || '';
			details = validInfo.details || '';
		} else {
			// Reset to defaults if no info
			time = '22:00';
			peopleCount = 1;
			contactName = '';
			contactNumber = '';
			details = '';
		}
	}

	function handleClose() {
		dispatch('close');
	}

	async function toggleMeetGreetEnabled() {
		if (isSaving) return;

		isSaving = true;
		try {
			const newMeetGreetEnabled = !meetGreetEnabled;
			await updateEventAdvance(event.event_id, event.artist_name, {
				meetgreet_enabled: newMeetGreetEnabled
			});
			event = { ...event, meetgreet_enabled: newMeetGreetEnabled };
		} catch (error) {
			console.error('Failed to toggle Meet & Greet enabled:', error);
		} finally {
			isSaving = false;
		}
	}

	async function handleSave() {
		if (!event) return;
		isSaving = true;
		try {
			const meetGreetInfoPayload: MeetGreetInfo = {
				time,
				peopleCount,
				contactName,
				contactNumber,
				details
			};
			await updateEventAdvance(event.event_id, event.artist_name, {
				meetgreet_info: meetGreetInfoPayload
			});
			dispatch('save_success');
			handleClose();
		} catch (error) {
			console.error('Failed to save meet & greet info:', error);
		} finally {
			isSaving = false;
		}
	}

	function incrementPeople() {
		peopleCount += 1;
	}

	function decrementPeople() {
		if (peopleCount > 1) {
			peopleCount -= 1;
		}
	}
</script>

<Modal {isOpen} on:close={handleClose} title="Meet & Greet - {artistName}" maxWidth="max-w-xl" hasFooter={true}>
	<div class="relative">
		<div
			class="flex flex-col gap-y-4 p-2 {meetGreetEnabled
				? ''
				: 'opacity-20 blur-sm pointer-events-none'}"
		>
			<div class="grid grid-cols-2 gap-x-6 gap-y-4">
				<div class="space-y-4">
					<label class="block">
						<span class="text-xs text-gray2 block mb-1">Time</span>
						<input
							type="time"
							bind:value={time}
							class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:outline-none focus:ring-lime focus:border-lime px-3 py-2"
						/>
					</label>
					<div>
						<span class="text-xs text-gray2 block mb-1">Number of People</span>
						<div class="flex items-center gap-2">
							<button
								on:click={decrementPeople}
								class="w-9 h-9 flex items-center justify-center bg-gray1 text-gray2 rounded-lg text-2xl transition-colors hover:bg-lime hover:text-black cursor-pointer"
								aria-label="Decrease number of people"
							>
								-
							</button>
							<span
								class="flex-1 text-center h-9 leading-9 bg-navbar border border-gray2/50 text-white text-sm rounded-lg"
							>
								{peopleCount}
							</span>
							<button
								on:click={incrementPeople}
								class="w-9 h-9 flex items-center justify-center bg-gray1 text-gray2 rounded-lg text-2xl transition-colors hover:bg-lime hover:text-black cursor-pointer"
								aria-label="Increase number of people"
							>
								+
							</button>
						</div>
					</div>
				</div>

				<div class="space-y-4">
					<label class="block">
						<span class="text-xs text-gray2 block mb-1">Contact on Site</span>
						<input
							type="text"
							bind:value={contactName}
							placeholder="e.g., Jane Doe"
							class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:outline-none focus:ring-lime focus:border-lime px-3 py-2"
						/>
					</label>
					<label class="block">
						<span class="text-xs text-gray2 block mb-1">Contact's Number</span>
						<input
							type="tel"
							bind:value={contactNumber}
							placeholder="514-123-4567"
							class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:outline-none focus:ring-lime focus:border-lime px-3 py-2"
						/>
					</label>
				</div>
			</div>

			<div>
				<label class="block">
					<span class="text-xs text-gray2 block mb-1">Details</span>
					<textarea
						bind:value={details}
						rows="4"
						placeholder="Add any other relevant details..."
						class="w-full bg-navbar border border-gray2/50 text-white text-sm rounded-lg focus:outline-none focus:ring-lime focus:border-lime px-3 py-2"
					></textarea>
				</label>
			</div>
		</div>

		{#if !meetGreetEnabled}
			<div
				class="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-lg flex items-center justify-center cursor-not-allowed"
			>
				<div class="text-white text-center pointer-events-none">
					<p class="text-lg font-semibold">Meet & Greet Disabled</p>
					<p class="text-sm text-gray2">Enable below to use this feature</p>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex justify-end items-center w-full gap-3">
		<button
			type="button"
			on:click={toggleMeetGreetEnabled}
			disabled={isSaving}
			class="px-8 py-3 text-sm border transition-colors rounded-full cursor-pointer {meetGreetEnabled
				? 'bg-lime text-black font-bold border-lime hover:bg-transparent hover:text-lime'
				: 'bg-navbar border-lime text-lime hover:bg-lime hover:text-black hover:border-lime'}"
		>
			{meetGreetEnabled ? 'Enabled' : 'Disabled'}
		</button>

		<Button on:click={handleSave} variant="filled" disabled={isSaving}>
			{isSaving ? 'Saving...' : 'Save & Close'}
		</Button>
	</div>
</Modal>