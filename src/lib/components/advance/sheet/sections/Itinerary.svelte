<script lang="ts">
  import Section from '../Section.svelte';
  import KeyValue from '../KeyValue.svelte';
  import ContentBox from '../ContentBox.svelte';
</script>

<Section title="ARTIST ITINERARY">
  <ContentBox class="!bg-black/15">
    <div class="grid grid-cols-2 gap-x-8 gap-y-3">
      <KeyValue label="Artist">[Artist Name]</KeyValue>
      <KeyValue label="Date">[Event Date]</KeyValue>
      <KeyValue label="Venue">[Venue Name]</KeyValue>
      <KeyValue label="City">[City]</KeyValue>
      <KeyValue label="Address">[Venue Address]</KeyValue>
      <KeyValue label="Entrance">[Artist Entrance]</KeyValue>
    </div>
  </ContentBox>
</Section>