<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import MainLayout from '$lib/components/MainLayout.svelte';
	import EventSelector from '$lib/components/production/emailtech/EventSelector.svelte';
	import DataPanel from '$lib/components/production/emailtech/DataPanel.svelte';
	import EmailEditor from '$lib/components/production/emailtech/EmailEditor.svelte';
	import ActionPanel from '$lib/components/production/emailtech/ActionPanel.svelte';
	import CrewManager from '$lib/components/production/emailtech/CrewManager.svelte';
	import {
		fetchEmailTechEvents,
		updateEventEmail,
		joinEventChannel,
		getAuthenticatedUser,
		updateEventEmailData
	} from '$lib/services/emailtechService';
	import {
		fetchCrewMembers,
		addCrewMember,
		removeCrewMember,
		updateEventCrew
	} from '$lib/services/crewService';
	import { techTemplateSections } from '$lib/services/techTemplateService';
	import type {
		EmailTechEvent,
		CrewMember,
		CrewAssignments,
		CrewRole,
		CurrentUser,
		PresenceInfo
	} from '$lib/types/emailtech';
	import type { RealtimeChannel } from '@supabase/supabase-js';
	import { writable, type Writable } from 'svelte/store';

	let loading = true;
	let isSaving = false;
	let autoSaveTimeout: NodeJS.Timeout;
	let templateType: 'tech' | 'vj' = 'tech';

	let events: EmailTechEvent[] = [];
	let selectedEvents: EmailTechEvent[] = [];
	let crewMembers: CrewMember[] = [];
	let crewAssignments: CrewAssignments = {};

	let currentUser: CurrentUser;
	let emailContent = '';
	let emailEditor: any;
	let eventChannel: RealtimeChannel | null = null;
	let presenceState: Writable<Record<string, PresenceInfo[]>> = writable({});
	let remoteBroadcasts: Writable<any> = writable(null);

	let activeSections: Array<{ id: string; label: string; included: boolean }> = [];

	onMount(async () => {
		currentUser = await getAuthenticatedUser();
		await loadInitialData();
	});

	onDestroy(() => {
		eventChannel?.unsubscribe();
		clearTimeout(autoSaveTimeout);
	});

	async function loadInitialData() {
		loading = true;
		try {
			[events, crewMembers] = await Promise.all([fetchEmailTechEvents(), fetchCrewMembers()]);
		} catch (error) {
			console.error('Failed to load data:', error);
		} finally {
			loading = false;
		}
	}

	function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
		selectedEvents = event.detail;
		loadCrewAssignments();
		loadEmailTemplate();
		setupRealtimeChannel();
	}

	function loadCrewAssignments() {
		if (selectedEvents.length === 0) {
			crewAssignments = {};
			return;
		}
		const mainEvent = selectedEvents[0];
		crewAssignments = mainEvent.crew || {};
	}

	async function setupRealtimeChannel() {
		eventChannel?.unsubscribe();
		presenceState.set({});

		const mainEvent = selectedEvents[0];
		if (!mainEvent) return;

		const channelName = `event-${mainEvent.event_id}-${templateType}`;

		eventChannel = joinEventChannel(channelName, currentUser, {
			onPresenceChange: (newState) => presenceState.set(newState),
			onBroadcast: (event) => remoteBroadcasts.set(event)
		});
	}

	function loadEmailTemplate() {
		if (selectedEvents.length === 0) {
			emailContent = '';
			return;
		}
		const mainEvent = selectedEvents[0];
		const storedContent = templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail;

		if (storedContent) {
			emailContent = storedContent;
		} else {
			emailContent = rebuildEmailContent();
		}
	}

	function rebuildEmailContent(): string {
		if (selectedEvents.length === 0) return '';

		if (templateType === 'vj') {
			return `<h2>Visual Information - ${selectedEvents.map((e) => e.event_name).join(' & ')}</h2>`;
		}

		let finalContent = '';

		techTemplateSections.forEach((section) => {
			const activeSection = activeSections.find((s) => s.id === section.id);
			if (activeSection?.included) {
				const sectionHtml = section.generator(selectedEvents, crewAssignments);
				if (sectionHtml) {
					finalContent += sectionHtml + '<br/>';
				}
			}
		});

		return finalContent;
	}

	function handleSectionsChange(event: CustomEvent<any[]>) {
		activeSections = event.detail;
		emailContent = rebuildEmailContent();
	}

	function handleContentChange(event: CustomEvent<{ content: string }>) {
		emailContent = event.detail.content;
		eventChannel?.send({
			type: 'broadcast',
			event: 'content',
			payload: { content: emailContent }
		});
		clearTimeout(autoSaveTimeout);
		autoSaveTimeout = setTimeout(handleSaveTemplate, 1500);
	}

	function handleCursorChange(event: CustomEvent<{ start: number; end: number }>) {
		eventChannel?.send({
			type: 'broadcast',
			event: 'cursor',
			payload: { user: currentUser, cursor: event.detail }
		});
	}

	async function handleTemplateToggle() {
		await handleSaveTemplate();
		templateType = templateType === 'tech' ? 'vj' : 'tech';
		loadEmailTemplate();
		setupRealtimeChannel();
	}

	async function handleSaveTemplate() {
		const firstSelected = selectedEvents[0];
		if (!firstSelected) return;

		isSaving = true;
		try {
			const success = await updateEventEmail(
				firstSelected.event_id,
				templateType,
				emailContent || ''
			);
			if (success) {
				if (templateType === 'tech') {
					firstSelected.tech_mail = emailContent;
				} else {
					firstSelected.vj_mail = emailContent;
				}
			}
		} catch (error) {
			console.error('Failed to save template:', error);
		} finally {
			setTimeout(() => (isSaving = false), 1000);
		}
	}

	async function handleCrewAssignment(
		event: CustomEvent<{ role: string; crewMember: CrewMember | null }>
	) {
		const { role, crewMember } = event.detail;

		if (crewMember) {
			crewAssignments = { ...crewAssignments, [role as CrewRole]: crewMember.name };
		} else {
			const newAssignments = { ...crewAssignments };
			delete newAssignments[role as CrewRole];
			crewAssignments = newAssignments;
		}

		// Save to database
		const mainEvent = selectedEvents[0];
		if (mainEvent) {
			await updateEventCrew(mainEvent.event_id, crewAssignments);
			mainEvent.crew = crewAssignments;
		}

		// Rebuild template if sections using crew are active
		if (
			activeSections.some(
				(s) => s.included && ['crew_call', 'vj_schedule', 'lights'].includes(s.id)
			)
		) {
			emailContent = rebuildEmailContent();
		}
	}

	async function handleAddCrew(event: CustomEvent<{ name: string; email?: string }>) {
		const { name, email } = event.detail;
		const newMember = await addCrewMember(name, email);
		if (newMember) {
			crewMembers = [...crewMembers, newMember];
		}
	}

	async function handleRemoveCrew(event: CustomEvent<CrewMember>) {
		const member = event.detail;
		const success = await removeCrewMember(member.id);
		if (success) {
			crewMembers = crewMembers.filter((m) => m.id !== member.id);

			// Remove from assignments if present
			const updatedAssignments = { ...crewAssignments };
			let changed = false;
			Object.entries(updatedAssignments).forEach(([role, name]) => {
				if (name === member.name) {
					delete updatedAssignments[role as CrewRole];
					changed = true;
				}
			});

			if (changed) {
				crewAssignments = updatedAssignments;
				const mainEvent = selectedEvents[0];
				if (mainEvent) {
					await updateEventCrew(mainEvent.event_id, crewAssignments);
					mainEvent.crew = crewAssignments;
				}
			}
		}
	}
