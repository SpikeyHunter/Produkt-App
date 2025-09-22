<svelte:head>
  <title>Reset Password – Produkt App</title>
</svelte:head>

<script lang="ts">
  import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
  import Button from '$lib/components/buttons/Button.svelte';
  import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  
  let password: string = '';
  let confirmPassword: string = '';
  let currentYear: number = new Date().getFullYear();
  let isLoaded: boolean = false;
  let isSubmitting: boolean = false;
  let accessToken: string = '';
  let refreshToken: string = '';
  
  // Popup notification state
  let showPopup: boolean = false;
  let popupMessage: string = '';
  
  // Reactive statement to check if form is valid
  $: isFormValid = password.trim() && confirmPassword.trim();
  
  // Trigger animation after component mounts
  onMount(() => {
    // Extract tokens from URL hash
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    accessToken = urlParams.get('access_token') || '';
    refreshToken = urlParams.get('refresh_token') || '';
    
    // Check if we have the required tokens
    if (!accessToken) {
      showPopupNotification('Invalid or expired reset link. Please request a new one.');
      setTimeout(() => {
        goto('/login/forgot-password');
      }, 3000);
      return;
    }
    
    setTimeout(() => {
      isLoaded = true;
    }, 100);
  });
  
  // Password validation
  function validatePassword(password: string): boolean {
    return password.length >= 8;
  }
  
  // Show popup notification
  function showPopupNotification(message: string): void {
    popupMessage = message;
    showPopup = true;
  }
  
  // Handle field validation on blur
  function handlePasswordBlur(): void {
    if (password.trim() && !validatePassword(password)) {
      showPopupNotification("Password must contain at least 8 characters");
    }
  }
  
  function handleConfirmPasswordBlur(): void {
    if (confirmPassword.trim() && password !== confirmPassword) {
      showPopupNotification("Passwords do not match");
    }
  }
  
  // Handle password reset
  async function handleResetPassword(): Promise<void> {
    if (!isFormValid) return;
    
    // Validate password
    if (!validatePassword(password)) {
      showPopupNotification("Password must contain at least 8 characters");
      return;
    }
    
    // Check if passwords match
    if (password !== confirmPassword) {
      showPopupNotification("Passwords do not match");
      return;
    }
    
    isSubmitting = true;
    
    try {
      console.log('🔄 Updating password...');
      
      const response = await fetch('/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          password,
          accessToken,
          refreshToken
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        showPopupNotification(result.message);
        // Clear the form
        password = '';
        confirmPassword = '';
        // Redirect to success page after success
        setTimeout(() => {
          goto('/login/reset-confirmed');
        }, 2000);
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
      
      <!-- Reset Password Form Container Box -->
      <div class="bg-white rounded-2xl p-6 shadow-lg fade-in {isLoaded ? 'loaded' : ''}">
        <!-- Title Section inside box -->
        <div class="text-center space-y-1 mb-6">
          <h1 class="text-3xl font-bold text-gray1">Reset Password</h1>
          <p class="text-gray2 text-sm">Enter your new password</p>
        </div>
        
        <div class="space-y-4">
          
          <!-- Password Input -->
          <TypebarCredentials 
            variant="password"
            label="New Password"
            placeholder="enter your new password"
            bind:value={password}
            on:blur={handlePasswordBlur}
          />
          
          <!-- Confirm Password Input -->
          <TypebarCredentials 
            variant="password"
            label="Confirm New Password"
            placeholder="confirm your new password"
            bind:value={confirmPassword}
            on:blur={handleConfirmPasswordBlur}
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
              {isSubmitting ? 'Updating Password...' : 'Update Password'}
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