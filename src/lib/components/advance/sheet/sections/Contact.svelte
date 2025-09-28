<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
</script>

<Section title="CONTACT">
  <div class="grid grid-cols-2 gap-4">
    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Talent Buyer</div>
      <div class="text-white">[Name]</div>
      <div class="text-gray2 text-sm">[Phone] • [Email]</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Production</div>
      <div class="text-white">[Name]</div>
      <div class="text-gray2 text-sm">[Phone] • [Email]</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Day of Show</div>
      <div class="text-white">[Name]</div>
      <div class="text-gray2 text-sm">[Phone] • [Email]</div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Emergency</div>
      <div class="text-white">[Name]</div>
      <div class="text-gray2 text-sm">[Phone] • [Email]</div>
    </ContentBox>
  </div>
</Section>