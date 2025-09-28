<script lang="ts">
  import Section from '../Section.svelte';
  import ContentBox from '../ContentBox.svelte';

  export let artistName: string;
  const schedule = [
    { time: '10:00 PM', artist: 'Doors' },
    { time: '10:30 PM', artist: 'Opening Act 1' },
    { time: '11:30 PM', artist: 'Opening Act 2' },
    { time: '01:30 AM', artist: artistName },
    { time: '03:00 AM', artist: 'End of Show' },
    { time: '03:30 AM', artist: 'Hard Curfew' },
  ];
</script>

<Section title="RUNNING ORDER" class="h-full flex flex-col">
  <ContentBox class="!bg-black/15 !p-0 overflow-hidden h-full flex flex-col">
    <div class="h-full flex flex-col justify-evenly">
      {#each schedule as item}
        {@const isHighlighted = item.artist === artistName}

        <div class="{isHighlighted ? 'bg-lime/10 border-l-3 border-lime' : ''}">
          <div class="flex items-center px-5 py-1">
            <span class="text-sm w-28 {isHighlighted ? 'text-lime' : 'text-gray2'}">
              {@html item.time || '&nbsp;'}
            </span>
            <span class="text-sm {isHighlighted ? 'text-lime' : 'text-white'}">
              {item.artist}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </ContentBox>
</Section>