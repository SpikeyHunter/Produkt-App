<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
  import type { EventAdvance } from '$lib/types/events';

  export let event: EventAdvance;

  interface HotelReservation {
    id: string;
    reservationFirstName: string;
    reservationLastName: string;
    hotelName: string;
    customHotelName?: string;
    customHotelAddress?: string;
    roomType: string;
    checkInDate: string;
    checkInTime?: string;
    checkOutDate: string;
    checkOutTime?: string;
    notes?: string;
    requestEarlyCheckIn?: boolean;
    earlyCheckInTime?: string;
    requestLateCheckOut?: boolean;
    lateCheckOutTime?: string;
    isPaidByUs?: boolean;
    confirmationNumber?: string;
  }

  // Parse hotel info
  $: hotelData = parseHotelInfo(event.hotel_info);

  function parseHotelInfo(hotelInfo: any): HotelReservation[] {
    if (!hotelInfo) return [];
    
    try {
      // If it's already an array, return it
      if (Array.isArray(hotelInfo)) return hotelInfo;
      
      // If it's a string, parse it
      if (typeof hotelInfo === 'string') {
        return JSON.parse(hotelInfo);
      }
      
      return [];
    } catch (error) {
      console.error('Error parsing hotel info:', error);
      return [];
    }
  }

  // Format date to "3-Oct" format
  function formatDate(dateString: string): string {
    try {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
      return `${day}-${monthShort}`;
    } catch (error) {
      return dateString;
    }
  }

  // Group reservations by hotel
  $: hotelGroups = groupByHotel(hotelData);

  function groupByHotel(reservations: HotelReservation[]) {
    const groups = new Map<string, HotelReservation[]>();
    
    reservations.forEach(res => {
      const hotelName = res.customHotelName || res.hotelName;
      if (!groups.has(hotelName)) {
        groups.set(hotelName, []);
      }
      groups.get(hotelName)!.push(res);
    });
    
    return Array.from(groups.entries());
  }

  // Parse notes into array
  function parseNotes(notesString?: string): string[] {
    if (!notesString) return [];
    return notesString.split('\n').filter(note => note.trim());
  }

  // Get all unique notes from all reservations in a hotel group
  function getHotelNotes(reservations: HotelReservation[]): string[] {
    const allNotes = new Set<string>();
    reservations.forEach(res => {
      parseNotes(res.notes).forEach(note => allNotes.add(note));
    });
    return Array.from(allNotes);
  }
</script>

{#if hotelGroups.length > 0}
  <Section title="HOTEL ACCOMMODATION">
    {#each hotelGroups as [hotelName, reservations], index}
      <ContentBox class="!bg-black/15 {index > 0 ? 'mt-4' : ''}">
        <div class="space-y-4">
          <div>
            <div class="text-gray2 text-xs uppercase tracking-wider mb-1">Hotel Name</div>
            <div class="text-white text-xl font-bold">{hotelName}</div>
          </div>

          <div class="pt-4 border-t border-gray2/20 overflow-x-auto">
            <table class="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr class="border-b border-gray2/20">
                  <th class="py-2 pr-4 font-medium text-gray2 text-xs uppercase tracking-wider">
                    {reservations.length > 1 ? 'Names' : 'Name'}
                  </th>
                  <th class="py-2 px-3 font-medium text-gray2 text-xs uppercase tracking-wider">Confirmation #</th>
                  <th class="py-2 px-4 font-medium text-gray2 text-xs uppercase tracking-wider">Room Type</th>
                  <th class="py-2 px-4 font-medium text-gray2 text-xs uppercase tracking-wider">Check-in</th>
                  <th class="py-2 pl-4 font-medium text-gray2 text-xs uppercase tracking-wider">Check-out</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray2/20">
                {#each reservations as res}
                  <tr>
                    <td class="py-2 pr-4 text-white">{res.reservationFirstName} {res.reservationLastName}</td>
                    <td class="py-2 px-3 text-white">{res.confirmationNumber || 'N/A'}</td>
                    <td class="py-2 px-4 text-white">{res.roomType}</td>
                    <td class="py-2 px-4 text-white">{formatDate(res.checkInDate)}</td>
                    <td class="py-2 pl-4 text-white">{formatDate(res.checkOutDate)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          
          {#if getHotelNotes(reservations).length > 0 || true}
            <div class="border-t border-gray2/20 pt-3">
              <div class="text-lime text-xs uppercase tracking-wider mb-2">Notes</div>
              <div class="space-y-1 text-sm text-gray2">
                {#each getHotelNotes(reservations) as note}
                  <div>• {note}</div>
                {/each}
                <div>• Credit card must be provided for incidentals</div>
              </div>
            </div>
          {/if}
        </div>
      </ContentBox>
    {/each}
  </Section>
{/if}