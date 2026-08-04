<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import { advanceSettings, getDosContacts } from '$lib/components/settings/AdvanceVariables';
	import type { EventAdvance } from '$lib/types/events';

	// Props from parent component
	export let event: EventAdvance;

	// Get static contacts, removing the original static production contact
	const { talentBuyer, emergency } = advanceSettings.contacts;

	// Day of Show contacts — supports one or many, Charles always first
	$: dosContacts = getDosContacts(event.dos);
	$: isMultiDos = dosContacts.length > 1;

	// --- NEW: Conditionally determine the Production contact ---
	$: productionContact = (() => {
		const settings = event.custom_settings;
		// Check if custom settings are enabled and a valid contact is selected
		if (
			settings &&
			settings.ProdContact_Enabled === true &&
			settings.ProdContact &&
			advanceSettings.productionContacts[settings.ProdContact]
		) {
			// Return the custom contact from the production contact map
			return advanceSettings.productionContacts[settings.ProdContact];
		}
		// Otherwise, return the default production contact
		return advanceSettings.contacts.production;
	})();
</script>

<Section title="CONTACT">
	<div class="grid grid-cols-2 gap-4">
		<ContentBox class="!bg-black/15">
			<div class="mb-2 text-xs uppercase tracking-wider text-lime">Talent Buyer</div>
			<div class="text-white">{talentBuyer.name}</div>
			<div class="text-sm text-gray2">{talentBuyer.phone} • {talentBuyer.email}</div>
		</ContentBox>

		<ContentBox class="!bg-black/15">
			<div class="mb-2 text-xs uppercase tracking-wider text-lime">Production</div>
			<div class="text-white">{productionContact.name}</div>
			<div class="text-sm text-gray2">{productionContact.phone} • {productionContact.email}</div>
		</ContentBox>

		<ContentBox class="!bg-black/15">
			<div class="mb-2 text-xs uppercase tracking-wider text-lime">Day of Show</div>

			{#if isMultiDos}
				<!-- Sized to content so long emails are never cut, with a tight gap
				     between people instead of a fixed 50/50 split -->
				<div class="flex flex-wrap items-start gap-x-6 gap-y-1.5">
					{#each dosContacts as contact}
						<div class="whitespace-nowrap">
							<div class="text-[13px] font-medium leading-tight text-white">
								{contact.name}
							</div>
							<div class="text-[11px] leading-tight text-gray2">
								{contact.phone} • {contact.email}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-white">{dosContacts[0].name}</div>
				<div class="text-sm text-gray2">
					{dosContacts[0].phone} • {dosContacts[0].email}
				</div>
			{/if}
		</ContentBox>

		<ContentBox class="!bg-black/15">
			<div class="mb-2 text-xs uppercase tracking-wider text-lime">Emergency</div>
			<div class="text-white">{emergency.name}</div>
			<div class="text-sm text-gray2">{emergency.phone} • {emergency.email}</div>
		</ContentBox>
	</div>
</Section>