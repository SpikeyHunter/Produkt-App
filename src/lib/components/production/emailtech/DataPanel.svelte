<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { EmailTechEvent } from '$lib/types/emailtech';
	import { techTemplateSections } from '$lib/services/techTemplateService';
	import { updateEventEmailData } from '$lib/services/emailtechService';

	export let events: EmailTechEvent[] = [];
	export let templateType: 'tech' | 'vj' = 'tech';
	export let eventId: number | null = null;

	const dispatch = createEventDispatcher();

    // Define interface for local section state
    interface SectionState {
        id: string;
        label: string;
        included: boolean;
    }

	let sections: SectionState[] = techTemplateSections.map((s) => ({
		id: s.id,
		label: s.label,
		included: false
	}));

	let resettingSection: string | null = null;

	$: if (eventId !== null && templateType === 'tech') {
		loadSavedSections();
	}

	$: showSections = templateType === 'tech';

	function loadSavedSections() {
		if (!eventId || events.length === 0) return;

		const mainEvent = events[0];
		const emailData = mainEvent.email_data || {};
		const savedIds: string[] = emailData[`${templateType}_sections`] || [];

		sections = sections.map((s) => ({
			...s,
			included: savedIds.includes(s.id)
		}));

		dispatch('sectionsChange', sections);
	}

	async function saveSectionsToDatabase() {
		if (!eventId) return;
		const includedIds = sections.filter((s) => s.included).map((s) => s.id);
		await updateEventEmailData(eventId, templateType, includedIds);

		if (events.length > 0) {
			const mainEvent = events[0];
			const emailData = mainEvent.email_data || {};
			mainEvent.email_data = {
				...emailData,
				[`${templateType}_sections`]: includedIds
			};
		}
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'TBD';
		try {
			const utcDate = new Date(dateString);
			if (isNaN(utcDate.getTime())) return dateString;
			const date = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
			const day = date.getDate();
			const month = date.toLocaleString('en-US', { month: 'long' });
			const year = date.getFullYear();
			return `${month} ${day}, ${year}`;
		} catch {
			return dateString;
		}
	}

	function toggleSection(sectionId: string) {
		sections = sections.map((s) => (s.id === sectionId ? { ...s, included: !s.included } : s));
		dispatch('sectionsChange', sections);
		saveSectionsToDatabase();
	}

	function resetSection(sectionId: string, event: Event) {
		event.stopPropagation();

		resettingSection = sectionId;
		dispatch('resetSection', { sectionId });
		setTimeout(() => {
			resettingSection = null;
		}, 600);
	}

	function selectAllSections() {
		sections = sections.map((s) => ({ ...s, included: true }));
		dispatch('sectionsChange', sections);
		saveSectionsToDatabase();
	}

	function clearAllSections() {
		sections = sections.map((s) => ({ ...s, included: false }));
		dispatch('sectionsChange', sections);
		dispatch('clearAll');
		saveSectionsToDatabase();
	}
</script>

