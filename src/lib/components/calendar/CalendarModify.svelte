<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import { portal } from '$lib/utils/portalUtils';

	export let show = false;
	export let title = 'Modify Event';
	export let message =
		'Please confirm the changes to this event. Notifications will be sent to opted-in users.';
	export let saving = false;
	export let isAdmin = false;
	export let defaultEmail = false;

	// Modification specific props
	export let oldDates: string[] = [];
	export let newDates: string[] = [];
	export let oldType: string = '';
	export let newType: string = '';

	const dispatch = createEventDispatcher();

	let globalDefaultEmail = true;
	let globalDefaultSms = true;

	let optSendEmail = defaultEmail;
	let optSendSms = false;

	let emailUsersCount = 0;
	let smsUsersCount = 0;

	// Compute differences
	$: hasDateChange = JSON.stringify([...oldDates].sort()) !== JSON.stringify([...newDates].sort());
	$: hasTypeChange = oldType !== newType && oldType !== '' && newType !== '';

	// Reset state when modal opens
	$: if (show) {
		setupModal();
	}

	async function setupModal() {
		await refreshUserCounts();
		optSendEmail = false;
		optSendSms = false;
	}

	async function refreshUserCounts() {
		try {
			const { data, error } = await supabase
				.from('calendar_users')
				.select('confirmation_email, confirmation_phone, confirmation_exempt');

			if (error) throw error;

			let eCount = 0;
			let sCount = 0;

			// Evaluate against the modified event's new type
			const typeToEvaluate = newType || oldType;
			const exemptAllowedTypes = ['NCG Show', 'NCG 360', 'DSTRKT', 'Tour Prod'];
			const isAllowedType = exemptAllowedTypes.includes(typeToEvaluate);

			if (data) {
				data.forEach((user) => {
					if (user.confirmation_exempt && !isAllowedType) return;

					if (user.confirmation_email) eCount++;
					if (user.confirmation_phone) sCount++;
				});

				emailUsersCount = eCount;
				smsUsersCount = sCount;
			}
		} catch (err) {
			console.error('Failed to fetch user counts:', err);
		}
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

				if (emailSetting?.setting_params)
					globalDefaultEmail = parseValue(emailSetting.setting_params);
				if (smsSetting?.setting_params) globalDefaultSms = parseValue(smsSetting.setting_params);
			}
		} catch (err) {
			console.error('Failed to load global notification defaults:', err);
		}
	}

	function handleConfirm() {
		dispatch('confirm', {
			sendEmail: optSendEmail,
			sendSms: optSendSms,
			oldDates,
			newDates,
			oldType,
			newType
		});
	}

	function handleCancel() {
		show = false;
		dispatch('cancel');
	}

	function formatDateString(dates: string[]) {
		if (!dates || dates.length === 0) return 'TBD';
		const sorted = [...dates].sort();
		if (sorted.length === 1) {
			return new Date(sorted[0] + 'T00:00:00').toLocaleDateString('en-US', {
				month: 'short',
				day: 'numeric',
				year: 'numeric'
			});
		}
		const first = new Date(sorted[0] + 'T00:00:00');
		const last = new Date(sorted[sorted.length - 1] + 'T00:00:00');
		return `${first.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
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
				class="w-12 h-12 rounded-full bg-question/20 text-question flex items-center justify-center mx-auto mb-4 shrink-0"
			>
				<svg
					class="w-6 h-6"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
				</svg>
			</div>

			<h3 class="text-xl font-black text-white mb-2">{title}</h3>
			<p class="text-[11px] font-bold text-gray2 mb-6">{message}</p>

			<div class="space-y-3 mb-8 text-left overflow-y-auto custom-scrollbar pr-2">
				{#if hasDateChange || hasTypeChange}
					<div class="p-4 bg-gray1/50 border border-gray2/20 rounded-xl space-y-3">
						<p class="text-sm font-bold text-white border-b border-gray2/20 pb-2">
							Detected Changes:
						</p>

						{#if hasDateChange}
							<div>
								<p class="text-[11px] font-bold text-gray2 uppercase tracking-wider">
									Date Changed
								</p>
								<div class="flex items-center gap-2 mt-1">
									<span class="text-sm font-medium text-problem line-through"
										>{formatDateString(oldDates)}</span
									>
									<svg
										class="w-4 h-4 text-gray2"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg
									>
									<span class="text-sm font-bold text-lime">{formatDateString(newDates)}</span>
								</div>
							</div>
						{/if}

						{#if hasTypeChange}
							<div>
								<p class="text-[11px] font-bold text-gray2 uppercase tracking-wider">
									Type Changed
								</p>
								<div class="flex items-center gap-2 mt-1">
									<span class="text-sm font-medium text-problem line-through">{oldType}</span>
									<svg
										class="w-4 h-4 text-gray2"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg
									>
									<span class="text-sm font-bold text-lime">{newType}</span>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<div class="p-4 bg-gray1/50 border border-gray2/20 rounded-xl text-center">
						<p class="text-sm font-bold text-gray2">
							No significant dates or type changes detected.
						</p>
					</div>
				{/if}

				<div class="my-4 border-t border-gray2/20"></div>

				<p class="text-sm font-bold text-gray2 mb-2">Share Modification</p>

				<div
					class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendEmail
						? 'border-question bg-question/5'
						: 'border-gray2/20 hover:bg-gray2/10'}"
					on:click={() => (optSendEmail = !optSendEmail)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (optSendEmail = !optSendEmail)}
					role="button"
					tabindex="0"
				>
					<div class="mt-0.5 transition-colors {optSendEmail ? 'text-question' : 'text-gray2'}">
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
							Send Email notification to <span class="text-question">{emailUsersCount}</span>
							user{emailUsersCount !== 1 ? 's' : ''}
						</p>
					</div>
					{#if isAdmin}
						<button
							type="button"
							class="text-xs text-question font-bold hover:underline cursor-pointer"
							on:click|stopPropagation={() => dispatch('viewContacts')}>(view list)</button
						>
					{/if}
				</div>

				<div
					class="flex items-start gap-3 p-3 bg-gray1/50 border rounded-xl cursor-pointer transition-colors {optSendSms
						? 'border-question bg-question/5'
						: 'border-gray2/20 hover:bg-gray2/10'}"
					on:click={() => (optSendSms = !optSendSms)}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (optSendSms = !optSendSms)}
					role="button"
					tabindex="0"
				>
					<div class="mt-0.5 transition-colors {optSendSms ? 'text-question' : 'text-gray2'}">
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
							Send SMS notification to <span class="text-question">{smsUsersCount}</span>
							user{smsUsersCount !== 1 ? 's' : ''}
						</p>
					</div>
					{#if isAdmin}
						<button
							type="button"
							class="text-xs text-question font-bold hover:underline cursor-pointer"
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
					class="flex-[1.5] py-3 text-black/60 hover:text-black font-bold rounded-2xl bg-question hover:bg-question transition-colors flex justify-center items-center cursor-pointer"
					on:click={handleConfirm}
					disabled={saving}
				>
					{#if saving}
						<div
							class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"
						></div>
					{/if}
					{optSendEmail || optSendSms ? 'Save & Notify' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}
