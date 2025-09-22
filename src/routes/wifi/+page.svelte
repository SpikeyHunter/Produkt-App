<!-- src/routes/wifi/+page.svelte - Clean captive portal -->
<script lang="ts">
  import { onMount } from 'svelte';
  
  interface FormData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }

  let formData: FormData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  };

  let isSubmitting = false;
  let errorMessage = '';
  let language: 'fr' | 'en' = 'fr';
  let isDarkMode = false;

  // Your Google Apps Script Web App URL
  const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzV4nNB_28ln5pCXSpjrw_kbqCww2DwiVEMJM9NFAg_zVCmRIIeqE6S8yKqMtqggo5HJg/exec';

  // Translations
  const translations = {
    fr: {
      title: 'Bienvenue au New City Gas',
      subtitle: 'Pour vous connecter au WiFi, veuillez remplir les informations suivantes',
      firstName: 'Prénom',
      lastName: 'Nom de famille',
      email: 'Adresse courriel',
      phone: 'Numéro de téléphone',
      optional: '(Optionnel)',
      required: '*',
      connect: 'Se connecter au WiFi',
      connecting: 'Connexion en cours...',
      terms: 'En vous connectant, vous acceptez nos conditions d\'utilisation',
      errors: {
        required: 'Veuillez remplir tous les champs obligatoires',
        email: 'Veuillez entrer une adresse courriel valide',
        phone: 'Veuillez entrer un numéro de téléphone valide'
      },
      placeholders: {
        firstName: 'Entrez votre prénom',
        lastName: 'Entrez votre nom de famille',
        email: 'Entrez votre adresse courriel',
        phone: 'Entrez votre numéro de téléphone'
      }
    },
    en: {
      title: 'Welcome to New City Gas',
      subtitle: 'To connect to WiFi, please fill in the following information',
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email Address',
      phone: 'Phone Number',
      optional: '(Optional)',
      required: '*',
      connect: 'Connect to WiFi',
      connecting: 'Connecting...',
      terms: 'By connecting, you agree to our terms of service',
      errors: {
        required: 'Please fill in all required fields',
        email: 'Please enter a valid email address',
        phone: 'Please enter a valid phone number'
      },
      placeholders: {
        firstName: 'Enter your first name',
        lastName: 'Enter your last name',
        email: 'Enter your email address',
        phone: 'Enter your phone number'
      }
    }
  };

  $: t = translations[language];

  function handleSubmit() {
    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email) {
      errorMessage = t.errors.required;
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      errorMessage = t.errors.email;
      return;
    }

    // Phone validation (if provided)
    if (formData.phone) {
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
        errorMessage = t.errors.phone;
        return;
      }
    }

    isSubmitting = true;
    errorMessage = '';

    // Create and submit form to Google Sheets
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = GOOGLE_SCRIPT_URL;
    form.target = '_blank';
    form.style.display = 'none';

    // Add form fields
    const fields: Record<string, string> = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      language: language,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    Object.keys(fields).forEach(key => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = fields[key] || '';
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
    
    // Clean up
    setTimeout(() => {
      if (document.body.contains(form)) {
        document.body.removeChild(form);
      }
    }, 2000);

    // Redirect to success URL after delay
    setTimeout(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const successUrl = urlParams.get('url') || 'http://captive.apple.com/hotspot-detect.html';
      window.location.href = successUrl;
    }, 3000);
  }

  function toggleLanguage() {
    language = language === 'fr' ? 'en' : 'fr';
  }

  onMount(() => {
    // Check for dark mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    isDarkMode = mediaQuery.matches;
    
    mediaQuery.addEventListener('change', (e) => {
      isDarkMode = e.matches;
    });

    // Auto-focus first input on desktop
    const firstInput = document.querySelector('input[name="firstName"]') as HTMLInputElement;
    if (firstInput && window.innerWidth > 768) {
      firstInput.focus();
    }
  });
</script>

<svelte:head>
  <title>WiFi Access - New City Gas</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
</svelte:head>

<main class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 transition-colors duration-300">
  <div class="w-full max-w-md">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700 transition-colors duration-300">
      
      <!-- Language Toggle -->
      <div class="flex justify-end mb-6">
        <button
          on:click={toggleLanguage}
          class="flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 text-sm"
        >
          <span class="text-gray-600 dark:text-gray-300">{language === 'fr' ? 'EN' : 'FR'}</span>
          <svg class="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path>
          </svg>
        </button>
      </div>

      <!-- Header with Logo -->
      <div class="text-center mb-8">
        <!-- Logo -->
        <div class="mb-6">
          <img 
            src="/images/NCG_LOGO2_BLANC.png" 
            alt="New City Gas Logo" 
            class={`h-16 mx-auto object-contain transition-all duration-300 ${isDarkMode ? 'brightness-100' : 'brightness-0'}`}
            style={isDarkMode ? '' : 'filter: invert(1) brightness(0);'}
            on:error={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              const fallback = img.nextElementSibling as HTMLElement;
              img.style.display = 'none';
              if (fallback) {
                fallback.style.display = 'block';
              }
            }}
          />
          <!-- Fallback text logo -->
          <div class="hidden">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">NEW CITY GAS</h1>
          </div>
        </div>
        
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">{t.title}</h1>
        <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">{t.subtitle}</p>
      </div>

      <!-- Error Message -->
      {#if errorMessage}
        <div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div class="flex">
            <svg class="w-5 h-5 text-red-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path>
            </svg>
            <p class="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
          </div>
        </div>
      {/if}

      <!-- Form -->
      <form on:submit|preventDefault={handleSubmit} class="space-y-4">
        <!-- First Name -->
        <div>
          <label for="firstName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.firstName} <span class="text-red-500">{t.required}</span>
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            bind:value={formData.firstName}
            required
            autocomplete="given-name"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={t.placeholders.firstName}
            disabled={isSubmitting}
          />
        </div>

        <!-- Last Name -->
        <div>
          <label for="lastName" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.lastName} <span class="text-red-500">{t.required}</span>
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            bind:value={formData.lastName}
            required
            autocomplete="family-name"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={t.placeholders.lastName}
            disabled={isSubmitting}
          />
        </div>

        <!-- Email -->
        <div>
          <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.email} <span class="text-red-500">{t.required}</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            bind:value={formData.email}
            required
            autocomplete="email"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={t.placeholders.email}
            disabled={isSubmitting}
          />
        </div>

        <!-- Phone -->
        <div>
          <label for="phone" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t.phone} <span class="text-gray-400 dark:text-gray-500">{t.optional}</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            bind:value={formData.phone}
            autocomplete="tel"
            class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-base placeholder-gray-400 dark:placeholder-gray-500"
            placeholder={t.placeholders.phone}
            disabled={isSubmitting}
          />
        </div>

        <!-- Submit Button -->
        <div class="mt-6">
          <button
            type="submit"
            disabled={isSubmitting}
            class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-4 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2 text-base shadow-lg"
          >
            {#if isSubmitting}
              <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{t.connecting}</span>
            {:else}
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"></path>
              </svg>
              <span>{t.connect}</span>
            {/if}
          </button>
        </div>
      </form>

      <!-- Footer -->
      <div class="mt-6 text-center">
        <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{t.terms}</p>
      </div>
    </div>
  </div>
</main>