<script lang="ts">
  import Section from '../Section.svelte';
  import KeyValue from '../KeyValue.svelte';
  import ContentBox from '../ContentBox.svelte';
  import { advanceSettings, formatAdvanceDate } from '$lib/components/settings/AdvanceVariables';
  import type { EventAdvance } from '$lib/types/events';

  // Props from parent component
  export let event: EventAdvance;

  // Get venue settings
  const { city, venueAddress, artistEntrance } = advanceSettings.venue;

  // Computed values
  $: artistName = event.artist_name || '[Artist Name]';
  $: eventDate = event.event_date ? formatAdvanceDate(event.event_date) : '[Event Date]';
  $: venueName = event.event_venue || '[Venue Name]';
</script>

<Section title="ARTIST ITINERARY">
  <ContentBox class="!bg-black/15">
    <div class="grid grid-cols-2 gap-x-8 gap-y-3">
      <KeyValue label="Artist">{artistName}</KeyValue>
      <KeyValue label="Date">{eventDate}</KeyValue>
      <KeyValue label="Venue">{venueName}</KeyValue>
      <KeyValue label="City">{city}</KeyValue>
      <KeyValue label="Address">{venueAddress}</KeyValue>
      <KeyValue label="Entrance">{artistEntrance}</KeyValue>
    </div>
  </ContentBox>
</Section>