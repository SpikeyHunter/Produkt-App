<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
</script>

<Section title="MEET & GREET">
  <div class="space-y-4">
    <ContentBox class="!bg-black/15">
      <div class="grid grid-cols-2 gap-x-8">
        <div class="space-y-4">
          <div>
            <div class="text-lime text-xs uppercase tracking-wider">Time</div>
            <div class="text-white">[Time]</div>
          </div>
          <div>
            <div class="text-lime text-xs uppercase tracking-wider"># of People</div>
            <div class="text-white">[Number]</div>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <div class="text-lime text-xs uppercase tracking-wider">Contact on Site</div>
            <div class="text-white">[Contact Name]</div>
          </div>
          <div>
            <div class="text-lime text-xs uppercase tracking-wider">Contact Number</div>
            <div class="text-white">[Phone Number]</div>
          </div>
        </div>
      </div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-lime text-xs uppercase tracking-wider mb-2">Details</div>
      <div class="text-gray2 text-sm">
        [Additional meet & greet details...]
      </div>
    </ContentBox>
  </div>
</Section>