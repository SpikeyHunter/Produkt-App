<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { TechEmailForm, EmailTechEvent } from '$lib/types/emailtech';
	import HeaderSection from './sections/HeaderSection.svelte';
	import CrewCallSection from './sections/CrewCallSection.svelte';
	import TeamNotesSection from './sections/TeamNotesSection.svelte';
	import ProjectsSpecsSection from './sections/ProjectsSpecsSection.svelte';
	import VisualsSection from './sections/VisualsSection.svelte';
	import SetTimesSection from './sections/SetTimesSection.svelte';
	import SoundcheckSection from './sections/SoundcheckSection.svelte';
    import LoungeAmbianceSection from './sections/LoungeAmbianceSection.svelte'; // NEW IMPORT
	import BacklineSection from './sections/BacklineSection.svelte';
	import TravellingSection from './sections/TravellingPartySection.svelte';
	import VJSection from './sections/VJScheduleSection.svelte';
	import LightsSection from './sections/LightsSection.svelte';
	import SFXSection from './sections/SFXSection.svelte';
	import SponsorsFooterSection from './sections/FooterSection.svelte';
	import VJNotesSection from './sections/VJNotesSection.svelte';
	import VJVisualsSection from './sections/VJVisualsSection.svelte';
	import PreviewModal from '$lib/components/modals/PreviewModal.svelte';

	export let formData: TechEmailForm;
	export let readOnly = false;
	export let availableEvents: EmailTechEvent[] = [];
	export let selectedEvent: EmailTechEvent | null = null;

	const dispatch = createEventDispatcher();
	let showRiderModal = false;
	let selectedRiderUrl = '';
	let selectedRiderName = '';
	$: currentEventId = selectedEvent?.event_id ?? null;

	function handleChange(e?: CustomEvent) {
		dispatch('change', e?.detail || formData);
	}

	function handleToggle(e: CustomEvent) {
		const { id, isVisible } = e.detail;
		if (!formData.visible_sections) formData.visible_sections = {};
		formData.visible_sections[id] = isVisible;
		dispatch('change', formData);
	}

	function handleViewRider(e: CustomEvent) {
		selectedRiderUrl = e.detail.fileUrl;
		selectedRiderName = e.detail.fileName;
		showRiderModal = true;
	}

	$: secondEventId = formData.second_event?.event_id || null;
	$: vjName = (selectedEvent?.crew?.['VJ'] || ['VJ'])[0]?.split(' ')[0] || 'VJ';
</script>

<div class="flex flex-col gap-1 pb-10">
	<HeaderSection
		bind:formData
		{readOnly}
		events={availableEvents}
		mainEvent={selectedEvent}
		on:change={handleChange}
		on:toggle={handleToggle}
	/>
	<CrewCallSection bind:formData {readOnly} on:change={handleChange} on:toggle={handleToggle} />
	<TeamNotesSection bind:formData {readOnly} on:change={handleChange} on:toggle={handleToggle} />
	<ProjectsSpecsSection
		bind:formData
		{readOnly}
		on:change={handleChange}
		on:toggle={handleToggle}
	/>
	<VisualsSection bind:formData {readOnly} on:change={handleChange} on:toggle={handleToggle} />
	<SetTimesSection bind:formData {readOnly} on:change={handleChange} on:toggle={handleToggle} />

    <div class="grid grid-cols-1 md:grid-cols-2 mb-4 gap-4 items-stretch">
		<SoundcheckSection
			bind:formData
			{readOnly}
			on:change={handleChange}
			on:toggle={handleToggle}
			stretch={true}
			eventId={currentEventId}
			{secondEventId}
			events={availableEvents}
		/>
        <LoungeAmbianceSection 
            bind:formData
            {readOnly}
            on:change={handleChange}
            on:toggle={handleToggle}
            stretch={true}
        />
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 mb-4 gap-4 items-stretch">
		<TravellingSection
			bind:formData
			{readOnly}
			on:change={handleChange}
			on:toggle={handleToggle}
			stretch={true}
			events={availableEvents}
			{currentEventId}
			{secondEventId}
		/>
		<BacklineSection
			bind:formData
			{readOnly}
			on:change={handleChange}
			on:toggle={handleToggle}
			stretch={true}
			events={availableEvents}
			{currentEventId}
			{secondEventId}
			on:view-rider={handleViewRider}
		/>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 mb-4 gap-4 items-stretch">
		<div class="flex flex-col gap-1 h-full">
			<VJSection
				bind:formData
				{readOnly}
				on:change={handleChange}
				on:toggle={handleToggle}
				events={availableEvents}
				fullEventData={selectedEvent}
			/>
			<SFXSection
				bind:formData
				{readOnly}
				on:change={handleChange}
				on:toggle={handleToggle}
				stretch={true}
				events={availableEvents}
				{currentEventId}
				{secondEventId}
			/>
		</div>
		<LightsSection
			bind:formData
			{readOnly}
			on:change={handleChange}
			on:toggle={handleToggle}
			stretch={true}
		/>
	</div>

	<div class="grid grid-cols-1 gap-4 mb-4">
		<VJNotesSection
			bind:formData
			{readOnly}
			{vjName}
			on:change={handleChange}
			on:toggle={handleToggle}
		/>
		<VJVisualsSection
			bind:formData
			{readOnly}
			on:change={handleChange}
			on:toggle={handleToggle}
			stretch={true}
			events={availableEvents}
			{currentEventId}
		/>
	</div>

	<SponsorsFooterSection
		bind:formData
		{readOnly}
		on:change={handleChange}
		on:toggle={handleToggle}
	/>

	<PreviewModal
		isOpen={showRiderModal}
		fileName={selectedRiderName}
		fileUrl={selectedRiderUrl}
		showDeleteButton={false}
		on:close={() => (showRiderModal = false)}
	/>
</div>