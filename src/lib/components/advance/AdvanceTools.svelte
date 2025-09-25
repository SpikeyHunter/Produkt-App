<script lang="ts">
	import RoleListModal from '$lib/components/modals/RoleListModal.svelte';
	import PassportToolModal from '$lib/components/modals/PassportToolModal.svelte';
	import HotelsModal from '$lib/components/modals/HotelsModal.svelte';
	import CalendarInfoSync from '$lib/components/modals/CalendarInfoSync.svelte';
	import CalendarSyncModal from '$lib/components/modals/CalendarSyncModal.svelte';
	import ImmigrationModal from '$lib/components/modals/ImmigrationModal.svelte';
	import { portal } from '$lib/utils/portalUtils.js';
	import type { EventAdvance } from '$lib/types/events.js';
	import { parseRoles } from '$lib/utils/roleUtils.js';
	import { getPassportCompletionStatus, parsePassportInfo } from '$lib/utils/passportUtils.js';
	import { createEventDispatcher } from 'svelte';

	// Props
	export let event: EventAdvance;
	const dispatch = createEventDispatcher();

	// Modal state
	let showRoleModal = false;
	let showPassportModal = false;
	let showHotelModal = false;
	let showCalendarModal = false;
	let showScheduleModal = false;
	let showImmigrationModal = false;

	// --- CORRECTED LOGIC ---

	// Base roles and passport info from event
	$: people = parseRoles(event.roles);
	$: passportInfos = parsePassportInfo(event.passport_info);

	// Filter for people who explicitly have "immigration: true" in their role data.
	// This is a strict check to prevent ambiguity.
	$: immigrationPeople = people.filter((p) => p.immigration === true);

	// Calculate passport completion status based *only* on the filtered list of people.
	$: passportStatus = getPassportCompletionStatus(immigrationPeople, passportInfos);

	// Role button text remains the same, based on the total number of people.
	$: roleButtonText = people.length === 0 ? 'Add roles' : `Modify (${people.length})`;

	// Update passport button text based on the new logic.
	$: passportButtonText = (() => {
		if (people.length === 0) return 'No Team';
		if (immigrationPeople.length === 0) return 'N/A'; // Show N/A if team exists but none require immigration
		if (passportStatus.completed === 0)
			return `Add (${passportStatus.completed}/${passportStatus.total})`;
		return `Modify (${passportStatus.completed}/${passportStatus.total})`;
	})();

	// Disable Passport and Immigration buttons if no one on the team requires immigration.
	$: isPassportButtonDisabled = immigrationPeople.length === 0;
	$: isImmigrationButtonDisabled = immigrationPeople.length === 0;

	// Dynamic classes for buttons correctly reflect the new disabled logic
	$: passportButtonClasses = [
		'bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200 disabled:opacity-50',
		!isPassportButtonDisabled
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: 'cursor-not-allowed'
	]
		.filter(Boolean)
		.join(' ');

	$: immigrationButtonClasses = [
		'bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200 disabled:opacity-50',
		!isImmigrationButtonDisabled
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: 'cursor-not-allowed'
	]
		.filter(Boolean)
		.join(' ');

	// Other button disabled states remain based on the total number of people
	$: isHotelButtonDisabled = people.length === 0;
	$: hotelButtonClasses = [
		'bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200 disabled:opacity-50',
		!isHotelButtonDisabled ? 'hover:bg-lime hover:text-black cursor-pointer' : 'cursor-not-allowed'
	]
		.filter(Boolean)
		.join(' ');
	$: isFlightsButtonDisabled = people.length === 0;
	$: flightsButtonClasses = [
		'bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200 disabled:opacity-50',
		!isFlightsButtonDisabled
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: 'cursor-not-allowed'
	]
		.filter(Boolean)
		.join(' ');

	// Generic handler to notify parent to reload data
	function handleModalSaveSuccess() {
		dispatch('datachanged');
		console.log('✅ Modal saved. Notified parent to refresh data.');
	}

	// Modal open/close functions
	function openRoleModal() {
		showRoleModal = true;
	}
	function handleRoleClose() {
		showRoleModal = false;
	}

	// FIXED: Update the event object with spread to trigger reactivity
	function handleRoleSave(e: CustomEvent<{ event: EventAdvance }>) {
		// Create a new object reference to trigger Svelte reactivity
		event = { ...e.detail.event };
		handleModalSaveSuccess();
		showRoleModal = false;
	}

	function openPassportModal() {
		showPassportModal = true;
	}
	function handlePassportClose() {
		showPassportModal = false;
	}

	// FIXED: Update passport handler to properly update event
	function handlePassportSave(e: CustomEvent<{ event: EventAdvance }>) {
		// Create a new object reference to trigger Svelte reactivity
		event = { ...e.detail.event };
		handleModalSaveSuccess();
		showPassportModal = false;
	}

	function openImmigrationModal() {
		showImmigrationModal = true;
	}
	function handleImmigrationClose() {
		showImmigrationModal = false;
	}

	// FIXED: Update immigration handler to properly update event
	function handleImmigrationSave(e: CustomEvent<{ event: EventAdvance }>) {
		// Create a new object reference to trigger Svelte reactivity
		event = { ...e.detail.event };
		handleModalSaveSuccess();
		showImmigrationModal = false;
	}

	function openHotelModal() {
		showHotelModal = true;
	}
	function handleHotelClose() {
		showHotelModal = false;
	}

	// FIXED: Also update this handler for consistency
	function handleHotelSave(e: CustomEvent<{ event: EventAdvance }>) {
		// Create a new object reference to trigger Svelte reactivity
		event = { ...e.detail.event };
		handleModalSaveSuccess();
		showHotelModal = false;
	}

	function openCalendarModal() {
		showCalendarModal = true;
	}
	function handleCalendarClose() {
		showCalendarModal = false;
	}
	function handleCalendarSyncSuccess(e: CustomEvent) {
		// Update the event object with fresh data from the sync
		if (e.detail.updatedEvent) {
			event = { ...e.detail.updatedEvent };
		}
		handleModalSaveSuccess();
		// Don't close the modal here - let user see the success message and close manually
	}

	function openScheduleModal() {
		showScheduleModal = true;
	}
	function handleScheduleClose() {
		showScheduleModal = false;
	}
