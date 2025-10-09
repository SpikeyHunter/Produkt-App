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
	import { supabase } from '$lib/supabase';

	let loading = true;
	let isSaving = false;
	let autoSaveTimeout: NodeJS.Timeout;
	let templateType: 'tech' | 'vj' = 'tech';
	let crewChangeCheckInterval: NodeJS.Timeout;

	let events: EmailTechEvent[] = [];
	let selectedEvents: EmailTechEvent[] = [];
	let crewMembers: CrewMember[] = [];
	let crewAssignments: CrewAssignments = {};
	let lastKnownCrewState: string = '';

	let currentUser: CurrentUser;
	let emailContent = '';
	let emailEditor: any;
	let eventChannel: RealtimeChannel | null = null;
	let presenceState: Writable<Record<string, PresenceInfo[]>> = writable({});
	let remoteBroadcasts: Writable<any> = writable(null);

	let activeSections: Array<{ id: string; label: string; included: boolean }> = [];
	let customSections: Record<string, string> = {};
	let hiddenSections: Record<string, string> = {};
	let isLoadingContent = false;

	$: isNCGEventSelected = selectedEvents.some((e) => e.event_venue === 'New City Gas');

	onMount(async () => {
		currentUser = await getAuthenticatedUser();
		await loadInitialData();
		startCrewChangePolling();
	});

	onDestroy(() => {
		eventChannel?.unsubscribe();
		clearTimeout(autoSaveTimeout);
		clearInterval(crewChangeCheckInterval);
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

	// NEW: Poll for crew changes every 2 seconds
	function startCrewChangePolling() {
		crewChangeCheckInterval = setInterval(async () => {
			if (selectedEvents.length > 0) {
				await checkForCrewChanges();
			}
		}, 2000);
	}

	// NEW: Check if crew has changed in the database
	async function checkForCrewChanges() {
		const mainEvent = selectedEvents[0];
		if (!mainEvent) return;

		try {
			const { data, error } = await supabase
				.from('events')
				.select('crew')
				.eq('event_id', mainEvent.event_id)
				.single();

			if (error) throw error;

			const currentCrewJson = JSON.stringify(data?.crew || {});
			
			// Compare with last known state
			if (lastKnownCrewState && lastKnownCrewState !== currentCrewJson) {
				console.log('🔄 Crew change detected!');
				
				// Update local state
				crewAssignments = convertDbCrewToState(data.crew);
				mainEvent.crew = data.crew;
				lastKnownCrewState = currentCrewJson;
				
				// Regenerate crew_call section with comparison
				await regenerateCrewCallSection();
			} else if (!lastKnownCrewState) {
				// Initialize tracking
				lastKnownCrewState = currentCrewJson;
			}
		} catch (error) {
			console.error('Error checking crew changes:', error);
		}
	}

	// NEW: Regenerate only the crew_call section
	async function regenerateCrewCallSection() {
		if (!emailContent || selectedEvents.length === 0) return;

		const crewCallSection = techTemplateSections.find(s => s.id === 'crew_call');
		if (!crewCallSection) return;

		// Generate new crew_call content with stored HTML for comparison
		const mainEvent = selectedEvents[0];
		const storedHtml = templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail;
		
		const newCrewCallContent = crewCallSection.generator(
			selectedEvents,
			crewAssignments,
			crewMembers,
			storedHtml || undefined
		);

		// Replace the crew_call section in the email content
		const crewCallRegex = /<div[^>]*data-section="crew_call"[^>]*>[\s\S]*?<\/div>/i;
		const wrappedNewContent = `<div data-section="crew_call">${newCrewCallContent}</div>`;

		if (crewCallRegex.test(emailContent)) {
			emailContent = emailContent.replace(crewCallRegex, wrappedNewContent);
		} else {
			// If crew_call doesn't exist, insert it after header
			const headerRegex = /(<div[^>]*data-section="header"[^>]*>[\s\S]*?<\/div>)/i;
			emailContent = emailContent.replace(headerRegex, `$1${wrappedNewContent}`);
		}

		// Update the editor
		setTimeout(() => {
			const editor = emailEditor?.getEditor();
			if (editor && !editor.isFocused) {
				editor.commands.setContent(emailContent || '<p></p>');
			}
		}, 0);

		// Save the updated content
		clearTimeout(autoSaveTimeout);
		autoSaveTimeout = setTimeout(handleSaveTemplate, 500);
	}

	async function handleEventSelect(event: CustomEvent<EmailTechEvent[]>) {
		selectedEvents = event.detail;
		if (templateType === 'vj' && !isNCGEventSelected) {
			templateType = 'tech';
		}

		loadCrewAssignments();
		await loadEmailTemplate();
		setupRealtimeChannel();
	}

	function convertDbCrewToState(crew: any): CrewAssignments {
		if (!crew) return {};
		const newAssignments: CrewAssignments = {};
		for (const role in crew) {
			const value = crew[role as keyof typeof crew];
			if (typeof value === 'string' && value.trim() !== '') {
				newAssignments[role as keyof CrewAssignments] = [value];
			} else if (Array.isArray(value)) {
				newAssignments[role as keyof CrewAssignments] = value;
			}
		}
		return newAssignments;
	}

	function loadCrewAssignments() {
		if (selectedEvents.length === 0) {
			crewAssignments = {};
			lastKnownCrewState = '';
			return;
		}
		const mainEvent = selectedEvents[0];
		crewAssignments = convertDbCrewToState(mainEvent.crew);
		lastKnownCrewState = JSON.stringify(mainEvent.crew || {});
	}

	function generateSectionContent(sectionId: string, useStoredHtml: boolean = false): string {
		const section = techTemplateSections.find((s) => s.id === sectionId);
		if (!section) return '';
		
		const mainEvent = selectedEvents[0];
		const storedHtml = useStoredHtml && mainEvent 
			? (templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail)
			: undefined;

		// Convert null to undefined to satisfy TypeScript
		const htmlToPass = storedHtml === null ? undefined : storedHtml;

		if (section.id === 'crew_call') {
			return section.generator(selectedEvents, crewAssignments, crewMembers, htmlToPass);
		}
		return section.generator(selectedEvents, crewAssignments, crewMembers, htmlToPass);
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
			hiddenSections = {};
			return;
		}

		isLoadingContent = true;
		const mainEvent = selectedEvents[0];

		const { sections: savedSections, customSections: savedCustom } = await getEventSections(
			mainEvent.event_id,
			templateType
		);

		customSections = savedCustom;
		hiddenSections = {};

		const storedContent = templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail;

		if (
			storedContent &&
			storedContent.trim() !== '' &&
			storedContent !== '<p></p>' &&
			storedContent !== '<p style="font-weight: 400;"></p>'
		) {
			emailContent = storedContent;

			const allSectionIds = techTemplateSections.map((s) => s.id);
			allSectionIds.forEach((sectionId) => {
				if (!savedSections.includes(sectionId)) {
					const regex = new RegExp(
						`<div[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)<\\/div>`,
						'i'
					);
					const match = emailContent.match(regex);
					if (match && match[0]) {
						hiddenSections[sectionId] = match[0];
						emailContent = emailContent
							.replace(match[0], '')
							.replace(/<br\/>\s*<br\/>/g, '<br/>')
							.trim();
					}
				}
			});

			// Check for crew mismatches on load
			await checkForCrewChanges();
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
			return (
				customSections['vj_header'] ||
				`<h2>Visual Information - ${selectedEvents.map((e) => e.event_name).join(' & ')}</h2>`
			);
		}

		const sectionsToUse =
			sectionsToInclude || activeSections.filter((s) => s.included).map((s) => s.id);

		let contentParts: string[] = [];
		techTemplateSections.forEach((section) => {
			if (sectionsToUse.includes(section.id)) {
				// Pass stored HTML for crew_call comparison
				const templateContent = generateSectionContent(section.id, true);
				const sectionHtml = mergeSectionContent(
					templateContent,
					customSections[section.id],
					section.id,
					true
				);
				if (sectionHtml?.trim()) {
					contentParts.push(sectionHtml.trim());
				}
			}
		});
		return contentParts.join('');
	}

	function extractSectionContent(fullContent: string): Record<string, string> {
		const activeSectionIds = activeSections.filter((s) => s.included).map((s) => s.id);
		return extractSectionsFromContent(fullContent, activeSectionIds);
	}

	function hideSection(sectionId: string) {
		if (!emailContent) return;

		const regex = new RegExp(`<div[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
		const match = emailContent.match(regex);

		if (match && match[0]) {
			hiddenSections[sectionId] = match[0];

			let newContent = emailContent.replace(match[0], '');

			newContent = newContent
				.replace(/(<\/div>)\s*(<div)/g, '$1$2')
				.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '')
				.replace(/^\s+|\s+$/g, '')
				.trim();

			emailContent = newContent;
		}

		hiddenSections = { ...hiddenSections };
	}

	function restoreSection(sectionId: string) {
		let contentToInsert = '';

		if (hiddenSections[sectionId]) {
			contentToInsert = hiddenSections[sectionId];
			delete hiddenSections[sectionId];
		} else {
			const section = techTemplateSections.find((s) => s.id === sectionId);
			if (!section) return;

			const templateContent = generateSectionContent(sectionId, true);
			contentToInsert = mergeSectionContent(
				templateContent,
				customSections[sectionId],
				sectionId,
				true
			);
		}

		if (!contentToInsert) return;

		const sectionOrder = techTemplateSections.map((s) => s.id);
		const targetIndex = sectionOrder.indexOf(sectionId);

		let insertAfterSectionId = '';
		for (let i = targetIndex - 1; i >= 0; i--) {
			const prevSectionId = sectionOrder[i];
			if (emailContent.includes(`data-section="${prevSectionId}"`)) {
				insertAfterSectionId = prevSectionId;
				break;
			}
		}

		if (insertAfterSectionId) {
			const regex = new RegExp(
				`(<div[^>]*data-section="${insertAfterSectionId}"[^>]*>[\\s\\S]*?<\\/div>)`,
				'i'
			);
			emailContent = emailContent.replace(regex, `$1${contentToInsert}`);
		} else {
			if (emailContent && emailContent.trim()) {
				emailContent = `${contentToInsert}${emailContent}`;
			} else {
				emailContent = contentToInsert;
			}
		}
	}

	function handleSectionsChange(event: CustomEvent<any[]>) {
		const previousSections = [...activeSections];
		activeSections = event.detail;

		if (isLoadingContent) return;

		const changedSections = activeSections.filter((curr, idx) => {
			const prev = previousSections[idx];
			return prev && curr.included !== prev.included;
		});

		if (changedSections.length === 0) return;

		changedSections.forEach((section) => {
			if (section.included) {
				restoreSection(section.id);
			} else {
				hideSection(section.id);
			}
		});

		setTimeout(() => {
			const editor = emailEditor?.getEditor();
			if (editor && !editor.isFocused) {
				editor.commands.setContent(emailContent || '<p></p>');
			}
		}, 0);

		saveCustomSections();
	}

	function handleResetSection(event: CustomEvent<{ sectionId: string }>) {
		const { sectionId } = event.detail;

		const section = techTemplateSections.find((s) => s.id === sectionId);
		if (!section) return;

		// For crew_call, pass undefined to skip comparison (no highlights)
		const templateContent = sectionId === 'crew_call' 
			? section.generator(selectedEvents, crewAssignments, crewMembers, undefined)
			: generateSectionContent(sectionId, false);
			
		const freshSectionHtml = `<div data-section="${sectionId}">${templateContent}</div>`;

		const sectionRegex = new RegExp(
			`<div[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)<\\/div>`,
			'i'
		);
		const match = emailContent.match(sectionRegex);

		if (match && match[0]) {
			emailContent = emailContent.replace(match[0], freshSectionHtml);
		} else if (hiddenSections[sectionId]) {
			hiddenSections[sectionId] = freshSectionHtml;
			hiddenSections = { ...hiddenSections };
		} else {
			console.warn(`Section ${sectionId} not found in visible or hidden content`);
			return;
		}

		const newCustomSections = { ...customSections };
		delete newCustomSections[sectionId];
		customSections = newCustomSections;

		if (match) {
			setTimeout(() => {
				const editor = emailEditor?.getEditor();
				if (editor && !editor.isFocused) {
					editor.commands.setContent(emailContent || '<p></p>');
				}
			}, 0);
		}

		saveCustomSections();
	}

	async function handleContentChange(event: CustomEvent<{ content: string }>) {
		emailContent = event.detail.content;

		eventChannel?.send({
			type: 'broadcast',
			event: 'content',
			payload: { content: emailContent }
		});

		const visibleSectionIds = activeSections.filter((s) => s.included).map((s) => s.id);
		const currentCustom = extractSectionsFromContent(emailContent, visibleSectionIds);

		Object.keys(currentCustom).forEach((key) => {
			if (currentCustom[key] && currentCustom[key].trim()) {
				customSections[key] = currentCustom[key];
			}
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

		const includedIds = activeSections.filter((s) => s.included).map((s) => s.id);

		await updateEventEmailData(firstSelected.event_id, templateType, includedIds, customSections);

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

	async function handleCrewAssignment(event: CustomEvent<{ assignments: CrewAssignments }>) {
		crewAssignments = event.detail.assignments;
		const mainEvent = selectedEvents[0];
		if (mainEvent) {
			await updateEventCrew(mainEvent.event_id, crewAssignments);
			mainEvent.crew = crewAssignments;
			lastKnownCrewState = JSON.stringify(crewAssignments);
		}
		// Regenerate with stored HTML for comparison
		await regenerateCrewCallSection();
	}

	async function handleAddCrew(event: CustomEvent<{ name: string; email?: string }>) {
		const { name, email } = event.detail;
		const newMember = await addCrewMember(name, email);
		if (newMember) {
			crewMembers = [...crewMembers, newMember].sort((a, b) => a.name.localeCompare(b.name));
		}
	}

	async function handleRemoveCrew(event: CustomEvent<CrewMember>) {
		const memberToRemove = event.detail;
		const success = await removeCrewMember(memberToRemove.id);
		if (success) {
			crewMembers = crewMembers.filter((m) => m.id !== memberToRemove.id);
			const updatedAssignments = { ...crewAssignments };
			let changed = false;

			for (const role in updatedAssignments) {
				const assignedNames = updatedAssignments[role as CrewRole];
				if (Array.isArray(assignedNames) && assignedNames.includes(memberToRemove.name)) {
					const newNames = assignedNames.filter((name) => name !== memberToRemove.name);
					if (newNames.length > 0) {
						updatedAssignments[role as CrewRole] = newNames;
					} else {
						delete updatedAssignments[role as CrewRole];
					}
					changed = true;
				}
			}

			if (changed) {
				crewAssignments = updatedAssignments;
				const mainEvent = selectedEvents[0];
				if (mainEvent) {
					await updateEventCrew(mainEvent.event_id, crewAssignments);
					mainEvent.crew = crewAssignments;
					lastKnownCrewState = JSON.stringify(crewAssignments);
				}
				await regenerateCrewCallSection();
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
						disabled={selectedEvents.length === 0 || !isNCGEventSelected}
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