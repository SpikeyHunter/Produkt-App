<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
  import { advanceSettings } from '$lib/components/settings/AdvanceVariables';
  import type { EventAdvance } from '$lib/types/events';

  // Props from parent component
  export let event: EventAdvance;

  // Get static contacts
  const { talentBuyer, production, emergency } = advanceSettings.contacts;

  // Get Day of Show contact based on DOS field
  $: dosContact = event.dos && advanceSettings.dosContacts[event.dos] 
    ? advanceSettings.dosContacts[event.dos]
    : { name: '[Name]', phone: '[Phone]', email: '[Email]' };
</script>

<Section title="CONTACT">
  <div class="grid grid-cols-2 gap-4">
    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Talent Buyer</div>
      <div class="text-white">{talentBuyer.name}</div>
      <div class="text-gray2 text-sm">{talentBuyer.phone} • {talentBuyer.email}</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Production</div>
      <div class="text-white">{production.name}</div>
      <div class="text-gray2 text-sm">{production.phone} • {production.email}</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Day of Show</div>
      <div class="text-white">{dosContact.name}</div>
      <div class="text-gray2 text-sm">{dosContact.phone} • {dosContact.email}</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Emergency</div>
      <div class="text-white">{emergency.name}</div>
      <div class="text-gray2 text-sm">{emergency.phone} • {emergency.email}</div>
    </ContentBox>
  </div>
</Section>