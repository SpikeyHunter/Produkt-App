<script lang="ts">
	import AdvanceTemplateCard from './AdvanceTemplateCard.svelte';
	import DropdownButton from '$lib/components/buttons/DropdownButton.svelte';
	import type { EventAdvance } from '$lib/types/events.js';
	import { PROGRESS_FIELDS } from '$lib/utils/progressUtils';
	import { createEventDispatcher } from 'svelte';

	// Props
	export let event: EventAdvance; // Reverted type to fix the assignment error

	const dispatch = createEventDispatcher();

	// --- Options for Dropdowns ---
	const immigrationTypeOptions = ['IMM5686E', 'Letter'];
	const immigrationSentOptions = ['To Do', 'Done'];
	const passportsOptions = ['Waiting', 'Received'];
	const yesNoOptions = ['Yes', 'No'];

	// --- Reactive Display Values ---
	$: immigrationType = getDisplayValue(event.immigration_type, '');
	$: immigrationSentStatus = getBooleanDisplayValue(event.immigration_sent, ['To Do'], 'Done');
	$: passportsStatus = getBooleanDisplayValue(event.passports, ['Waiting'], 'Received');
	$: letterReceived = getBooleanDisplayValue(event.letter_received, ['No'], 'Yes');
	$: letterSent = getBooleanDisplayValue(event.letter_sent, ['No'], 'Yes');

	// Safely parse roles, which may be a JSON string, an array, or null from the DB
	$: parsedRoles = (() => {
		if (!event.roles) {
			return [];
		}
		if (typeof event.roles === 'string') {
			try {
				// Attempt to parse if it's a non-empty string
				const parsed = JSON.parse(event.roles);
				return Array.isArray(parsed) ? parsed : [];
			} catch (e) {
				// Return empty array if parsing fails
				return [];
			}
		}
		// If it's already an array (or other non-string type), handle as is
		return Array.isArray(event.roles) ? event.roles : [];
	})();
	
	// Determine Role List status based on the parsed 'roles' array
	$: roleListStatus = parsedRoles.length > 0 ? 'Yes' : 'No';

	// --- Helper Functions ---
	function getDisplayValue(value: any, defaultValue: string): string {
		if (value === null || value === undefined) {
			return '';
		}
		return String(value) || defaultValue;
	}

	function getBooleanDisplayValue(value: any, falseTexts: string[], trueText: string): string {
		if (value === null || value === undefined) {
			return '';
		}
		if (value === true) {
			return trueText;
		} else if (value === false) {
			return falseTexts[0];
		}
		return '';
	}

	// --- Event Handlers ---
	function handleFieldUpdate(updateEvent: CustomEvent) {
		const { column, value } = updateEvent.detail;
		
		let processedValue = value;
		if (column === 'immigration_sent') {
			processedValue = value === 'Done';
		} else if (column === 'passports') {
			processedValue = value === 'Received';
		} else if (column === 'letter_received' || column === 'letter_sent') {
			processedValue = value === 'Yes';
		}
		
		(event as any)[column] = processedValue;
		event = { ...event };
		
		if (PROGRESS_FIELDS.includes(column as any)) {
			dispatch('progress-field-updated', { column, value: processedValue, eventId: event.event_id, artistName: event.artist_name });
		}
		
		dispatch('fieldUpdate', { column, value: processedValue, eventId: event.event_id, artistName: event.artist_name });
	}

	function handleColumnUpdate(updateEvent: CustomEvent) {
		const { columns, toggleColumn, toggleValue } = updateEvent.detail;
		
		if (columns) {
			columns.forEach((column: string) => {
				(event as any)[column] = null;
			});
		}
		
		if (toggleColumn) {
			(event as any)[toggleColumn] = toggleValue;
		}
		
		event = { ...event };
		dispatch('columnUpdate', updateEvent.detail);
	}
</script>

<AdvanceTemplateCard 
	title="Immigration" 
	width={280} 
	height={365} 
	defaultEnabled={false}
	{event}
	dbColumns={["immigration_type", "immigration_sent", "letter_received", "letter_sent"]}
	toggleColumn="immigration"
	on:columnUpdate={handleColumnUpdate}
>
	<div class="px-2 py-1 flex flex-col gap-0 h-full relative">
		<div class="flex flex-col gap-2">
			
			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Form Type</span>
				<DropdownButton
					bind:value={immigrationType}
					{event}
					options={immigrationTypeOptions}
					placeholder="Select"
					customPlaceholder="Enter immigration type"
					column="immigration_type"
					valueType="text"
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>

			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Passports</span>
				<DropdownButton
					bind:value={passportsStatus}
					{event}
					options={passportsOptions}
					placeholder="Select"
					customPlaceholder="Enter passport status"
					column="passports"
					valueType="boolean"
					trueValues={['Received']}
					falseValues={['Waiting']}
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>

			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Immigration Sent</span>
				<DropdownButton
					bind:value={immigrationSentStatus}
					{event}
					options={immigrationSentOptions}
					placeholder="Select"
					customPlaceholder="Enter immigration status"
					column="immigration_sent"
					valueType="boolean"
					trueValues={['Done']}
					falseValues={['To Do']}
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>

			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Letter Received</span>
				<DropdownButton
					bind:value={letterReceived}
					{event}
					options={yesNoOptions}
					placeholder="Select"
					customPlaceholder="Enter status"
					column="letter_received"
					valueType="boolean"
					trueValues={['Yes']}
					falseValues={['No']}
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>

			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Letter Sent</span>
				<DropdownButton
					bind:value={letterSent}
					{event}
					options={yesNoOptions}
					placeholder="Select"
					customPlaceholder="Enter status"
					column="letter_sent"
					valueType="boolean"
					trueValues={['Yes']}
					falseValues={['No']}
					on:fieldUpdate={handleFieldUpdate}
				/>
			</div>
			
			<div class="flex items-center gap-3 text-sm">
				<span class="font-semibold min-w-[120px] text-gray3">Role List</span>
				<div class="bg-gray2 text-sm text-black rounded-xl px-3 py-1 font-bold text-xs hover:bg-lime hover:text-black transition-all duration-200 cursor-pointer flex items-center justify-between gap-2">
                    <span class="text-black">{roleListStatus}</span>
                </div>
			</div>
		</div>
	</div>
</AdvanceTemplateCard>