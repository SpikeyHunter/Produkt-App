<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';

	export let show = false;
	export let action: 'confirm' | 'cancel' = 'confirm';
	export let title = '';
	export let message = '';
	export let saving = false;
	export let isAdmin = false;
	export let defaultEmail = false;

	// Conflict props
	export let showConflicts = false;
	export let sameEventOtherRoomsCount = 0;
	export let otherEventsOnDayCount = 0;
	export let otherEventsSameRoomCount = 0; // NEW: Track holds in the exact same room

	const dispatch = createEventDispatcher();

	// --- DEFAULT NOTIFICATION STATES ---
	let globalDefaultEmail = true;
	let globalDefaultSms = true;

	let optSendEmail = defaultEmail;
	let optSendSms = false;
	let optConfirmAllRooms = false;
	let optClearOtherHolds = false;
	let optClearSameRoomHolds = false; // NEW: Checkbox state for same room
	let optConfirmAllDates = false;

	let emailUsersCount = 0;
	let smsUsersCount = 0;

	$: isConfirming = action === 'confirm';
	$: displayTitle = title || (isConfirming ? 'Confirm Event' : 'Cancel Event');
	$: displayMessage =
		message ||
		(isConfirming
			? 'Finalizing this date will auto-hide alternate holds for this event.'
			: 'Changing status to Hold will cancel this confirmed event globally.');

	// Reset state when modal opens
	$: if (show) {
		setupModal();
	}

	async function setupModal() {
		// 1. Fetch the absolute latest settings and user counts from the DB
		await Promise.all([fetchDefaults(), refreshUserCounts()]);

		// 2. Apply the fresh settings to the checkboxes
		optSendEmail = globalDefaultEmail; // Strictly uses the DB value
		optSendSms = globalDefaultSms; // Strictly uses the DB value

		// 3. Reset standard toggles
		optConfirmAllRooms = false;
		optClearOtherHolds = false;
		optClearSameRoomHolds = false;
		optConfirmAllDates = false; // NEW: Reset on open
	}

	async function refreshUserCounts() {
		try {
			const [{ count: eCount }, { count: sCount }] = await Promise.all([
				supabase
					.from('calendar_users')
					.select('*', { count: 'exact', head: true })
					.eq('confirmation_email', true),
				supabase
					.from('calendar_users')
					.select('*', { count: 'exact', head: true })
					.eq('confirmation_phone', true)
			]);
			emailUsersCount = eCount || 0;
			smsUsersCount = sCount || 0;
		} catch (err) {
			console.error('Failed to fetch user counts:', err);
		}
	}

	function handleConfirm() {
		dispatch('confirm', {
			sendEmail: optSendEmail,
			sendSms: optSendSms,
			confirmAllRooms: optConfirmAllRooms,
			clearOtherHolds: optClearOtherHolds,
			clearSameRoomHolds: optClearSameRoomHolds,
			confirmAllDates: optConfirmAllDates // NEW: Send to parent
		});
	}

	async function fetchDefaults() {
		try {
			const { data } = await supabase
				.from('calendar_settings')
				.select('setting_name, setting_params')
				.eq('setting_type', 'CONFIG')
				.in('setting_name', ['Default Email Confirmation', 'Default SMS Confirmation']);

			if (data) {
				const emailSetting = data.find((s) => s.setting_name === 'Default Email Confirmation');
				const smsSetting = data.find((s) => s.setting_name === 'Default SMS Confirmation');

				// Added the explicit "any" type here to fix the TS error
				const parseValue = (params: any) => {
					if (typeof params === 'string') {
						try {
							return JSON.parse(params).value;
						} catch {
							return true;
						}
					}
					return params?.value ?? true;
				};

				if (emailSetting?.setting_params) {
					globalDefaultEmail = parseValue(emailSetting.setting_params);
				}
				if (smsSetting?.setting_params) {
					globalDefaultSms = parseValue(smsSetting.setting_params);
				}
			}
		} catch (err) {
			console.error('Failed to load global notification defaults:', err);
		}
	}

	function handleCancel() {
		show = false;
		dispatch('cancel');
	}
</script>

