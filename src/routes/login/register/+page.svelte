<svelte:head>
  <title>Register – Produkt App</title>
</svelte:head>

<script lang="ts">
  import TypebarCredentials from '$lib/components/inputs/TypebarCredentials.svelte';
  import Button from '$lib/components/buttons/Button.svelte';
  import PopupNotification from '$lib/components/modals/PopupNotification.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  
  let firstName: string = '';
  let lastName: string = '';
  let email: string = '';
  let password: string = '';
  let confirmPassword: string = '';
  let registrationCode: string = '';
  let currentYear: number = new Date().getFullYear();
  let isLoaded: boolean = false;
  let errors: string[] = [];
  let isSubmitting: boolean = false;
  
  // Popup notification state
  let showErrorPopup: boolean = false;
  let errorMessage: string = '';
  
  // Track which field was last focused for validation
  let lastFocusedField: string = '';
  
  // Reactive statement to check if form is valid
  $: isFormValid = firstName.trim() && lastName.trim() && email.trim() && 
                   password.trim() && confirmPassword.trim() && registrationCode.trim();
  
  // Trigger animation after component mounts
  onMount(() => {
    setTimeout(() => {
      isLoaded = true;
    }, 100);
  });
  
  // Validation functions
  function validateName(name: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (name.length < 2) {
      errors.push("Name must be at least 2 characters");
    }
    
    if (/\d/.test(name)) {
      errors.push("Name cannot contain digits");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
  
  function validateEmail(email: string): boolean {
    const allowedDomains = ['@produkt.ca', '@newcitygas.com'];
    return allowedDomains.some(domain => email.endsWith(domain));
  }
  
  function validatePassword(password: string): boolean {
    return password.length >= 8;
  }
  
  // Registration code validation with API call
// Registration code validation with local check (bypassing API for now)
async function validateRegistrationCode(code: string): Promise<boolean> {
  if (!code.trim()) return false;
  
  try {
    const response = await fetch('/api/validate-registration-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: code.trim() })
    });
    
    const result = await response.json();
    console.log('API registration code validation:', { code: code.trim(), isValid: result.isValid });
    return result.isValid;
  } catch (error) {
    console.error('Registration code validation error:', error);
    return false;
  }
}
  
  // Show popup error
  function showPopupError(message: string): void {
    errorMessage = message;
    showErrorPopup = true;
  }
  
  // Field validation on blur/switch
  async function validateField(fieldName: string): Promise<void> {
    const errorMsgs: string[] = [];
    
    switch (fieldName) {
      case 'firstName':
        if (firstName.trim()) {
          const validation = validateName(firstName);
          if (!validation.isValid) {
            errorMsgs.push(...validation.errors.map(err => `First ${err.toLowerCase()}`));
          }
        }
        break;
      case 'lastName':
        if (lastName.trim()) {
          const validation = validateName(lastName);
          if (!validation.isValid) {
            errorMsgs.push(...validation.errors.map(err => `Last ${err.toLowerCase()}`));
          }
        }
        break;
      case 'email':
        if (email.trim() && !validateEmail(email)) {
          errorMsgs.push("You're not allowed to register using this email");
        }
        break;
      case 'password':
        if (password.trim() && !validatePassword(password)) {
          errorMsgs.push("Password must contain at least 8 characters");
        }
        break;
      case 'confirmPassword':
        if (confirmPassword.trim() && password !== confirmPassword) {
          errorMsgs.push("Password not matching");
        }
        break;
      case 'registrationCode':
        if (registrationCode.trim()) {
          const isValid = await validateRegistrationCode(registrationCode);
          if (!isValid) {
            errorMsgs.push("Invalid registration code");
          }
        }
        break;
    }
    
    // Show each error as a separate popup
    errorMsgs.forEach((errorMsg, index) => {
      setTimeout(() => {
        showPopupError(errorMsg);
      }, index * 500);
    });
  }
  
  // Handle field focus/blur events
  async function handleFieldBlur(fieldName: string): Promise<void> {
    await validateField(fieldName);
  }
  
  // Alternative handler for input changes (fallback)
  async function handleFieldChange(fieldName: string): Promise<void> {
    // Only validate if the field has content and user moved away from it
    setTimeout(async () => {
      if (document.activeElement?.tagName !== 'INPUT') {
        await validateField(fieldName);
      }
    }, 100);
  }
  
  function clearErrors(): void {
    errors = [];
  }
  
  // Main registration handler
  async function handleRegister(): Promise<void> {
    if (!isFormValid) return;
    
    clearErrors();
    isSubmitting = true;
    
    console.log('🚀 Starting registration process...');
    
    // Validate all fields before submitting
    const validationErrors: string[] = [];
    
    const firstNameValidation = validateName(firstName);
    if (!firstNameValidation.isValid) {
      firstNameValidation.errors.forEach(err => {
        validationErrors.push(`First ${err.toLowerCase()}`);
      });
    }
    
    const lastNameValidation = validateName(lastName);
    if (!lastNameValidation.isValid) {
      lastNameValidation.errors.forEach(err => {
        validationErrors.push(`Last ${err.toLowerCase()}`);
      });
    }
    
    if (!validateEmail(email)) {
      validationErrors.push("You're not allowed to register using this email");
    }
    
    if (!validatePassword(password)) {
      validationErrors.push("Password must contain at least 8 characters");
    }
    
    if (password !== confirmPassword) {
      validationErrors.push("Password not matching");
    }
    
    // Validate registration code via API
    const isCodeValid = await validateRegistrationCode(registrationCode);
    if (!isCodeValid) {
      validationErrors.push("Invalid registration code");
    }
    
    // Show popup errors one by one if validation fails
    if (validationErrors.length > 0) {
      console.log('❌ Validation errors:', validationErrors);
      for (let i = 0; i < validationErrors.length; i++) {
        setTimeout(() => {
          showPopupError(validationErrors[i]);
        }, i * 500);
      }
      isSubmitting = false;
      return;
    }
    
    try {
      console.log('📡 Sending registration request...');
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          confirmPassword,
          registrationCode
        })
      });
      
      console.log('📡 Registration response status:', response.status);
      
      const responseText = await response.text();
      console.log('📡 Registration raw response:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse registration response:', parseError);
        showPopupError('Server returned invalid response');
        isSubmitting = false;
        return;
      }
      
      console.log('📡 Registration parsed result:', result);
      
      if (result.success) {
        console.log('✅ Registration successful!');
        showPopupError(result.message || "Registration successful! Please contact admin to verify your account.");
        setTimeout(() => {
          goto('/');
        }, 2000);
      } else {
        console.log('❌ Registration failed:', result.errors);
        const serverErrors = result.errors || ['An error occurred'];
        for (let i = 0; i < serverErrors.length; i++) {
          setTimeout(() => {
            showPopupError(serverErrors[i]);
          }, i * 500);
        }
      }
      
    } catch (error) {
      console.error('💥 Registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showPopupError('An unexpected error occurred: ' + errorMessage);
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
  
  .error-popup {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 8px 12px;
    border-radius: 6px;
    margin: 4px 0;
    font-size: 14px;
  }
</style>

<!-- Full page layout -->
<div class="min-h-screen bg-white flex flex-col">
  <!-- Popup Notification -->
  <PopupNotification bind:show={showErrorPopup} message={errorMessage} variant="white" iconType="error" />
  
  <!-- Header with logo -->
  <header class="p-4 header-fade">
    <div class="flex items-center">
      <img src="/images/ProduktXX_LOGO2.png" alt="ProduktXX" class="h-6" />
    </div>
  </header>
  
  <!-- Main content - centered -->
  <div class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-xl">
      
      <!-- Register Form Container Box -->
      <div class="bg-white rounded-2xl p-6 shadow-lg fade-in {isLoaded ? 'loaded' : ''}">
        <!-- Title Section inside box -->
        <div class="text-center space-y-1 mb-4">
          <h1 class="text-3xl font-bold text-gray1">Produkt App</h1>
          <p class="text-gray2 text-sm">Register your account</p>
        </div>
        
        <!-- Error Messages -->
        {#if errors.length > 0}
          <div class="mb-4">
            {#each errors as error}
              <div class="error-popup">{error}</div>
            {/each}
          </div>
        {/if}
        
        <div class="space-y-2">
          
          <!-- First Name & Last Name Row -->
          <div class="grid grid-cols-2 gap-4">
            <TypebarCredentials 
              variant="text"
              label="First Name"
              placeholder="enter your first name"
              bind:value={firstName}
              on:blur={() => handleFieldBlur('firstName')}
            />
            <TypebarCredentials 
              variant="text"
              label="Last Name"
              placeholder="enter your last name"
              bind:value={lastName}
              on:blur={() => handleFieldBlur('lastName')}
            />
          </div>
          
          <!-- Email Input -->
          <TypebarCredentials 
            variant="username"
            label="Email"
            placeholder="enter your email"
            bind:value={email}
            on:blur={() => handleFieldBlur('email')}
            on:input={() => handleFieldChange('email')}
          />
          
          <!-- Password Input -->
          <TypebarCredentials 
            variant="password"
            label="Password"
            placeholder="enter your password"
            bind:value={password}
            on:blur={() => handleFieldBlur('password')}
          />
          
          <!-- Confirm Password Input -->
          <TypebarCredentials 
            variant="password"
            label="Confirm Password"
            placeholder="confirm your password"
            bind:value={confirmPassword}
            on:blur={() => handleFieldBlur('confirmPassword')}
          />
          
          <!-- Registration Code Input -->
          <TypebarCredentials 
            variant="text"
            label="Registration Code"
            placeholder="enter your registration code"
            bind:value={registrationCode}
            on:blur={() => handleFieldBlur('registrationCode')}
          />
          
          <!-- Register Button -->
          <div class="pt-2 flex justify-center">
            <Button 
              variant={!isFormValid ? 'blocked' : (isSubmitting ? 'loading' : 'filled')}
              width="w-1/2 mb-0" 
              type="submit"
              disabled={!isFormValid || isSubmitting}
              on:click={handleRegister}
            >
              {isSubmitting ? 'Registering...' : 'Register'}
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