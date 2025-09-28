<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
</script>

<Section title="IMMIGRATION">
  <ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-l-lime p-5">
    <div class="space-y-2 text-gray2 text-sm">
      <div>• Exemption letters will be provided</div>
      <div>• Artists and crew members must get an ETA to board the plane (except for Canadian and US Citizens)</div>
      <div>
        • Please confirm with your airline or visit 
        <a 
          href="http://www.cic.gc.ca/english/visit/eta-start.asp" 
          target="_blank" 
          rel="noopener noreferrer" 
          class="text-lime hover:underline"
        >
          http://www.cic.gc.ca/english/visit/eta-start.asp
        </a>
      </div>
    </div>
  </ContentBox>
</Section>