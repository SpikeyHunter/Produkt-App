<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';
  import type { EventAdvance, MeetGreetInfo } from '$lib/types/events';

  export let event: EventAdvance;

  // Parse meet & greet info
  $: meetGreetData = parseMeetGreetInfo(event.meetgreet_info);
  $: isEnabled = event.meetgreet_enabled === true;

  function parseMeetGreetInfo(meetGreetInfo: any): MeetGreetInfo | null {
    if (!meetGreetInfo) return null;
    
    try {
      // If it's already an object, return it
      if (typeof meetGreetInfo === 'object' && !Array.isArray(meetGreetInfo)) {
        return meetGreetInfo as MeetGreetInfo;
      }
      
      // If it's a string, parse it
      if (typeof meetGreetInfo === 'string') {
        return JSON.parse(meetGreetInfo);
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing meet & greet info:', error);
      return null;
    }
  }

  // Format time from 24h to 12h format
  function formatTime(time24: string): string {
    if (!time24) return 'N/A';
    try {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
      return time24;
    }
  }

  // Split details by line breaks
  function parseDetails(details?: string): string[] {
    if (!details) return [];
    return details.split('\n').filter(line => line.trim());
  }
</script>

<Section title="MEET & GREET" titleClass="{isEnabled ? 'text-lime' : 'text-gray1'}">
  <div class="space-y-4">
    <ContentBox class="!bg-black/15">
      <div class="grid grid-cols-2 gap-x-8">
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wider {isEnabled ? 'text-lime' : 'text-gray1'}">Time</div>
            <div class="{isEnabled ? 'text-white' : 'text-gray1'}">
              {isEnabled && meetGreetData ? formatTime(meetGreetData.time) : 'N/A'}
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider {isEnabled ? 'text-lime' : 'text-gray1'}"># of People</div>
            <div class="{isEnabled ? 'text-white' : 'text-gray1'}">
              {isEnabled && meetGreetData ? meetGreetData.peopleCount : 'N/A'}
            </div>
          </div>
        </div>
        <div class="space-y-4">
          <div>
            <div class="text-xs uppercase tracking-wider {isEnabled ? 'text-lime' : 'text-gray1'}">Contact on Site</div>
            <div class="{isEnabled ? 'text-white' : 'text-gray1'}">
              {isEnabled && meetGreetData ? meetGreetData.contactName : 'N/A'}
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider {isEnabled ? 'text-lime' : 'text-gray1'}">Contact Number</div>
            <div class="{isEnabled ? 'text-white' : 'text-gray1'}">
              {isEnabled && meetGreetData ? meetGreetData.contactNumber : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </ContentBox>

    <ContentBox class="!bg-black/15">
      <div class="text-xs uppercase tracking-wider mb-2 {isEnabled ? 'text-lime' : 'text-gray1'}">Details</div>
      <div class="text-sm {isEnabled ? 'text-gray1' : 'text-gray1'}">
        {#if isEnabled && meetGreetData && meetGreetData.details}
          {#each parseDetails(meetGreetData.details) as line}
            <div>{line}</div>
          {/each}
        {:else}
          <div>N/A</div>
        {/if}
      </div>
    </ContentBox>
  </div>
</Section>