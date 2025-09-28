<script lang="ts">
  import AdvanceSheetTemplate from '$lib/components/advance/sheet/AdvanceSheetTemplate.svelte';
  
  // All sections enabled by default - toggle these to test different lengths
  let showArtistItinerary = true;
  let showContact = true;
  let showHotel = true;
  let showImmigration = true;
  let showRunningOrder = true;
  let showMeetGreet = true;
  let showGroundTransfers = true;
  let showMediaPolicy = true;
  let showHouseRules = true;
</script>

<div class="min-h-screen bg-gray3 flex justify-center py-8">
  <div class="shadow-2xl">
    <AdvanceSheetTemplate 
      {showArtistItinerary}
      {showContact}
      {showHotel}
      {showImmigration}
      {showRunningOrder}
      {showMeetGreet}
      {showGroundTransfers}
      {showHouseRules}
    />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  
  @media print {
    :global(body) {
      background: white !important;
    }
    
    .min-h-screen {
      min-height: auto;
      background: white !important;
      padding: 0;
    }
    
    .shadow-2xl {
      box-shadow: none !important;
    }
  }
</style>