{#if events.length > 0}
	<div class="p-3 border-b border-t border-gray1">
		<div class="flex gap-3 items-center">
			<div class="w-1/4 flex-shrink-0">
				{#if events.length === 2}
					<div class="flex flex-col gap-1">
						{#each events as evt}
							<div class="bg-gray1 rounded-md overflow-hidden aspect-square relative">
								{#if evt.event_flyer}
									<img
										src={evt.event_flyer}
										alt={evt.event_name}
										class="w-full h-full object-cover"
									/>
								{:else}
									<div
										class="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray1 to-gray2"
									>
										<svg
											class="w-6 h-6 text-gray2"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<rect x="3" y="3" width="18" height="18" rx="2" /><circle
												cx="8.5"
												cy="8.5"
												r="1.5"
											/><polyline points="21 15 16 10 5 21" />
										</svg>
									</div>
								{/if}
								{#if evt.event_status}
									<div
										class="absolute top-0.5 right-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold
                    {evt.event_status.toLowerCase() === 'live'
											? 'bg-lime text-black'
											: 'bg-gray-600 text-white'}"
									>
										{evt.event_status.toUpperCase()}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="bg-gray1 rounded-lg overflow-hidden relative">
						{#if events[0].event_flyer}
							<img
								src={events[0].event_flyer}
								alt={events[0].event_name}
								class="w-full h-auto object-cover block"
							/>
						{:else}
							<div
								class="w-full aspect-[4/5] flex flex-col items-center justify-center bg-gradient-to-br from-gray1 to-gray2"
							>
								<svg
									class="w-8 h-8 text-gray2"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<rect x="3" y="3" width="18" height="18" rx="2" /><circle
										cx="8.5"
										cy="8.5"
										r="1.5"
									/><polyline points="21 15 16 10 5 21" />
								</svg>
							</div>
						{/if}
						{#if events[0].event_status}
							<div
								class="absolute top-1 right-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold
                {events[0].event_status.toLowerCase() === 'live'
									? 'bg-lime text-black'
									: 'bg-gray-600 text-white'}"
							>
								{events[0].event_status.toUpperCase()}
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div class="flex-1 flex flex-col">
				<h2 class="text-sm font-bold text-white leading-tight mb-1">
					{events.map((e) => e.event_name).join(' & ')}
				</h2>
				{#if events.length === 1}
					<div class="w-full border-t border-gray1 mb-1"></div>
				{/if}

				{#each events as evt, i}
					{#if events.length > 1}
						<div class="text-[11px] font-bold text-gray3">{evt.event_venue}</div>
					{/if}
					<div class="text-[11px] flex gap-2 items-center leading-normal">
						<span class="text-gray3 min-w-[45px]">Event ID:</span>
						<span class="text-white">{evt.event_id || 'N/A'}</span>
					</div>
					<div class="text-[11px] flex gap-2 items-center leading-normal">
						<span class="text-gray3 min-w-[45px]">Date:</span>
						<span class="text-white">{formatDate(evt.event_date)}</span>
					</div>
					{#if events.length === 1}
						<div class="text-[11px] flex gap-2 items-center leading-normal">
							<span class="text-gray3 min-w-[45px]">Venue:</span>
							<span class="text-white">{evt.event_venue || 'N/A'}</span>
						</div>
					{/if}
					{#if i < events.length - 1}
						<div class="w-full border-t border-gray1 my-1"></div>
					{/if}
				{/each}
			</div>
		</div>
	</div>

	<div class="border-t border-gray1 mx-4"></div>
{/if}

{#if showSections}
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between mb-2">
			<h3 class="text-white text-sm font-bold">Template Sections</h3>
			<div class="flex gap-3">
				<button
					type="button"
					onclick={selectAllSections}
					class="text-xs text-lime hover:text-white transition-colors cursor-pointer"
				>
					Auto-Fill
				</button>
				<button
					type="button"
					onclick={clearAllSections}
					class="text-xs text-gray2 hover:text-problem transition-colors cursor-pointer"
				>
					Clear
				</button>
			</div>
		</div>
		<div class="text-gray2 text-xs">
			{#if events.length === 0}
				Select an event to view sections
			{:else}
				Click sections to include in template
			{/if}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-3 no-scrollbar">
		{#if events.length > 0}
			<div class="space-y-2">
				{#each sections as section (section.id)}
					<div class="bg-gray1 rounded-lg overflow-hidden">
						<div class="flex items-center gap-2 p-2.5">
							<button
								type="button"
								onclick={(e) => resetSection(section.id, e)}
								class="flex-shrink-0 text-gray3 hover:text-lime transition-colors cursor-pointer {resettingSection ===
								section.id
									? 'reset-spin'
									: ''}"
								aria-label="Reset {section.label} to template"
								title="Reset to template"
							>
								<svg
									class="w-3.5 h-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
									<path d="M21 3v5h-5" />
									<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
									<path d="M3 21v-5h5" />
								</svg>
							</button>

							<div
								class="flex-1 text-left font-bold text-xs {section.included
									? 'text-white'
									: 'text-gray3'}"
							>
								{section.label}
							</div>

							<button
								type="button"
								onclick={() => toggleSection(section.id)}
								class="relative w-9 h-5 rounded-full transition-colors cursor-pointer
                       {section.included ? 'bg-lime' : 'bg-gray2'}"
								aria-label="Toggle {section.label} section {section.included ? 'off' : 'on'}"
							>
								<div
									class="absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200
                         {section.included ? 'bg-gray1 left-4' : 'bg-white left-0.5'}"
								></div>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center h-full text-center">
				<svg
					class="w-12 h-12 text-gray2 mb-3"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
				</svg>
				<p class="text-gray2 text-sm">No event selected</p>
			</div>
		{/if}
	</div>
{:else}
	<div class="flex-1 overflow-y-auto p-3">
		<div class="flex flex-col items-center justify-center h-full text-center">
			<svg
				class="w-12 h-12 text-gray2 mb-3"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
				></path>
				<polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
				<line x1="12" y1="22.08" x2="12" y2="12"></line>
			</svg>
			<p class="text-gray2 text-sm font-bold mb-1">VJ Template Mode</p>
			<p class="text-gray2 text-xs">VJ templates use a simpler format</p>
		</div>
	</div>
{/if}

<style>
	.no-scrollbar {
		-ms-overflow-style: none; /* IE and Edge */
		scrollbar-width: none; /* Firefox */
	}
	.no-scrollbar::-webkit-scrollbar {
		display: none; /* Chrome, Safari, and Opera */
	}

	@keyframes reset-spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.reset-spin {
		animation: reset-spin 0.6s ease-in-out;
	}
</style>