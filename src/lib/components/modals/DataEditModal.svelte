<script context="module" lang="ts">
  export type ContentItem = {
    data_name: string;
    value: string | number | null;
    input_type: 'text' | 'dropdown';
    options?: string[];
    table: string;
    column: string;
    placeholder?: string;
    allow_other?: boolean;
  };
</script>

<script lang="ts">
  import { createEventDispatcher, tick } from 'svelte';
  import Modal from '$lib/components/modals/Modal.svelte';
  import { suggestGenre } from '$lib/services/aiService.js';

  export let isOpen = false;
  export let title = 'Edit Data';
  export let event_id: string | number;
  export let content: ContentItem[] = [];
  export let event_name: string | undefined = undefined;
  export let event_venue: string | undefined = undefined;
  export let show_header = true;
  export let show_footer = true;
  export let width = 'max-w-lg';
  export let is_saving = false;
  
  const dispatch = createEventDispatcher();
  
  let editableContent: ContentItem[] = [];
  let customValues: Record<string, string> = {};
  let activeDropdown: string | null = null;
  let isSuggesting = false;
  let suggestionError: string | null = null;

  $: if (isOpen && content.length > 0) {
    editableContent = [...content];
    customValues = {};
    suggestionError = null;
    // Initialize custom values for items that have non-standard values
    editableContent.forEach(item => {
      if (item.input_type === 'dropdown' && item.allow_other && item.value) {
        if (!item.options?.includes(item.value as string)) {
          customValues[item.column] = item.value as string;
          item.value = 'Other';
        }
      }
    });
  }

  async function handleSuggestGenre(item: ContentItem) {
    if (!event_name) {
      suggestionError = 'Event name is missing.';
      return;
    }
    isSuggesting = true;
    suggestionError = null;
    try {
      const suggested = await suggestGenre(event_name, event_venue);
      
      // Find and update the specific item
      const index = editableContent.findIndex(c => c.column === item.column);
      if (index !== -1) {
        editableContent[index].value = suggested;
        // Force reactivity
        editableContent = [...editableContent];
      }
      
      // Wait for DOM update
      await tick();
    } catch (err) {
      suggestionError = 'Could not get suggestion.';
    } finally {
      isSuggesting = false;
    }
  }

  function handleSave() {
    if (is_saving) return;
    const updates = editableContent.map(item => {
      let finalValue = item.value;
      
      // Use custom value if "Other" is selected
      if (item.value === 'Other' && customValues[item.column]) {
        finalValue = customValues[item.column];
      }
      
      return {
        table: item.table,
        column: item.column,
        value: finalValue,
      };
    });
    dispatch('save', {
      eventId: event_id,
      updates: updates,
    });
  }

  /**
   * Clears the content of all input fields in the modal.
  */
  function handleClear() {
    if (is_saving) return;
    editableContent.forEach(item => {
      item.value = null;
    });
    
    customValues = {};
    editableContent = [...editableContent];
    customValues = {...customValues};
  }

  function selectOption(item: ContentItem, option: string) {
    item.value = option;
    activeDropdown = null;
    // Initialize custom value when "Other" is selected
    if (option === 'Other') {
      customValues[item.column] = customValues[item.column] || '';
    } else {
      customValues[item.column] = '';
    }
    
    // Force reactivity update
    editableContent = [...editableContent];
    customValues = { ...customValues };
  }

  function closeModal() {
    activeDropdown = null;
    dispatch('close');
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('.dropdown-container')) {
      activeDropdown = null;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
  bind:isOpen
  {title}
  maxWidth={width}
  hasFooter={show_footer}
  showHeader={show_header}
  on:close={closeModal}
>
  <div class="space-y-4">
    {#each editableContent as item}
      <div>
        <div class="flex justify-between items-center mb-2">
          <p class="font-normal text-lime text-sm">{item.data_name}</p>
          
          {#if item.column === 'event_genre' && event_name}
            <button
              type="button"
              class="px-2 py-1 text-xs rounded-full bg-lime/20 text-lime hover:cursor-pointer hover:bg-lime/40 transition-all disabled:opacity-50 disabled:cursor-wait"
              on:click={() => handleSuggestGenre(item)}
              disabled={isSuggesting}
              title="Suggest genre based on event name"
            >
              {isSuggesting ? 'Thinking...' : '✨ Suggest with AI'}
            </button>
          {/if}
        </div>

        {#if suggestionError && item.column === 'event_genre'}
          <p class="text-red-500 text-xs text-center mb-2">{suggestionError}</p>
        {/if}

        {#if item.input_type === 'dropdown'}
          <div class="dropdown-container relative">
            <button
              type="button"
              class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
              on:click={() => activeDropdown = activeDropdown === item.column ? null : item.column}
            >
              <span class={item.value ? 'text-white' : 'text-gray2'}>
                {item.value || item.placeholder || 'Select an option'}
              </span>
              <svg 
                class="w-4 h-4 text-lime transition-transform {activeDropdown === item.column ? 'rotate-180' : ''}" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                stroke-width="2"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {#if activeDropdown === item.column}
              <div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {#each item.options || [] as option}
                  <button
                    type="button"
                    class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
                    on:click={() => selectOption(item, option)}
                  >
                    {option}
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          {#if item.allow_other && item.value === 'Other'}
            <div class="mt-3">
              <input
                type="text"
                class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
                placeholder="Enter custom {item.column === 'event_genre' ? 'genre' : 'value'}"
                bind:value={customValues[item.column]}
              />
            </div>
          {/if}

        {:else}
          <input
            type="text"
            class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
            placeholder={item.placeholder || `Enter ${item.data_name.toLowerCase()}`}
            bind:value={item.value}
          />
        {/if}
      </div>
    {/each}
  </div>

  <div slot="footer" class="flex items-center justify-between w-full">
    <button
      type="button"
      class="p-3 rounded-full hover:bg-red-500/20 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      on:click={handleClear}
      disabled={is_saving}
      aria-label="Clear all fields"
    >
      <svg class="w-6 h-6 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.134H8.09c-1.18 0-2.09.954-2.09 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
    
    <div class="flex gap-3">
      <button
        class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-all duration-200 cursor-pointer disabled:opacity-50"
        on:click={closeModal}
        disabled={is_saving}
      >
        Cancel
      </button>
      <button
        class="px-6 py-3 rounded-full transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        class:bg-lime={!is_saving}
        class:text-black={!is_saving}
        class:bg-gray1={is_saving}
        class:text-gray2={is_saving}
        disabled={is_saving}
        on:click={handleSave}
      >
        {#if is_saving}
          Saving...
        {:else}
          Save Changes
        {/if}
      </button>
    </div>
  </div>
</Modal>