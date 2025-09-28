<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';

  const vehicleInfo = 'Black Chevy Tahoe';
  const transferGroups = [
    {
      title: 'Airport Transfers - Arrival',
      transfers: [
        {
          name: 'Isona', date: '1-Sep-2025', time: '12:30 AM', pax: 1, from: 'Airport', to: 'Monville', driver: 'Eddy', phone: '(438) 821-5937', notes: 'P02473'
        },
        { notes: 'Please text or call driver upon arrival and meet him at Door 36 Zone D.' }
      ]
    },
    {
      title: 'Soundcheck Transfers',
      transfers: [
        { name: 'Skilah', date: '1-Sep-2025', time: '10:45 PM', pax: 1, from: 'Monville', to: 'New City Gas', driver: 'Eddy', phone: '(438) 821-5937', notes: '' },
        { name: 'Skilah', date: '1-Sep-2025', time: '12:30 AM', pax: 1, from: 'New City Gas', to: 'Monville', driver: 'Eddy', phone: '(438) 821-5937', notes: '' }
      ]
    },
  ];

  $: uniqueDrivers = (() => {
    const driverMap = new Map();
    transferGroups.forEach(group => {
      group.transfers.forEach(t => {
        if (t.driver && t.phone) {
          driverMap.set(t.driver, t.phone);
        }
      });
    });
    return Array.from(driverMap, ([name, phone]) => ({ name, phone }));
  })();
</script>

<Section title="GROUND TRANSFERS">
  <div class="space-y-4">
    <ContentBox class="!bg-black/15">
      <div>
        <h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-2">Information</h3>
        <div class="space-y-1 text-sm">
          {#each uniqueDrivers as driver}
            <div class="text-gray2">
              <span class="font-bold text-white">{driver.name}:</span> {driver.phone}
            </div>
          {/each}
           <div class="text-gray2">
              <span class="font-bold text-white">Vehicle:</span> {vehicleInfo}
            </div>
        </div>
      </div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="space-y-6">
        {#each transferGroups as group}
          <div>
            <h3 class="text-lime text-sm font-bold uppercase tracking-wider mb-3">{group.title}</h3>
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-gray2/20 whitespace-nowrap">
                  <th class="py-2 pr-2 text-gray2 uppercase tracking-wider text-left w-[15%]">Name</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[13%]">Date</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[10%]">Time</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-center w-[5%]"># PAX</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[14%]">From</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[14%]">To</th>
                  <th class="py-2 px-2 text-gray2 uppercase tracking-wider text-left w-[10%]">Driver</th>
                  <th class="py-2 pl-2 text-gray2 uppercase tracking-wider text-left w-[19%]">Note</th>
                </tr>
              </thead>
              <tbody class="whitespace-nowrap">
                {#each group.transfers as transfer}
                  <tr class="border-b border-gray2/10">
                    {#if !transfer.name && transfer.notes}
                      <td colspan="8" class="py-2 pr-2 text-gray2 italic !whitespace-normal">{transfer.notes}</td>
                    {:else}
                      <td class="py-2 pr-2 text-white">{transfer.name || ''}</td>
                      <td class="py-2 px-2 text-white">{transfer.date || ''}</td>
                      <td class="py-2 px-2 text-white">{transfer.time || ''}</td>
                      <td class="py-2 px-2 text-white text-center">{transfer.pax || ''}</td>
                      <td class="py-2 px-2 text-white">{transfer.from || ''}</td>
                      <td class="py-2 px-2 text-white">{transfer.to || ''}</td>
                      <td class="py-2 px-2 text-white">{transfer.driver || ''}</td>
                      <td class="py-2 pl-2 text-white">{transfer.notes || ''}</td>
                    {/if}
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/each}
      </div>
    </ContentBox>
  </div>
</Section>