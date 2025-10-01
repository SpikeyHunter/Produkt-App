<script lang="ts">
	import RoleListModal from '$lib/components/modals/RoleListModal.svelte';
	import PassportToolModal from '$lib/components/modals/PassportToolModal.svelte';
	import HotelsModal from '$lib/components/modals/HotelsModal.svelte';
	import CalendarInfoSync from '$lib/components/modals/CalendarInfoSync.svelte';
	import CalendarSyncModal from '$lib/components/modals/CalendarSyncModal.svelte';
	import ImmigrationModal from '$lib/components/modals/ImmigrationModal.svelte';
	import AdvanceMeetGreetModal from '$lib/components/modals/MeetGreetModal.svelte';
	import NotesModal from '$lib/components/modals/NotesModal.svelte'; // IMPORTED
	import { portal } from '$lib/utils/portalUtils.js';
	import type { EventAdvance } from '$lib/types/events.js';
	import { parseRoles } from '$lib/utils/roleUtils.js';
	import { getPassportCompletionStatus, parsePassportInfo } from '$lib/utils/passportUtils.js';
	import { createEventDispatcher } from 'svelte';

	export let event: EventAdvance;
	const dispatch = createEventDispatcher();

	let showRoleModal = false;
	let showPassportModal = false;
	let showHotelModal = false;
	let showFlightsModal = false;
	let showScheduleModal = false;
	let showImmigrationModal = false;
	let showMeetGreetModal = false;
	let showNotesModal = false; // ADDED

	$: people = parseRoles(event.roles);
	$: passportInfos = parsePassportInfo(event.passport_info);
	$: immigrationPeople = people.filter((p) => p.immigration === true);
	$: passportStatus = getPassportCompletionStatus(immigrationPeople, passportInfos);
	$: roleButtonText = people.length === 0 ? 'Add roles' : `Modify (${people.length})`;
	$: passportButtonText = (() => {
		if (people.length === 0) return 'No Team';
		if (immigrationPeople.length === 0) return 'N/A';
		if (passportStatus.completed === 0)
			return `Add (${passportStatus.completed}/${passportStatus.total})`;
		return `Modify (${passportStatus.completed}/${passportStatus.total})`;
	})();
	$: isPassportButtonDisabled = immigrationPeople.length === 0;
	$: isImmigrationButtonDisabled = immigrationPeople.length === 0;
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
	$: isHotelButtonDisabled = people.length === 0;
	$: hotelButtonClasses = [
		'rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200',
		event.hotel_enabled === false ?
'bg-gray2 text-black opacity-50' : 'bg-gray2 text-black',
		!isHotelButtonDisabled && event.hotel_enabled !== false
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: isHotelButtonDisabled
			? 'cursor-not-allowed opacity-50'
			: 'cursor-pointer'
	]
		.filter(Boolean)
		.join(' ');
	$: isFlightsButtonDisabled = people.length === 0;
	$: flightsButtonClasses = [
		'rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200',
		event.flights_enabled === false ?
'bg-gray2 text-black opacity-50' : 'bg-gray2 text-black',
		!isFlightsButtonDisabled && event.flights_enabled !== false
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: isFlightsButtonDisabled
			? 'cursor-not-allowed opacity-50'
			: 'cursor-pointer'
	]
		.filter(Boolean)
		.join(' ');
	$: isScheduleButtonDisabled = people.length === 0;
	$: scheduleButtonClasses = [
		'rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200',
		event.ground_enabled === false ?
'bg-gray2 text-black opacity-50' : 'bg-gray2 text-black',
		!isScheduleButtonDisabled && event.ground_enabled !== false
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: isScheduleButtonDisabled
			? 'cursor-not-allowed opacity-50'
			: 'cursor-pointer'
	]
		.filter(Boolean)
		.join(' ');
	$: isMeetGreetButtonDisabled = people.length === 0;
	$: meetGreetButtonClasses = [
		'rounded-xl px-3 py-1 font-bold text-xs transition-all duration-200',
		event.meetgreet_enabled === false ?
'bg-gray2 text-black opacity-50' : 'bg-gray2 text-black',
		!isMeetGreetButtonDisabled && event.meetgreet_enabled !== false
			? 'hover:bg-lime hover:text-black cursor-pointer'
			: isMeetGreetButtonDisabled
			? 'cursor-not-allowed opacity-50'
			: 'cursor-pointer'
	]
		.filter(Boolean)
		.join(' ');

	function handleModalSaveSuccess() {
		dispatch('datachanged');
		console.log('✅ Modal saved. Notified parent to refresh data.');
	}

	function openRoleModal() {
		showRoleModal = true;
	}
	function handleRoleClose() {
		showRoleModal = false;
	}
	function handleRoleSave(e: CustomEvent<{ event: EventAdvance }>) {
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
	function handlePassportSave(e: CustomEvent<{ event: EventAdvance }>) {
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
	function handleImmigrationSave(e: CustomEvent<{ event: EventAdvance }>) {
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
	function handleHotelSave(e: CustomEvent<{ event: EventAdvance }>) {
		event = { ...e.detail.event };
		handleModalSaveSuccess();
		showHotelModal = false;
	}

	function openFlightsModal() {
		showFlightsModal = true;
	}
	function handleFlightsClose() {
		showFlightsModal = false;
	}

	function openScheduleModal() {
		showScheduleModal = true;
	}
	function handleScheduleClose() {
		showScheduleModal = false;
	}
	function handleCalendarSyncSuccess(e: CustomEvent) {
		if (e.detail.updatedEvent) {
			event = { ...e.detail.updatedEvent };
			dispatch('datachanged', event);
		}
	}

	function openMeetGreetModal() {
		showMeetGreetModal = true;
	}
	function handleMeetGreetClose() {
		showMeetGreetModal = false;
	}

	// ADDED START
	function openNotesModal() {
		showNotesModal = true;
	}
	function handleNotesClose() {
		showNotesModal = false;
	}
	// ADDED END
</script>

<div
	class="flex flex-col bg-navbar rounded-2xl overflow-hidden transition-all duration-300 w-40 h-[405px]"
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
				on:click={openFlightsModal}
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
				class={scheduleButtonClasses}
				on:click={openScheduleModal}
				disabled={isScheduleButtonDisabled}
			>
				Schedule
			</button>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<div class="w-6 h-6 text-gray3">
				<svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
					<path
						fill-rule="evenodd"
						clip-rule="evenodd"
						d="M3 18C3 15.3945 4.66081 13.1768 6.98156 12.348C7.61232 12.1227 8.29183 12 9 12C9.70817 12 10.3877 12.1227 11.0184 12.348C11.3611 12.4703 11.6893 12.623 12 12.8027C12.3107 12.623 12.6389 12.4703 12.9816 12.348C13.6123 12.1227 14.2918 12 15 12C15.7082 12 16.3877 12.1227 17.0184 12.348C19.3392 13.1768 21 15.3945 21 18V21H15.75V19.5H19.5V18C19.5 15.5147 17.4853 13.5 15 13.5C14.4029 13.5 13.833 13.6163 13.3116 13.8275C14.3568 14.9073 15 16.3785 15 18V21H3V18ZM9 11.25C8.31104 11.25 7.66548 11.0642 7.11068 10.74C5.9977 10.0896 5.25 8.88211 5.25 7.5C5.25 5.42893 6.92893 3.75 9 3.75C10.2267 3.75 11.3158 4.33901 12 5.24963C12.6842 4.33901 13.7733 3.75 15 3.75C17.0711 3.75 18.75 5.42893 18.75 7.5C18.75 8.88211 18.0023 10.0896 16.8893 10.74C16.3345 11.0642 15.689 11.25 15 11.25C14.311 11.25 13.6655 11.0642 13.1107 10.74C12.6776 10.4869 12.2999 10.1495 12 9.75036C11.7001 10.1496 11.3224 10.4869 10.8893 10.74C10.3345 11.0642 9.68896 11.25 9 11.25ZM13.5 18V19.5H4.5V18C4.5 15.5147 6.51472 13.5 9 13.5C11.4853 13.5 13.5 15.5147 13.5 18ZM11.25 7.5C11.25 8.74264 10.2426 9.75 9 9.75C7.75736 9.75 6.75 8.74264 6.75 7.5C6.75 6.25736 7.75736 5.25 9 5.25C10.2426 5.25 11.25 6.25736 11.25 7.5ZM15 5.25C13.7574 5.25 12.75 6.25736 12.75 7.5C12.75 8.74264 13.7574 9.75 15 9.75C16.2426 9.75 17.25 8.74264 17.25 7.5C17.25 6.25736 16.2426 5.25 15 5.25Z"
					></path>
				</svg>
			</div>
			<button
				class={meetGreetButtonClasses}
				on:click={openMeetGreetModal}
				disabled={isMeetGreetButtonDisabled}
			>
				Meet&Greet
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
						d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-8.4 8.4a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32l8.4-8.4z"
					/>
					<path
						d="M5.25 5.25a3 3 0 00-3 3v10.5a3 3 0 003 3h10.5a3 3 0 003-3V13.5a.75.75 0 00-1.5 0v5.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V8.25a1.5 1.5 0 011.5-1.5h5.25a.75.75 0 000-1.5H5.25z"
					/>
				</svg>
			</div>
			<button
				class="bg-gray2 text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer"
				on:click={openNotesModal}
			>
				Notes
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
{#if showFlightsModal}
	<div use:portal>
		<CalendarInfoSync
			bind:isOpen={showFlightsModal}
			{event}
			on:close={handleFlightsClose}
			on:save_success={handleModalSaveSuccess}
		/>
	</div>
{/if}
{#if showScheduleModal}
	<div use:portal>
		<CalendarSyncModal
			bind:isOpen={showScheduleModal}
			{event}
			on:close={handleScheduleClose}
			on:calendar_sync_success={handleCalendarSyncSuccess}
			on:save_success={handleModalSaveSuccess}
		/>
	</div>
{/if}
{#if showMeetGreetModal}
	<div use:portal>
		<AdvanceMeetGreetModal
			bind:isOpen={showMeetGreetModal}
			{event}
			on:close={handleMeetGreetClose}
			on:save_success={handleModalSaveSuccess}
		/>
	</div>
{/if}

{#if showNotesModal}
	<div use:portal>
		<NotesModal
			bind:isOpen={showNotesModal}
			{event}
			on:close={handleNotesClose}
			on:save_success={() => {
				handleModalSaveSuccess();
				handleNotesClose();
			}}
		/>
	</div>
{/if}