<script lang="ts">
  export let artistName: string;
  export let venueName: string;
  export let eventDate: string;
</script>

<div class="relative">
  <!-- Lime accent bar -->
  <div class="bg-lime h-1" style="background-color: #E1FF00 !important;"></div>

  <!-- Header content -->
  <div class="bg-navbar px-10 py-6 flex items-center justify-between" style="background-color: #212121 !important;">
    <div class="text-left">
      <h1 class="text-lime text-4xl font-bold tracking-tighter" style="color: #E1FF00 !important;">ADVANCE SHEET</h1>
      <div class="text-white text-2xl font-bold tracking-tight mt-1" style="color: #F7F7F7 !important;">{artistName}</div>
      <div class="text-gray2 text-lg" style="color: #BDBDBB !important;">{venueName} • {eventDate}</div>
    </div>

    <!-- Logo with proper h-17 sizing (68px) -->
    <div class="flex items-center">
      <img 
        src="LOGO_PLACEHOLDER" 
        alt="ProduktXX Logo" 
        class="h-17 w-auto object-contain logo-img"
        style="height: 68px !important; width: auto !important; display: block !important;"
      />
    </div>
  </div>
</div>

<style>
  /* Add Tailwind h-17 class equivalent */
  :global(.h-17) {
    height: 4.25rem; /* 68px */
  }
</style>