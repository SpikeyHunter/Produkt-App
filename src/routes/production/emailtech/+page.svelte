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
	let hiddenSections: Record<string, string> = {};
	let isLoadingContent = false;

	$: isNCGEventSelected = selectedEvents.some((e) => e.event_venue === 'New City Gas');

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
		if (templateType === 'vj' && !isNCGEventSelected) {
			templateType = 'tech';
		}

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
			hiddenSections = {}; // NEW - reset hidden sections
			return;
		}

		isLoadingContent = true;
		const mainEvent = selectedEvents[0];

		const { sections: savedSections, customSections: savedCustom } = await getEventSections(
			mainEvent.event_id,
			templateType
		);

		customSections = savedCustom;
		hiddenSections = {}; // Reset on new event load

		const storedContent = templateType === 'tech' ? mainEvent.tech_mail : mainEvent.vj_mail;

		if (
			storedContent &&
			storedContent.trim() !== '' &&
			storedContent !== '<p></p>' &&
			storedContent !== '<p style="font-weight: 400;"></p>'
		) {
			// Load stored content and extract hidden sections based on savedSections
			emailContent = storedContent;

			// Extract any sections that should be hidden
			const allSectionIds = techTemplateSections.map((s) => s.id);
			allSectionIds.forEach((sectionId) => {
				if (!savedSections.includes(sectionId)) {
					// This section should be hidden
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

		// CHANGED: Loop through ALL sections, not just included ones
		techTemplateSections.forEach((section) => {
			const isVisible = sectionsToUse.includes(section.id);
			const templateContent = section.generator(selectedEvents, crewAssignments);

			// CHANGED: Pass isVisible parameter
			const sectionHtml = mergeSectionContent(
				templateContent,
				customSections[section.id],
				section.id,
				isVisible // NEW
			);

			if (sectionHtml && sectionHtml.trim()) {
				contentParts.push(sectionHtml.trim());
			}
		});

		return contentParts.join('<br/>');
	}
	function extractSectionContent(fullContent: string): Record<string, string> {
		const activeSectionIds = activeSections.filter((s) => s.included).map((s) => s.id);
		return extractSectionsFromContent(fullContent, activeSectionIds);
	}

	function hideSection(sectionId: string) {
		if (!emailContent) return;

		console.log(`Attempting to hide section: ${sectionId}`);
		console.log('Current emailContent:', emailContent.substring(0, 200));

		// More flexible regex that handles various div structures
		const regex = new RegExp(`<div[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)<\\/div>`, 'i');
		const match = emailContent.match(regex);

		if (match && match[0]) {
			console.log(`✓ Found section to hide: ${sectionId}`);
			console.log('Matched content:', match[0].substring(0, 100));

			// Store the ENTIRE div including wrapper in hiddenSections
			hiddenSections[sectionId] = match[0];

			// Remove from emailContent
			let newContent = emailContent.replace(match[0], '');

			// Clean up breaks
			newContent = newContent
				.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, '<br/>') // Clean up double breaks
				.replace(/^<br\s*\/?>|<br\s*\/?>$/gi, '') // Remove leading/trailing breaks
				.trim();

			emailContent = newContent;
			console.log('New emailContent length:', emailContent.length);
		} else {
			console.log(`✗ Could not find section: ${sectionId} in emailContent`);
			console.log('Tried regex:', regex.toString());

			// Try to find ANY data-section attribute to see structure
			const anySection = emailContent.match(/<div[^>]*data-section="[^"]*"[^>]*>/i);
			if (anySection) {
				console.log('Example section div found:', anySection[0]);
			} else {
				console.log('No data-section divs found at all in emailContent');
			}
		}

		// Force update hiddenSections
		hiddenSections = { ...hiddenSections };
	}
	function restoreSection(sectionId: string) {
		let contentToInsert = '';

		// Check if we have it hidden - if so, use that
		if (hiddenSections[sectionId]) {
			contentToInsert = hiddenSections[sectionId];
			delete hiddenSections[sectionId]; // Remove from hidden storage
		} else {
			// Only generate from template if we DON'T have it hidden
			const section = techTemplateSections.find((s) => s.id === sectionId);
			if (!section) return;

			const templateContent = section.generator(selectedEvents, crewAssignments);
			contentToInsert = mergeSectionContent(templateContent, customSections[sectionId], sectionId);
		}

		if (!contentToInsert) return;

		// Find the correct position based on section order
		const sectionOrder = techTemplateSections.map((s) => s.id);
		const targetIndex = sectionOrder.indexOf(sectionId);

		// Find where to insert (after the last visible section that comes before it)
		let insertAfterSectionId = '';
		for (let i = targetIndex - 1; i >= 0; i--) {
			const prevSectionId = sectionOrder[i];
			if (emailContent.includes(`data-section="${prevSectionId}"`)) {
				insertAfterSectionId = prevSectionId;
				break;
			}
		}

		if (insertAfterSectionId) {
			// Insert after the previous section
			const regex = new RegExp(
				`(<div[^>]*data-section="${insertAfterSectionId}"[^>]*>[\\s\\S]*?<\\/div>)`,
				'i'
			);
			emailContent = emailContent.replace(regex, `$1<br/>${contentToInsert}`);
		} else {
			// Insert at beginning
			if (emailContent && emailContent.trim()) {
				emailContent = `${contentToInsert}<br/>${emailContent}`;
			} else {
				emailContent = contentToInsert;
			}
		}
	}

	function debugState() {
		console.log('=== DEBUG STATE ===');
		console.log(
			'Active sections:',
			activeSections.filter((s) => s.included).map((s) => s.id)
		);
		console.log('Hidden sections:', Object.keys(hiddenSections));
		console.log('Custom sections:', Object.keys(customSections));
		console.log('Email content length:', emailContent.length);
		console.log(
			'Email content sections:',
			[...emailContent.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1])
		);
		console.log('First 500 chars of emailContent:', emailContent.substring(0, 500));
		console.log('---');
	}

	function handleSectionsChange(event: CustomEvent<any[]>) {
		const previousSections = [...activeSections];
		activeSections = event.detail;

		if (isLoadingContent) return;

		// Find what changed
		const changedSections = activeSections.filter((curr, idx) => {
			const prev = previousSections[idx];
			return prev && curr.included !== prev.included;
		});

		if (changedSections.length === 0) return; // Nothing changed

		changedSections.forEach((section) => {
			if (section.included) {
				// TOGGLING ON: Restore from hiddenSections
				restoreSection(section.id);
			} else {
				// TOGGLING OFF: Extract and hide
				hideSection(section.id);
			}
		});

		// Update editor content
		setTimeout(() => {
			const editor = emailEditor?.getEditor();
			if (editor && !editor.isFocused) {
				editor.commands.setContent(emailContent || '<p></p>');
			}
		}, 0);

		saveCustomSections();
		debugState();
	}

	function handleResetSection(event: CustomEvent<{ sectionId: string }>) {
		const { sectionId } = event.detail;

		// Find the section definition
		const section = techTemplateSections.find((s) => s.id === sectionId);
		if (!section) return;

		// Generate fresh template content for this section only
		const templateContent = section.generator(selectedEvents, crewAssignments);
		const freshSectionHtml = `<div data-section="${sectionId}">${templateContent}</div>`;

		// Check if section is currently visible in emailContent
		const sectionRegex = new RegExp(
			`<div[^>]*data-section="${sectionId}"[^>]*>([\\s\\S]*?)<\\/div>`,
			'i'
		);
		const match = emailContent.match(sectionRegex);

		if (match && match[0]) {
			// Section is visible - replace it in place
			emailContent = emailContent.replace(match[0], freshSectionHtml);
		} else if (hiddenSections[sectionId]) {
			// Section is hidden - update the hidden version
			hiddenSections[sectionId] = freshSectionHtml;
			hiddenSections = { ...hiddenSections }; // Trigger reactivity
		} else {
			// Section doesn't exist anywhere (shouldn't happen, but handle it)
			console.warn(`Section ${sectionId} not found in visible or hidden content`);
			return;
		}

		// Remove custom content for this section
		const newCustomSections = { ...customSections };
		delete newCustomSections[sectionId];
		customSections = newCustomSections;

		// Update editor only if section was visible
		if (match) {
			setTimeout(() => {
				const editor = emailEditor?.getEditor();
				if (editor && !editor.isFocused) {
					editor.commands.setContent(emailContent || '<p></p>');
				}
			}, 0);
		}

		// Save to database
		saveCustomSections();
	}
	async function handleContentChange(event: CustomEvent<{ content: string }>) {
		emailContent = event.detail.content;

		// DEBUG: Check if data-section attributes survive
		const sections = [...emailContent.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]);
		if (sections.length === 0 && emailContent.length > 0) {
			console.warn('⚠️ TipTap stripped data-section attributes!');
			console.log('Content sample:', emailContent.substring(0, 200));
		}

		eventChannel?.send({
			type: 'broadcast',
			event: 'content',
			payload: { content: emailContent }
		});

		// Extract visible sections (don't touch hidden ones)
		const visibleSectionIds = activeSections.filter((s) => s.included).map((s) => s.id);
		const currentCustom = extractSectionsFromContent(emailContent, visibleSectionIds);

		// Update customSections only for visible sections
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

		// Save with custom sections
		await updateEventEmailData(firstSelected.event_id, templateType, includedIds, customSections);

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
			crewDependentSections.forEach((sectionId) => {
				if (!customSections[sectionId]) {
					const section = techTemplateSections.find((s) => s.id === sectionId);
					if (section && activeSections.find((s) => s.id === sectionId)?.included) {
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