</script>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-40 h-[365px]"
>
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray1">
		<h2 class="text-xl font-normal text-gray3 truncate flex-1 mr-4">Tools</h2>
	</div>
	<div class="flex-1 flex flex-col gap-3 px-4 py-2">
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
					><path
						d="M5.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM2.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM18.75 7.5a.75.75 0 0 0-1.5 0v2.25H15a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H21a.75.75 0 0 0 0-1.5h-2.25V7.5Z"
					/></svg
				>
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer"
				on:click={openRoleModal}
			>
				{roleButtonText}
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
					><path
						fill-rule="evenodd"
						d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15Z"
						clip-rule="evenodd"
					/></svg
				>
			</div>
			<button
				class={passportButtonClasses}
				on:click={openPassportModal}
				disabled={isPassportButtonDisabled}
			>
				{passportButtonText}
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
				>
					<path
						d="M12 4a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3m0-2a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5z"
					></path>
					<path
						d="M12 13.5c-2.25 0-4.4.7-6.2 1.84a3.34 3.34 0 0 0-1.8 3V22h16v-3.66a3.34 3.34 0 0 0-1.8-3C16.4 14.2 14.25 13.5 12 13.5z"
					></path>
					<path
						d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 4h12v16H6V4z"
					></path>
				</svg>
			</div>
			<button
				class={immigrationButtonClasses}
				on:click={openImmigrationModal}
				disabled={isImmigrationButtonDisabled}
			>
				Immigration
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
					><path
						d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
					/></svg
				>
			</div>
			<button
				class={flightsButtonClasses}
				on:click={openCalendarModal}
				disabled={isFlightsButtonDisabled}
			>
				Flights
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
					><path
						d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V7H1v10h22v-6c0-2.21-1.79-4-4-4z"
					/></svg
				>
			</div>
			<button class={hotelButtonClasses} on:click={openHotelModal} disabled={isHotelButtonDisabled}>
				Hotels
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="currentColor"
					class="w-6 h-6"
					><path
						fill-rule="evenodd"
						d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zM5.25 6.75c-.621 0-1.125.504-1.125 1.125V18a1.125 1.125 0 001.125 1.125h13.5A1.125 1.125 0 0019.875 18V7.875c0-.621-.504-1.125-1.125-1.125H5.25z"
						clip-rule="evenodd"
					/></svg
				>
			</div>
			<button
				class={flightsButtonClasses}
				on:click={openScheduleModal}
				disabled={isFlightsButtonDisabled}
			>
				Schedule
			</button>
		</div>
	</div>
</div>

{#if showRoleModal}
	<div use:portal>
		<RoleListModal
			bind:isOpen={showRoleModal}
			{event}
			on:save={handleRoleSave}
			on:close={handleRoleClose}
		/>
	</div>
{/if}
{#if showPassportModal}
	<div use:portal>
		<PassportToolModal
			bind:isOpen={showPassportModal}
			{event}
			on:save={handlePassportSave}
			on:close={handlePassportClose}
		/>
	</div>
{/if}
{#if showImmigrationModal}
	<div use:portal>
		<ImmigrationModal
			bind:isOpen={showImmigrationModal}
			{event}
			on:save={handleImmigrationSave}
			on:close={handleImmigrationClose}
		/>
	</div>
{/if}
{#if showHotelModal}
	<div use:portal>
		<HotelsModal
			bind:isOpen={showHotelModal}
			{event}
			on:save={handleHotelSave}
			on:close={handleHotelClose}
		/>
	</div>
{/if}
{#if showCalendarModal}
	<div use:portal>
		<CalendarSyncModal
			bind:isOpen={showCalendarModal}
			{event}
			on:close={() => (showCalendarModal = false)}
			on:calendar_sync_success={handleCalendarSyncSuccess}
		/>
	</div>
{/if}
{#if showScheduleModal}
	<div use:portal>
		<CalendarSyncModal
			bind:isOpen={showScheduleModal}
			{event}
			on:close={handleScheduleClose}
			on:save_success={handleModalSaveSuccess}
		/>
	</div>
{/if}
