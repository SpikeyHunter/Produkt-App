<!-- src/routes/+error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  
  $: error = $page.error;
  $: status = $page.status;
  
  function goHome() {
    goto('/');
  }
  
  function goBack() {
    if (browser && window.history.length > 1) {
      window.history.back();
    } else {
      goto('/');
    }
  }
  
  // Get error title based on status
  function getErrorTitle(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Page Not Found';
      case 500: return 'Internal Server Error';
      case 502: return 'Bad Gateway';
      case 503: return 'Service Unavailable';
      default: return 'Error Occurred';
    }
  }
  
  // Get error description based on status
  function getErrorDescription(status: number): string {
    switch (status) {
      case 400: return 'The request was invalid or cannot be served.';
      case 401: return 'You need to be authenticated to access this resource.';
      case 403: return 'You don\'t have permission to access this resource.';
      case 404: return 'The page you\'re looking for doesn\'t exist.';
      case 500: return 'Something went wrong on our end. Please try again later.';
      case 502: return 'The server received an invalid response from upstream.';
      case 503: return 'The service is temporarily unavailable. Please try again later.';
      default: return error?.message || 'An unexpected error occurred.';
    }
  }
</script>

<svelte:head>
  <title>Error {status} – Produkt App</title>
</svelte:head>

<div class="min-h-screen bg-gray1 flex items-center justify-center p-6">
  <div class="text-center max-w-lg w-full">
    <!-- Sad Face Icon with Subtle Glow -->
    <div class="mb-8 fade-in-up">
      <div class="text-[8rem] text-lime subtle-glow mb-6 leading-none fade-in-up">
        : (
      </div>
      <h1 class="text-6xl font-bold text-lime mb-2 fade-in-up">{status}</h1>
      <h2 class="text-3xl font-bold text-white mb-4 fade-in-up">{getErrorTitle(status)}</h2>
      <p class="text-gray3 text-lg leading-relaxed fade-in-up">
        {getErrorDescription(status)}
      </p>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-col sm:flex-row gap-4 justify-center fade-in-up">
      <button 
        on:click={goBack}
        class="button-hover bg-transparent border-2 border-lime text-lime px-8 py-4 rounded-2xl font-bold text-lg hover:bg-lime hover:text-black transition-all duration-300 flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
        </svg>
        Go Back
      </button>
      
      <button 
        on:click={goHome}
        class="button-hover bg-lime text-black px-8 py-4 rounded-2xl font-bold text-lg hover:bg-opacity-90 transition-all duration-300 flex items-center justify-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
        </svg>
        Go Home
      </button>
    </div>
  </div>
</div>

<style>
  /* Ensure proper font inheritance */
  * {
    font-family: var(--font-helvetica);
  }
  
  /* Subtle glowing effect for the sad face */
  .subtle-glow {
    text-shadow: 
      0 0 5px var(--color-lime),
      0 0 10px var(--color-lime),
      0 0 15px var(--color-lime);
    filter: brightness(1.1);
  }
  
  /* Simple fade in up animation */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  /* Animation class */
  .fade-in-up {
    animation: fadeInUp 0.6s ease-out;
  }
  
  /* Button hover cursor */
  .button-hover {
    cursor: pointer;
  }
  
  .button-hover:hover {
    cursor: pointer;
  }
  
  /* Smooth button transitions */
  button {
    transition: all 0.3s ease;
    cursor: pointer;
  }
</style>