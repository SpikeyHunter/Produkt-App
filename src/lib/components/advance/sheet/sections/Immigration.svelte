<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
</script>

<Section title="IMMIGRATION">
  <ContentBox class="!bg-black/15 border-r-15 border-r-black border-l-3 border-l-lime p-5">
    <div class="space-y-2 text-gray2 text-sm text-justify">
      <div>• All artists and travelling crew must be eligible to enter Canada as a visitor (tourist) before travel.</div>
      <div>• We will provide exemption letters that allow artists and crew to perform or work in Canada without a work visa.
These letters do not grant entry to Canada — they only apply after you are admitted at the border.</div>
<div>• If you normally require an eTA (Electronic Travel Authorization) to fly to Canada, you must obtain one in advance of travel.
Canadian and U.S. passport holders do not require an eTA.</div>
      <div>
        • If you are unsure of your eligibility, please confirm with your airline or check the official Canadian government website: 
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