</script>

<svelte:head>
	<title>Email Tech</title>
</svelte:head>

<MainLayout pageTitle="Email Tech">
	<div class="h-full flex flex-col p-6 w-full mx-auto overflow-hidden">
		<div
			class="flex-1 grid grid-cols-[minmax(280px,320px)_minmax(0,1fr)_minmax(280px,320px)] gap-5 min-w-[1200px] overflow-hidden"
		>
			<!-- Left Panel: Event Selection & Template Sections -->
			<div class="flex flex-col gap-5 relative overflow-hidden">
				<div class="flex-1 overflow-y-auto scrollbar-lime">
					<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl">
						<div class="p-3 flex-shrink-0">
							<EventSelector {events} bind:selectedEvents {loading} on:select={handleEventSelect} />
						</div>
						<DataPanel
							events={selectedEvents}
							{crewAssignments}
							{templateType}
							eventId={selectedEvents[0]?.event_id || null}
							on:sectionsChange={handleSectionsChange}
						/>
					</div>
				</div>
			</div>

			<!-- Center Panel: Email Editor -->
			<div class="flex flex-col gap-5 min-w-0 overflow-hidden">
				<div class="flex items-center justify-between gap-4 flex-shrink-0 h-[52px]">
					<button
						type="button"
						on:click={handleTemplateToggle}
						disabled={selectedEvents.length === 0}
						class="flex items-center gap-2.5 bg-transparent text-lime border-2 border-lime rounded-lg px-4 py-2.5 text-sm font-bold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-navbar disabled:text-gray2 disabled:border-gray2 hover:bg-lime hover:text-black"
					>
						{#if templateType === 'tech'}
							<div class="flex items-center gap-2.5">
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><path
										d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
									/></svg
								>
								<span>Tech Mail</span>
							</div>
						{:else}
							<div class="flex items-center gap-2.5">
								<svg
									class="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									><path
										d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
									></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line
										x1="12"
										y1="22.08"
										x2="12"
										y2="12"
									></line></svg
								>
								<span>VJ Mail</span>
							</div>
						{/if}
					</button>
					<div class="flex items-center gap-2 text-xs text-gray2 pr-4">
						{#if isSaving}
							<span class="text-lime animate-pulse">Saving...</span>
						{:else if selectedEvents.length > 0}
							<span class="text-gray-400">Saved</span>
						{/if}
					</div>
				</div>
				<div class="flex-1 overflow-hidden">
					<EmailEditor
						bind:this={emailEditor}
						bind:content={emailContent}
						editable={selectedEvents.length > 0}
						{currentUser}
						{templateType}
						eventName={selectedEvents[0]?.event_name || ''}
						eventDate={selectedEvents[0]?.event_date || ''}
						presenceState={$presenceState}
						remoteBroadcast={$remoteBroadcasts}
						on:change={handleContentChange}
						on:cursorChange={handleCursorChange}
					/>
				</div>
			</div>

			<!-- Right Panel: Action Panel & Crew Manager -->
			<div class="flex flex-col gap-5 overflow-hidden">
				<div class="h-[190px] flex-shrink-0">
					<ActionPanel {emailContent} selectedRecipients={[]} on:save={handleSaveTemplate} />
				</div>
				<div class="flex-1 overflow-hidden">
					<CrewManager
						{crewMembers}
						assignments={crewAssignments}
						on:assign={handleCrewAssignment}
						on:add={handleAddCrew}
						on:remove={handleRemoveCrew}
					/>
				</div>
			</div>
		</div>
	</div>
</MainLayout>

<style>
	:global(.scrollbar-lime::-webkit-scrollbar) {
		width: 8px;
	}
	:global(.scrollbar-lime::-webkit-scrollbar-track) {
		background: #1a1a1a;
		border-radius: 4px;
	}
	:global(.scrollbar-lime::-webkit-scrollbar-thumb) {
		background: #e1ff00;
		border-radius: 4px;
	}
	:global(.scrollbar-lime::-webkit-scrollbar-thumb:hover) {
		background: #f0ff4d;
	}
	:global(.scrollbar-lime) {
		scrollbar-width: thin;
		scrollbar-color: #e1ff00 #1a1a1a;
	}
</style>
