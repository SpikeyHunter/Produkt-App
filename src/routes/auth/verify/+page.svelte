<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase.js';
  
  let status = 'Processing verification...';
  let isLoading = true;
  let isSuccess = false;
  
  onMount(async () => {
    try {
      console.log('🔍 Starting verification process...');
      console.log('Current URL:', window.location.href);
      
      // Get URL parameters from both hash and search params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const urlParams = new URLSearchParams(window.location.search);
      
      // Check for tokens in hash or search params
      const accessToken = hashParams.get('access_token') || urlParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || urlParams.get('refresh_token');
      const type = hashParams.get('type') || urlParams.get('type');
      const errorParam = hashParams.get('error') || urlParams.get('error');
      const errorDescription = hashParams.get('error_description') || urlParams.get('error_description');
      
      console.log('Extracted params:', {
        accessToken: accessToken ? 'present' : 'missing',
        refreshToken: refreshToken ? 'present' : 'missing',
        type,
        error: errorParam
      });
      
      // Handle errors from URL
      if (errorParam) {
        console.error('❌ URL error:', errorParam, errorDescription);
        status = `Verification failed: ${errorDescription || errorParam}`;
        isLoading = false;
        return;
      }
      
      // Check if this is a verification link with tokens
      if (accessToken && refreshToken) {
        console.log('✅ Found tokens, setting up session...');
        status = 'Setting up your session...';
        
        try {
          // Set the session directly with Supabase client
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (sessionError) {
            console.error('❌ Session error:', sessionError);
            status = 'Failed to establish session. Please try logging in manually.';
            isLoading = false;
            setTimeout(() => {
              goto('/?message=session_error');
            }, 3000);
            return;
          }
          
          if (sessionData.session && sessionData.user) {
            console.log('✅ Session established successfully');
            
            status = 'Email verified successfully! Redirecting to dashboard...';
            isSuccess = true;
            isLoading = false;
            
            // Clear the URL hash/params
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Send session cookies to server for server-side authentication
            try {
              await fetch('/api/auth/sync-session', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  access_token: sessionData.session.access_token,
                  refresh_token: sessionData.session.refresh_token
                })
              });
            } catch (syncError) {
              console.warn('⚠️ Could not sync session with server, but continuing:', syncError);
            }
            
            // Redirect to dashboard after 2 seconds
            setTimeout(() => {
              goto('/dashboard?verified=true');
            }, 2000);
          } else {
            console.error('❌ No session data returned');
            status = 'Verification completed, but session setup failed. Please try logging in.';
            isLoading = false;
            setTimeout(() => {
              goto('/?message=login_required');
            }, 3000);
          }
        } catch (error) {
          console.error('❌ Error during session setup:', error);
          status = 'Error setting up session. Please try logging in manually.';
          isLoading = false;
          setTimeout(() => {
            goto('/?message=session_setup_error');
          }, 3000);
        }
      } else {
        console.log('🔍 No tokens found, checking existing session...');
        
        // No verification tokens found, check if user has an existing session
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (sessionData.session?.user) {
          console.log('✅ User already has active session');
          status = 'You are already logged in! Redirecting to dashboard...';
          isSuccess = true;
          isLoading = false;
          setTimeout(() => {
            goto('/dashboard');
          }, 2000);
        } else {
          console.log('❌ No active session found');
          status = 'No verification data found. Please use the link from your email or try registering again.';
          isLoading = false;
          setTimeout(() => {
            goto('/?message=verification_link_invalid');
          }, 3000);
        }
      }
    } catch (error) {
      console.error('💥 Unexpected error during verification:', error);
      status = 'Something went wrong during verification. Please try logging in or contact support.';
      isLoading = false;
      setTimeout(() => {
        goto('/?message=verification_error');
      }, 3000);
    }
  });
  
  // Function to retry verification manually
  function retryVerification() {
    isLoading = true;
    status = 'Retrying verification...';
    // Reload the page to restart the process
    window.location.reload();
  }
</script>

<div class="min-h-screen bg-white flex flex-col items-center justify-center px-4">
  <!-- Logo -->
  <div class="mb-8">
    <img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-8" />
  </div>
  
  <!-- Status Card -->
  <div class="bg-white rounded-2xl p-8 shadow-lg text-center max-w-md w-full">
    <!-- Loading spinner or status icon -->
    <div class="mb-6">
      {#if isLoading}
        <!-- Spinning loader -->
        <div class="inline-block w-8 h-8 border-4 border-gray2 border-t-lime rounded-full animate-spin"></div>
      {:else if isSuccess}
        <!-- Success check icon -->
        <div class="inline-flex w-8 h-8 bg-lime rounded-full items-center justify-center">
          <svg class="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
          </svg>
        </div>
      {:else}
        <!-- Error icon -->
        <div class="inline-flex w-8 h-8 bg-gray2 rounded-full items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </div>
      {/if}
    </div>
    
    <!-- Status message -->
    <h1 class="text-2xl font-bold text-gray1 mb-2">Email Verification</h1>
    <p class="text-gray2 text-sm leading-relaxed mb-4">{status}</p>
    
    <!-- Additional info for success -->
    {#if isSuccess}
      <div class="mt-4 p-3 bg-gray3 rounded-lg">
        <p class="text-gray1 text-xs">Your account is ready to use! You'll be redirected to your dashboard shortly.</p>
      </div>
    {:else if !isLoading}
      <!-- Retry button for failed verification -->
      <div class="mt-4 space-y-2">
        <button 
          on:click={retryVerification}
          class="w-full bg-lime text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-lime/90 transition-colors"
        >
          Retry Verification
        </button>
        <button 
          on:click={() => goto('/')}
          class="w-full bg-gray3 text-gray1 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray3/80 transition-colors"
        >
          Back to Login
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>