{#if show}
	<div
		use:portal
		class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]"
		transition:fade={{ duration: 200, easing: cubicOut }}
	>
		<div
			class="bg-gray1 rounded-2xl max-w-md w-full relative shadow-2xl border border-gray2/20 flex flex-col p-8 text-center max-h-[90vh] overflow-hidden"
			transition:fly={{ y: 20, duration: 250, easing: cubicOut }}
		>
			<div
				class="w-12 h-12 rounded-full {isConfirming
					? 'bg-lime/20 text-lime'
					: 'bg-problem/20 text-problem'} flex items-center justify-center mx-auto mb-4 shrink-0"
			>
				{#if isConfirming}
					<span class="font-black text-2xl">✓</span>
				{:else}
					<svg
						class="w-6 h-6"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				{/if}
			</div>

			<h3 class="text-xl font-black text-white mb-2">{displayTitle}</h3>
			<p class="text-[11px] font-bold text-gray2 mb-6">{displayMessage}</p>

			<div class="space-y-3 mb-8 text-left overflow-y-auto custom-scrollbar pr-2">
				{#if showConflicts && isConfirming}
					{#if sameEventOtherRoomsCount > 0}
						<label
							class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optConfirmAllRooms
								? 'border-confirmed bg-confirmed/5'
								: ''}"
						>
							<div
								class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optConfirmAllRooms
									? 'bg-confirmed border-confirmed'
									: 'border-2 border-confirmed bg-transparent'}"
							>
								{#if optConfirmAllRooms}<svg
										class="w-3.5 h-3.5 text-black"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
									>{/if}
							</div>
							<p class="text-sm font-bold text-confirmed leading-tight">
								Confirm all holds for the same venue for this event
							</p>
							<input type="checkbox" class="hidden" bind:checked={optConfirmAllRooms} />
						</label>
					{/if}

					<label
						class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optConfirmAllDates
							? 'border-confirmed bg-confirmed/5'
							: ''}"
					>
						<div
							class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optConfirmAllDates
								? 'bg-confirmed border-confirmed'
								: 'border-2 border-confirmed bg-transparent'}"
						>
							{#if optConfirmAllDates}<svg
									class="w-3.5 h-3.5 text-black"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
								>{/if}
						</div>
						<p class="text-sm font-bold text-confirmed leading-tight">
							Confirm all holds for all dates for this event
						</p>
						<input type="checkbox" class="hidden" bind:checked={optConfirmAllDates} />
					</label>

					{#if otherEventsSameRoomCount > 0}
						<label
							class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optClearSameRoomHolds
								? 'border-problem/50 bg-problem/5'
								: ''}"
						>
							<div
								class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optClearSameRoomHolds
									? 'bg-problem border-problem'
									: 'border-2 border-problem bg-transparent'}"
							>
								{#if optClearSameRoomHolds}<svg
										class="w-3.5 h-3.5 text-black"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
									>{/if}
							</div>
							<p class="text-sm font-bold text-problem leading-tight">
								Clear all holds on this date (for the same room)
							</p>
							<input
								type="checkbox"
								class="hidden"
								bind:checked={optClearSameRoomHolds}
								on:change={() => {
									if (optClearSameRoomHolds) optClearOtherHolds = false;
								}}
							/>
						</label>
					{/if}

					{#if otherEventsOnDayCount > otherEventsSameRoomCount}
						<label
							class="flex items-start gap-3 p-4 bg-gray1/50 border border-gray2/20 rounded-xl cursor-pointer hover:bg-gray2/10 transition-colors {optClearOtherHolds
								? 'border-problem/50 bg-problem/5'
								: ''}"
						>
							<div
								class="relative flex items-center justify-center w-5 h-5 mt-0.5 rounded transition-all {optClearOtherHolds
									? 'bg-problem border-problem'
									: 'border-2 border-problem bg-transparent'}"
							>
								{#if optClearOtherHolds}<svg
										class="w-3.5 h-3.5 text-black"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="4"><polyline points="20 6 9 17 4 12"></polyline></svg
									>{/if}
							</div>
							<p class="text-sm font-bold text-problem leading-tight">
								Clear all holds on this date (for all venues/rooms)
							</p>
							<input
								type="checkbox"
								class="hidden"
								bind:checked={optClearOtherHolds}
								on:change={() => {
									if (optClearOtherHolds) optClearSameRoomHolds = false;
								}}
							/>
						</label>
					{/if}

					{#if sameEventOtherRoomsCount === 0 && otherEventsOnDayCount === 0}
						<div class="py-4 text-center border border-gray2/20 rounded-xl bg-gray1/50">
							<p class="text-sm font-bold text-gray2">
								No scheduling conflicts detected for this date!
							</p>
						</div>
					{/if}

					<div class="my-4 border-t border-gray2/20"></div>
				{/if}

				<p class="text-sm font-bold text-gray2 mb-2">
					Share {isConfirming ? 'confirmation' : 'cancellation'}
				</p>

				<div
					class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendEmail
						? isConfirming
							? 'border-lime bg-lime/5'
							: 'border-problem bg-problem/5'
						: 'border-gray2/20 hover:bg-gray2/10'}"
					on:click={() => (optSendEmail = !optSendEmail)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (optSendEmail = !optSendEmail)}
					role="button"
					tabindex="0"
					aria-label="Toggle Email"
				>
					<div
						class="mt-0.5 transition-colors {optSendEmail
							? isConfirming
								? 'text-lime'
								: 'text-problem'
							: 'text-gray2'}"
					>
						<svg
							class="w-5 h-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
							></path><polyline points="22,6 12,13 2,6"></polyline></svg
						>
					</div>
					<div class="flex-1">
						<p class="text-sm font-bold text-white leading-tight">
							Send Email {isConfirming ? 'confirmation' : 'cancellation'} to
							<span class={isConfirming ? 'text-lime' : 'text-problem'}>{emailUsersCount}</span>
							user{emailUsersCount !== 1 ? 's' : ''}
						</p>
					</div>
					{#if isAdmin}
						<button
							type="button"
							class="text-xs {isConfirming
								? 'text-lime'
								: 'text-problem'} font-bold hover:underline cursor-pointer"
							on:click|stopPropagation={() => dispatch('viewContacts')}>(view list)</button
						>
					{/if}
				</div>

				<div
					class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendSms
						? isConfirming
							? 'border-lime bg-lime/5'
							: 'border-problem bg-problem/5'
						: 'border-gray2/20 hover:bg-gray2/10'}"
					on:click={() => (optSendSms = !optSendSms)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (optSendSms = !optSendSms)}
					role="button"
					tabindex="0"
					aria-label="Toggle SMS"
				>
					<div
						class="mt-0.5 transition-colors {optSendSms
							? isConfirming
								? 'text-lime'
								: 'text-problem'
							: 'text-gray2'}"
					>
						<svg
							class="w-5 h-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg
						>
					</div>
					<div class="flex-1">
						<p class="text-sm font-bold text-white leading-tight">
							Send SMS {isConfirming ? 'confirmation' : 'cancellation'} to
							<span class={isConfirming ? 'text-lime' : 'text-problem'}>{smsUsersCount}</span>
							user{smsUsersCount !== 1 ? 's' : ''}
						</p>
					</div>
					{#if isAdmin}
						<button
							type="button"
							class="text-xs {isConfirming
								? 'text-lime'
								: 'text-problem'} font-bold hover:underline cursor-pointer"
							on:click|stopPropagation={() => dispatch('viewContacts')}>(view list)</button
						>
					{/if}
				</div>
			</div>

			<div class="mt-auto flex gap-3 w-full shrink-0">
				<button
					class="flex-1 py-3 bg-transparent border border-gray2/20 text-gray2 font-bold rounded-2xl hover:bg-gray2/10 hover:text-white transition-colors cursor-pointer"
					on:click={handleCancel}
					disabled={saving}>Cancel</button
				>
				<button
					class="flex-[1.5] py-3 text-black font-bold rounded-2xl hover:bg-lime/90 hover:cursor-pointer transition-colors flex justify-center items-center {isConfirming
						? 'bg-lime hover:bg-lime/90'
						: 'bg-problem hover:bg-problem/90'}"
					on:click={handleConfirm}
					disabled={saving}
				>
					{#if saving}<div
							class="w-4 h-4 border-2 border-black/20 border-t-black hover:cursor-pointer rounded-full animate-spin mr-2"
						></div>{/if}
					{isConfirming ? 'Confirm Event' : 'Cancel Event'}
				</button>
			</div>
		</div>
	</div>
{/if}
