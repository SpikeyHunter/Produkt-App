<script>
  // @ts-nocheck
  import { createEventDispatcher } from 'svelte';

  export let placeholder = 'Search an event';
  export let value = '';
  export let disabled = false;

  const dispatch = createEventDispatcher();

  function handleInput(event) {
    value = event.target.value;
    dispatch('input', { value });
  }

  function handleKeydown(event) {
    dispatch('keydown', event);
  }

  function handleFocus(event) {
    dispatch('focus', event);
  }

  function handleBlur(event) {
    dispatch('blur', event);
  }
</script>

<div class="relative w-full max-w-md">
  <div class="relative">
    <!-- Search Icon -->
    <div class="absolute left-3 top-1/2 transform -translate-y-1/2 text-lime pointer-events-none">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
    </div>
    
    <!-- Input Field -->
    <input
      type="text"
      {placeholder}
      bind:value
      {disabled}
      class="search-input"
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
      on:blur={handleBlur}
    />
  </div>
</div><style>
  .search-input {
    width: 400px;
    height: 28px;
    padding-left: 34px;
    padding-right: 12px;
    font-family: var(--font-helvetica);
    font-size: 14px;
    line-height: 22px;
    font-weight: 600;
    color: var(--color-lime);
    background: var(--color-navbar);
    border-radius: 14px;
    border-width: 1px;
    border-color: var(--color-lime);
    border-style: solid;
    outline: none;
    transition: none;
  }

  .search-input::placeholder {
    color: var(--color-lime);
    opacity: 0.8;
  }

  .search-input:hover {
    color: var(--color-lime);
    background: var(--color-navbar);
    border-color: var(--color-lime);
  }

  .search-input:focus {
    color: var(--color-lime);
    background: var(--color-navbar);
    border-color: var(--color-lime);
  }

  .search-input:disabled {
    color: var(--color-lime);
    background: var(--color-navbar);
    border-color: var(--color-lime);
  }

  /* Responsive adjustments */
  @media (max-width: 640px) {
    .search-input {
      width: 100%;
      min-width: 300px;
    }
  }
</style>
