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
		updateEventEmailData,
		getEventSections
	} from '$lib/services/emailtechService';
	import {
		fetchCrewMembers,
		addCrewMember,
		removeCrewMember,
		updateEventCrew
	} from '$lib/services/crewService';
	import { techTemplateSections } from '$lib/services/techTemplateService';
	import { extractSectionsFromContent, mergeSectionContent } from '$lib/utils/sectionParser';
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
	let customSections: Record<string, string> = {};
	let isLoadingContent = false;

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

	async function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
		selectedEvents = event.detail;
		loadCrewAssignments();
		await loadEmailTemplate();
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

	async function loadEmailTemplate() {
		if (selectedEvents.length === 0) {
			emailContent = '';
			customSections = {};
			return;
		}

		isLoadingContent = true;
		const mainEvent = selectedEvents[0];

		const { sections: savedSections, customSections: savedCustom } = await getEventSections(
			mainEvent.event_id,
			templateType
		);

		customSections = savedCustom;

		const storedContent = templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail;

		if (storedContent && storedContent.trim() !== '' && storedContent !== '<p></p>' && storedContent !== '<p style="font-weight: 400;"></p>') {
			emailContent = storedContent;
		} else if (savedSections.length > 0) {
			emailContent = rebuildEmailContent(savedSections);
		} else {
			emailContent = '';
		}

		isLoadingContent = false;
	}

	function rebuildEmailContent(sectionsToInclude?: string[]): string {
		if (selectedEvents.length === 0) return '';

		if (templateType === 'vj') {
			return customSections['vj_header'] || `<h2>Visual Information - ${selectedEvents.map((e) => e.event_name).join(' & ')}</h2>`;
		}

		const sectionsToUse = sectionsToInclude || activeSections.filter(s => s.included).map(s => s.id);
		let contentParts: string[] = [];

		techTemplateSections.forEach((section) => {
			if (sectionsToUse.includes(section.id)) {
				const templateContent = section.generator(selectedEvents, crewAssignments);
				const sectionHtml = mergeSectionContent(templateContent, customSections[section.id], section.id);
				
				if (sectionHtml && sectionHtml.trim()) {
					contentParts.push(sectionHtml.trim());
				}
			}
		});

		return contentParts.join('<br/>');
	}

	function extractSectionContent(fullContent: string): Record<string, string> {
		const activeSectionIds = activeSections.filter(s => s.included).map(s => s.id);
		return extractSectionsFromContent(fullContent, activeSectionIds);
	}

	function handleSectionsChange(event: CustomEvent<any[]>) {
		activeSections = event.detail;
		
		if (isLoadingContent) return;
		
		// CRITICAL: Extract and save current edits BEFORE rebuilding
		if (emailContent && emailContent.trim()) {
			const currentCustom = extractSectionContent(emailContent);
			// Merge with existing, prioritizing current edits
			Object.keys(currentCustom).forEach(key => {
				if (currentCustom[key] && currentCustom[key].trim()) {
					customSections[key] = currentCustom[key];
				}
			});
		}
		
		const newContent = rebuildEmailContent();
		emailContent = newContent;
		
		setTimeout(() => {
			const editor = emailEditor?.getEditor();
			if (editor && !editor.isFocused) {
				editor.commands.setContent(newContent || '<p></p>');
			}
		}, 0);
		
		// Save immediately with custom sections
		saveCustomSections();
	}

	function handleResetSection(event: CustomEvent<{ sectionId: string }>) {
		const { sectionId } = event.detail;
		
		// Remove custom content for this section
		const newCustomSections = { ...customSections };
		delete newCustomSections[sectionId];
		customSections = newCustomSections;
		
		// Rebuild content with template default
		const newContent = rebuildEmailContent();
		emailContent = newContent;
		
		setTimeout(() => {
			const editor = emailEditor?.getEditor();
			if (editor && !editor.isFocused) {
				editor.commands.setContent(newContent || '<p></p>');
			}
		}, 0);
		
		saveCustomSections();
	}

	async function handleContentChange(event: CustomEvent<{ content: string }>) {
		emailContent = event.detail.content;
		
		eventChannel?.send({
			type: 'broadcast',
			event: 'content',
			payload: { content: emailContent }
		});
		
		// CRITICAL: Extract and save custom modifications immediately
		if (emailContent && emailContent.trim()) {
			const currentCustom = extractSectionContent(emailContent);
			// Update customSections with current edits
			Object.keys(currentCustom).forEach(key => {
				if (currentCustom[key] && currentCustom[key].trim()) {
					customSections[key] = currentCustom[key];
				}
			});
		}
		
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
		await loadEmailTemplate();
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
			
			await saveCustomSections();
		} catch (error) {
			console.error('Failed to save template:', error);
		} finally {
			setTimeout(() => (isSaving = false), 1000);
		}
	}

	async function saveCustomSections() {
		const firstSelected = selectedEvents[0];
		if (!firstSelected) return;

		const includedIds = activeSections.filter(s => s.included).map(s => s.id);
		
		// Save with custom sections
		await updateEventEmailData(
			firstSelected.event_id,
			templateType,
			includedIds,
			customSections
		);
		
		// Update local cache
		if (firstSelected.email_data) {
			firstSelected.email_data[`${templateType}_custom_sections`] = customSections;
		}
	}

	async function handleClearAll() {
		customSections = {};
		emailContent = '';
		
		const firstSelected = selectedEvents[0];
		if (firstSelected) {
			await updateEventEmailData(firstSelected.event_id, templateType, [], {});
			await updateEventEmail(firstSelected.event_id, templateType, '');
			
			if (templateType === 'tech') {
				firstSelected.tech_mail = '';
			} else {
				firstSelected.vj_mail = '';
			}
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

		const mainEvent = selectedEvents[0];
		if (mainEvent) {
			await updateEventCrew(mainEvent.event_id, crewAssignments);
			mainEvent.crew = crewAssignments;
		}

		const crewDependentSections = ['crew_call', 'vj_schedule', 'lights'];
		const needsUpdate = activeSections.some(
			(s) => s.included && crewDependentSections.includes(s.id)
		);

		if (needsUpdate) {
			// Only regenerate sections that don't have custom content
			crewDependentSections.forEach(sectionId => {
				if (!customSections[sectionId]) {
					const section = techTemplateSections.find(s => s.id === sectionId);
					if (section && activeSections.find(s => s.id === sectionId)?.included) {
						customSections[sectionId] = section.generator(selectedEvents, crewAssignments);
					}
				}
			});
			
			emailContent = rebuildEmailContent();
			
			setTimeout(() => {
				const editor = emailEditor?.getEditor();
				if (editor && !editor.isFocused) {
					editor.commands.setContent(emailContent || '<p></p>');
				}
			}, 0);
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
							{templateType}
							eventId={selectedEvents[0]?.event_id || null}
							on:sectionsChange={handleSectionsChange}
							on:resetSection={handleResetSection}
							on:clearAll={handleClearAll}
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