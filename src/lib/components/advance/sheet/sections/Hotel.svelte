<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';

  const reservations = [
    {
      name: 'Esona Tyolo',
      confirmation: '161575058',
      checkIn: '1-Sep',
      checkOut: '2-Sep'
    },
    {
      name: 'Jane Smith',
      confirmation: '161575062',
      checkIn: '1-Sep',
      checkOut: '3-Sep'
    }
  ];
</script>

<Section title="HOTEL ACCOMMODATION">
  <ContentBox class="!bg-black/15">
    <div class="space-y-4">
      <div>
        <div class="text-gray2 text-xs uppercase tracking-wider mb-1">Hotel Name</div>
        <div class="text-white text-xl font-bold">Hotel Monville</div>
      </div>

      <div class="pt-4 border-t border-gray2/20 overflow-x-auto">
        <table class="w-full text-left text-sm whitespace-nowrap">
          <thead>
            <tr class="border-b border-gray2/20">
              <th class="py-2 pr-4 font-medium text-gray2 text-xs uppercase tracking-wider">Name</th>
              <th class="py-2 px-4 font-medium text-gray2 text-xs uppercase tracking-wider">Confirmation Number</th>
              <th class="py-2 px-4 font-medium text-gray2 text-xs uppercase tracking-wider">Check-in</th>
              <th class="py-2 pl-4 font-medium text-gray2 text-xs uppercase tracking-wider">Check-out</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray2/20">
            {#each reservations as res}
              <tr>
                <td class="py-2 pr-4 text-white">{res.name}</td>
                <td class="py-2 px-4 text-white">{res.confirmation}</td>
                <td class="py-2 px-4 text-white">{res.checkIn}</td>
                <td class="py-2 pl-4 text-white">{res.checkOut}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      
      <div class="border-t border-gray2/20 pt-3">
        <div class="text-lime text-xs uppercase tracking-wider mb-2">Notes</div>
        <div class="space-y-1 text-sm text-gray2">
          <div>• Late check-out confirmed for [Time]</div>
          <div>• Credit card required for incidentals</div>
          <div>• [Additional notes]</div>
        </div>
      </div>
    </div>
  </ContentBox>
</Section>