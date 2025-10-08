<script lang="ts">
	import Section from '../Section.svelte';
	import ContentBox from '../ContentBox.svelte';
	import { advanceSettings } from '$lib/components/settings/AdvanceVariables';
	import type { EventAdvance } from '$lib/types/events';

	// Props from parent component
	export let event: EventAdvance;

	// Get static contacts, removing the original static production contact
	const { talentBuyer, emergency } = advanceSettings.contacts;

	// Get Day of Show contact based on DOS field
	$: dosContact =
		event.dos && advanceSettings.dosContacts[event.dos]
			? advanceSettings.dosContacts[event.dos]
			: { name: '[Name]', phone: '[Phone]', email: '[Email]' };

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
			<div class="text-white">{dosContact.name}</div>
			<div class="text-sm text-gray2">{dosContact.phone} • {dosContact.email}</div>
		</ContentBox>

		<ContentBox class="!bg-black/15">
			<div class="mb-2 text-xs uppercase tracking-wider text-lime">Emergency</div>
			<div class="text-white">{emergency.name}</div>
			<div class="text-sm text-gray2">{emergency.phone} • {emergency.email}</div>
		</ContentBox>
	</div>
</Section>