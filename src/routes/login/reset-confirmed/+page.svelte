<svelte:head>
  <title>Password Reset Confirmed – Produkt App</title>
</svelte:head>

<script lang="ts">
  import Button from '$lib/components/buttons/Button.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let currentYear: number = new Date().getFullYear();
  let isLoaded: boolean = false;
  let countdown: number = 5;
  let countdownInterval: NodeJS.Timeout;
  
  // Trigger animation after component mounts
  onMount(() => {
    setTimeout(() => {
      isLoaded = true;
    }, 100);
    
    // Start countdown
    countdownInterval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
        goto('/');
      }
    }, 1000);
    
    // Cleanup on destroy
    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  });
  
  function goToLogin(): void {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }
    goto('/');
  }
</script>

<style>
  .fade-in {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease-out, transform 0.6s ease-out;
  }
  
  .fade-in.loaded {
    opacity: 1;
    transform: translateY(0);
  }
  
  .header-fade {
    opacity: 1;
    transform: translateY(0);
  }
  
  .footer-fade {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.5s ease-out, transform 0.5s ease-out;
    transition-delay: 0.3s;
  }
  
  .footer-fade.loaded {
    opacity: 1;
    transform: translateY(0);
  }
  
  .success-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 20px;
    background: #E1FF00; /* Your actual lime color */
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: bounce 0.6s ease-out;
  }
  
  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-10px);
    }
    60% {
      transform: translateY(-5px);
    }
  }
  
  .checkmark {
    width: 30px;
    height: 30px;
    stroke: black; /* Black checkmark on lime background */
    stroke-width: 3;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    animation: draw 0.5s ease-out 0.2s forwards;
    stroke-dasharray: 50;
    stroke-dashoffset: 50;
  }
  
  @keyframes draw {
    to {
      stroke-dashoffset: 0;
    }
  }
</style>

<!-- Full page layout -->
<div class="min-h-screen bg-white flex flex-col">
  <!-- Header with logo -->
  <header class="p-4 header-fade">
    <div class="flex items-center">
      <img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6" />
    </div>
  </header>
  
  <!-- Main content - centered -->
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-xl">
      
      <!-- Success Message Container Box -->
      <div class="bg-white rounded-2xl p-8 shadow-lg fade-in {isLoaded ? 'loaded' : ''}">
        
        <!-- Success Icon -->
        <div class="success-icon">
          <svg class="checkmark" viewBox="0 0 52 52">
            <path d="M14 27l8 8 16-16" />
          </svg>
        </div>
        
        <!-- Title Section inside box -->
        <div class="text-center space-y-4 mb-6">
          <h1 class="text-3xl font-bold text-gray1">Password Reset Successful!</h1>
          <p class="text-gray2 text-base">
            Your password has been updated successfully. You can now log in with your new password.
          </p>
          <p class="text-gray2 text-sm">
            Redirecting to login in <span class="font-bold text-lime">{countdown}</span> seconds...
          </p>
        </div>
        
        <div class="space-y-4">
          
          <!-- Go to Login Button -->
          <div class="flex justify-center">
            <Button 
              variant="filled"
              width="w-2/3 mb-0" 
              on:click={goToLogin}
            >
              Go to Login Now
            </Button>
          </div>
          
        </div>
      </div>
      
    </div>
  </div>
  
  <!-- Footer -->
  <footer class="p-4 footer-fade {isLoaded ? 'loaded' : ''}">
    <p class="text-gray2 text-xs">Copyright©{currentYear} Produkt</p>
  </footer>
</div>