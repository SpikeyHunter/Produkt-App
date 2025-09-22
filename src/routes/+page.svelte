<svelte:head>
  <title>Login – Produkt App</title>
</svelte:head>

<script lang="ts">
  import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
  import Button from '$lib/components/buttons/Button.svelte';
  import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase'; // Import Supabase client

  let username: string = '';
  let password: string = '';
  let rememberMe: boolean = false;
  let currentYear: number = new Date().getFullYear();
  let isLoaded: boolean = false;
  let showErrorPopup: boolean = false;
  let showSuccessPopup: boolean = false;
  let errorMessage: string = '';
  let successMessage: string = '';
  let isLoading: boolean = false;
  let skipLogoAnimation: boolean = false;

  $: bothFieldsFilled = username.trim() !== '' && password.trim() !== '';
  $: buttonVariant = isLoading ? 'loading' : (bothFieldsFilled ? 'filled' : 'blocked');

  onMount(() => {
    // Load saved username if "Remember me" was checked
    const savedUsername = localStorage.getItem('savedUsername');
    if (savedUsername) {
      username = savedUsername;
      rememberMe = true;
    }
    
    // Trigger animation after component mounts
    setTimeout(() => {
      isLoaded = true;
    }, 100);
  });
  
  // Save or clear the username when "Remember me" checkbox changes
  function handleRememberMeChange() {
    if (rememberMe) {
      localStorage.setItem('savedUsername', username);
    } else {
      localStorage.removeItem('savedUsername');
    }
  }

  // Show popup messages
  function showPopupError(message: string) {
    errorMessage = message;
    showErrorPopup = true;
  }

  function showPopupSuccess(message: string) {
    successMessage = message;
    showSuccessPopup = true;
  }

  // Handle Login directly with Supabase
  async function handleLogin() {
    if (!bothFieldsFilled || isLoading) return;
    isLoading = true;

    try {
      // Sign in with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: username.toLowerCase().trim(),
        password,
      });

      if (error) {
        showPopupError(error.message || 'Invalid login credentials.');
      } else {
        // On successful login, save username if "Remember me" is checked
        if (rememberMe) {
          localStorage.setItem('savedUsername', username);
        } else {
          localStorage.removeItem('savedUsername');
        }
        
        // Let the root layout handle the redirect
        // No need for goto('/dashboard') here
        showPopupSuccess('Login successful! Redirecting...');
      }
    } catch (err) {
      showPopupError('An unexpected error occurred. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function goToForgotPassword() {
    goto('/login/forgot-password');
  }

  function goToRegister() {
    goto('/login/register');
  }
</script>

<div class="min-h-screen bg-white flex flex-col">
  <PopupNotification bind:show={showErrorPopup} message={errorMessage} variant="white" iconType="error" />
  
  <PopupNotification bind:show={showSuccessPopup} message={successMessage} variant="white" iconType="login" />
  
  <header class:p-4="{true}" class:header-fade="{!skipLogoAnimation}" class:no-animation="{skipLogoAnimation}" class:loaded="{isLoaded}">
    <div class="flex items-center">
      <img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6" />
    </div>
  </header>
  
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-lg">
      <div class="bg-white rounded-2xl p-8 shadow-lg fade-in {isLoaded ? 'loaded' : ''}">
        <div class="text-center space-y-1 mb-6">
          <h1 class="text-3xl font-bold text-gray1">Produkt App</h1>
          <p class="text-gray2 text-sm">Enter your login credentials</p>
        </div>
    
        <form on:submit|preventDefault={handleLogin}>
          <div class="space-y-3">
            <TypebarCredentials 
              variant="username"
              label="Email"
              placeholder="enter your email"
              bind:value={username}
            />
            <TypebarCredentials 
              variant="password"
              label="Password"
              placeholder="enter your password"
              bind:value={password}
            />
            
            <div class="flex items-center justify-between pt-2">
              <label class="flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  bind:checked={rememberMe}
                  on:change={handleRememberMeChange}
                  class="custom-checkbox w-4 h-4 border-2 border-gray2 rounded focus:ring-lime focus:ring-1 focus:outline-none"
                />
                <span class="ml-2 text-gray1 font-bold text-sm">Remember username</span>
              </label>
              
              <button 
                type="button"
                on:click={goToForgotPassword}
                class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
            
            <div class="pt-4 flex justify-center">
              <Button 
                variant={buttonVariant}
                width="w-1/2 mb-0" 
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
            </div>
            
            <div class="text-center pt-2">
              <button 
                type="button"
                on:click={goToRegister}
                class="text-gray1 font-bold text-sm hover:text-lime transition-colors duration-200 cursor-pointer"
              >
                Need to register?
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
  
  <footer class="p-4 footer-fade {isLoaded ? 'loaded' : ''}">
    <p class="text-gray2 text-xs">Copyright©{currentYear} Produkt</p>
  </footer>
</div>

<style>
  .fade-in { opacity: 0; transform: translateY(20px); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
  .fade-in.loaded { opacity: 1; transform: translateY(0); }
  .header-fade { opacity: 0; transform: translateY(-10px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; transition-delay: 0.1s; }
  .header-fade.loaded { opacity: 1; transform: translateY(0); }
  .header-fade.no-animation { opacity: 1; transform: translateY(0); transition: none; }
  .footer-fade { opacity: 0; transform: translateY(10px); transition: opacity 0.5s ease-out, transform 0.5s ease-out; transition-delay: 0.3s; }
  .footer-fade.loaded { opacity: 1; transform: translateY(0); }
</style>