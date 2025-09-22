<svelte:head>
  <title>Forgot Password – Produkt App</title>
</svelte:head>

<script lang="ts">
  import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
  import Button from '$lib/components/buttons/Button.svelte';
  import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let email: string = '';
  let currentYear: number = new Date().getFullYear();
  let isLoaded: boolean = false;
  let isSubmitting: boolean = false;
  
  // Popup notification state
  let showPopup: boolean = false;
  let popupMessage: string = '';
  
  // Reactive statement to check if form is valid
  $: isFormValid = email.trim();
  
  // Trigger animation after component mounts
  onMount(() => {
    setTimeout(() => {
      isLoaded = true;
    }, 100);
  });
  
  // Email validation
  function validateEmail(email: string): boolean {
    const allowedDomains = ['@produkt.ca', '@newcitygas.com'];
    return allowedDomains.some(domain => email.endsWith(domain));
  }
  
  // Show popup notification
  function showPopupNotification(message: string): void {
    popupMessage = message;
    showPopup = true;
  }
  
  // Handle field validation on blur
  function handleEmailBlur(): void {
    if (email.trim() && !validateEmail(email)) {
      showPopupNotification("You're not allowed to use this email domain");
    }
  }
  
  // Handle password reset
  async function handleResetPassword(): Promise<void> {
    if (!isFormValid) return;
    
    // Validate email domain
    if (!validateEmail(email)) {
      showPopupNotification("You're not allowed to use this email domain");
      return;
    }
    
    isSubmitting = true;
    
    try {
      console.log('🔄 Sending password reset request...');
      
      const response = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showPopupNotification(result.message);
        // Clear the form
        email = '';
        // Optionally redirect to login after a delay
        setTimeout(() => {
          goto('/');
        }, 3000);
      } else {
        showPopupNotification(result.error || 'An error occurred');
      }
      
    } catch (error) {
      console.error('💥 Reset password error:', error);
      showPopupNotification('An unexpected error occurred');
    } finally {
      isSubmitting = false;
    }
  }
  
  function goToLogin(): void {
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
</style>

<!-- Full page layout -->
<div class="min-h-screen bg-white flex flex-col">
  <!-- Popup Notification -->
<PopupNotification bind:show={showPopup} message={popupMessage} variant="white" iconType="login" />
  
  <!-- Header with logo -->
  <header class="p-4 header-fade">
    <div class="flex items-center">
      <img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6" />
    </div>
  </header>
  
  <!-- Main content - centered -->
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-xl">
      
      <!-- Forgot Password Form Container Box -->
      <div class="bg-white rounded-2xl p-6 shadow-lg fade-in {isLoaded ? 'loaded' : ''}">
        <!-- Title Section inside box -->
        <div class="text-center space-y-1 mb-6">
          <h1 class="text-3xl font-bold text-gray1">Forgot Password?</h1>
          <p class="text-gray2 text-sm">Enter your email to reset your password</p>
        </div>
        
        <div class="space-y-4">
          
          <!-- Email Input -->
          <TypebarCredentials 
            variant="username"
            label="Email"
            placeholder="enter your email"
            bind:value={email}
            on:blur={handleEmailBlur}
          />
          
          <!-- Reset Password Button -->
          <div class="pt-2 flex justify-center">
            <Button 
              variant={!isFormValid ? 'blocked' : (isSubmitting ? 'loading' : 'filled')}
              width="w-2/3 mb-0" 
              type="submit"
              disabled={!isFormValid || isSubmitting}
              on:click={handleResetPassword}
            >
              {isSubmitting ? 'Sending Reset Link...' : 'Reset Password'}
            </Button>
          </div>
          
          <!-- Go Back Link -->
          <div class="text-center pt-1">
            <button 
              type="button"
              on:click={goToLogin}
              class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 cursor-pointer"
            >
              Go Back to Login
            </button>
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