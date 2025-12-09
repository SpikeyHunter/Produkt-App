<script lang="ts">
	import { onMount } from 'svelte';

	const CONTROLLER_URL = 'http://login.serviceswifi.com/cgi-bin/login';
	const RADIUS_USER = 'corpo';
	const RADIUS_PASS = 'guest';

	let formData = {
		first_name: '',
		last_name: '',
		email: '',
		phone: '',
		tos: false,
	};

	let urlParams: any = {};
	let showTosModal = false;
	let isSubmitting = false;
	let currentLang: 'fr' | 'en' = 'fr'; // Default to French

	// Translation Dictionary
	const t = {
		fr: {
			welcome: 'Bienvenue au Corpo - New City Gas',
			subtitle: 'Veuillez remplir vos informations pour vous connecter au réseau WiFi.',
			fname: 'Prénom *',
			lname: 'Nom *',
			email: 'Adresse courriel *',
			phone: 'Numéro de téléphone',
            // NEW TEXT PARTS
			termStart: "J'ai lu et j'accepte les",
			termLink: "Conditions d'utilisation",
			termMid: "du service Wi-Fi de New City Gas ainsi que les conditions contenues dans notre",
            privacyLink: "Politique de confidentialité",
            termEnd: "Je consens également à recevoir des infolettres de New City Gas, incluant ses événements et activités. Vous pouvez vous désabonner en tout temps en cliquant sur le lien de désabonnement au bas des courriels reçus.",
			connect: 'Se Connecter',
			connecting: 'Connexion en cours...',
			modalTitle: 'Conditions & Confidentialité',
			close: 'Fermer'
		},
		en: {
			welcome: 'Welcome to Corpo - New City Gas',
			subtitle: 'Please fill in your information to connect to the WiFi network.',
			fname: 'First Name *',
			lname: 'Last Name *',
			email: 'Email Address *',
			phone: 'Phone Number',
            // NEW TEXT PARTS
			termStart: 'I have read and agree to the',
			termLink: 'Terms of Service',
			termMid: 'of use for New City Gas Wi-Fi service as well as the terms contained in our',
            privacyLink: 'Privacy Policy',
            termEnd: 'I also consent to receive newsletters from New City Gas, including its events and activities. You may unsubscribe at any time by clicking the unsubscribe link at the bottom of the received emails.',
			connect: 'Connect',
			connecting: 'Connecting...',
			modalTitle: 'Terms & Privacy',
			close: 'Close'
		}
	};

	// Validation Regex
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	// Allows +, spaces, -, (, ), and digits. Must have at least 7 digits to be considered "real".
	const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im;

	// Reactive Validation Checks
	$: isEmailValid = emailRegex.test(formData.email);
	// Phone is optional, but if entered, must be valid
	$: isPhoneValid =
		!formData.phone || (formData.phone.length > 6 && /[\d\+\-\(\)\s]+/.test(formData.phone));
	$: isValid =
		formData.first_name && formData.last_name && isEmailValid && isPhoneValid && formData.tos;

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		urlParams = Object.fromEntries(params.entries());
	});

	async function handleConnect() {
		if (!isValid) return;
		isSubmitting = true;

		const originalUrl = urlParams.url || urlParams.original_url || 'https://www.google.com';

		// Auto-format phone: remove everything except numbers
		const cleanPhone = formData.phone ? formData.phone.replace(/\D/g, '') : '';

		try {
			// Send data to our server
			await fetch('/api/guests', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					first_name: formData.first_name,
					last_name: formData.last_name,
					email: formData.email,
					phone: cleanPhone, // Sent as pure numbers
					tos_accepted: formData.tos,
					ssid: urlParams.ssid || 'NCG-Corpo-Wifi',
					mac: urlParams.mac,
					redirect_url: originalUrl,
					language: currentLang
				})
			});
		} catch (e) {
			console.error('Logging failed, proceeding to auth', e);
		}

		// Redirect to Aruba Controller
		const targetUrl = `${CONTROLLER_URL}?cmd=authenticate&user=${RADIUS_USER}&password=${RADIUS_PASS}&url=${encodeURIComponent(originalUrl)}`;
		window.location.href = targetUrl;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') showTosModal = false;
	}

	function toggleLang(lang: 'fr' | 'en') {
		currentLang = lang;
	}
</script>

<svelte:head>
	<title>Wifi - New City Gas</title>
	<style>
		@font-face {
			font-family: 'Everett';
            /* CHANGE THIS LINE BELOW */
			src: url('/static/fonts/Everett-Regular.otf') format('opentype');
		}
		:global(body) {
			font-family: 'Everett', sans-serif;
			background-color: #1a1a1a;
		}
	</style>
</svelte:head>

<div
	class="min-h-screen bg-black/70 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden"
>
	<div class="absolute top-0 left-0 w-full h-2 bg-[#844CE5] shadow-[0_0_20px_#844CE5]"></div>

	<!-- Language Toggle -->
	<div class="absolute top-6 right-6 z-20">
		<button
			on:click={() => toggleLang(currentLang === 'fr' ? 'en' : 'fr')}
			class="px-3 py-1 rounded border border-gray2 text-sm font-medium transition-colors text-gray2 hover:text-white hover:cursor-pointer hover:border-[#844CE5]"
		>
			{currentLang === 'fr' ? 'EN' : 'FR'}
		</button>
	</div>

	<div class="w-full max-w-md z-10 flex flex-col gap-6">
		<div class="flex flex-col items-center text-center space-y-4">
			<img src="/images/NCG_LOGO3_BLANC.png" alt="New City Gas" class="h-32 object-contain mb-6" />
			<h1 class="text-2xl font-bold tracking-wide">{t[currentLang].welcome}</h1>
			<p class="text-gray2 text-sm">{t[currentLang].subtitle}</p>
		</div>

		<div class="space-y-4">
			<div class="grid grid-cols-2 gap-4">
				<input
					type="text"
					placeholder={t[currentLang].fname}
					bind:value={formData.first_name}
					class="bg-navbar border border-gray1 rounded-lg px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-[#844CE5] focus:ring-1 focus:ring-[#844CE5] transition-all duration-200"
				/>
				<input
					type="text"
					placeholder={t[currentLang].lname}
					bind:value={formData.last_name}
					class="bg-navbar border border-gray1 rounded-lg px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-[#844CE5] focus:ring-1 focus:ring-[#844CE5] transition-all duration-200"
				/>
			</div>

			<div class="relative">
				<input
					type="email"
					placeholder={t[currentLang].email}
					bind:value={formData.email}
					class="w-full bg-navbar border {formData.email && !isEmailValid
						? 'border-red-500'
						: 'border-gray1'} rounded-lg px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-[#844CE5] focus:ring-1 focus:ring-[#844CE5] transition-all duration-200"
				/>
			</div>

			<div class="relative">
				<input
					type="tel"
					placeholder={t[currentLang].phone}
					bind:value={formData.phone}
					class="w-full bg-navbar border {formData.phone && !isPhoneValid
						? 'border-red-500'
						: 'border-gray1'} rounded-lg px-4 py-3 text-white placeholder-gray2  focus:outline-none focus:border-[#844CE5] focus:ring-1 focus:ring-[#844CE5] transition-all duration-200"
				/>
			</div>

			<div class="pt-2 space-y-3">
				<label class="flex items-start gap-3 cursor-pointer group">
					<div class="relative flex items-center mt-1"> <input
							type="checkbox"
							bind:checked={formData.tos}
							class="peer h-5 w-5 min-w-[1.25rem] cursor-pointer appearance-none rounded border border-gray1 bg-navbar transition-all checked:border-[#844CE5] checked:bg-[#844CE5]"
						/>
						<svg
							class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-0 peer-checked:opacity-100 text-white"
							viewBox="0 0 14 14"
							fill="none"
						>
							<path
								d="M3 8L6 11L11 3.5"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
					</div>
					<span class="text-xs text-gray2 leading-relaxed">
						{t[currentLang].termStart}
						<button
							on:click|stopPropagation={() => (showTosModal = true)}
							class="text-[#844CE5] underline hover:text-white transition-colors"
						>
							{t[currentLang].termLink}
						</button>
                        {t[currentLang].termMid}
                        <button
							on:click|stopPropagation={() => (showTosModal = true)}
							class="text-[#844CE5] underline hover:text-white transition-colors"
						>
							{t[currentLang].privacyLink}
						</button>
                        {t[currentLang].termEnd}
					</span>
				</label>
			</div>
		</div>

		<button
			on:click={handleConnect}
			disabled={!isValid || isSubmitting}
			class="mt-4 w-full bg-[#844CE5] hover:bg-[#733bd4] disabled:bg-gray1 hover:cursor-pointer disabled:text-gray2 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg transform transition active:scale-95 text-lg uppercase tracking-wider"
		>
			{isSubmitting ? t[currentLang].connecting : t[currentLang].connect}
		</button>
	</div>

	{#if showTosModal}
		<div
			class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm focus:outline-none"
			on:click={() => (showTosModal = false)}
			on:keydown={handleKeydown}
			role="button"
			tabindex="0"
		>
			<div
				class="bg-navbar border border-gray1 w-full max-w-2xl max-h-[85vh] rounded-xl flex flex-col shadow-2xl cursor-default"
				on:click|stopPropagation
				on:keydown|stopPropagation
				role="dialog"
				aria-modal="true"
				tabindex="-1"
			>
				<div class="p-6 border-b border-gray2 flex justify-between items-center">
					<h2 class="text-xl font-bold text-white">{t[currentLang].modalTitle}</h2>
					<button on:click={() => (showTosModal = false)} class="text-gray2 hover:text-white"
						>✕</button
					>
				</div>

				<div class="p-6 overflow-y-auto text-sm text-gray3 space-y-6 leading-relaxed">
					<!-- Toggle inside modal as well for convenience -->
					<div class="flex justify-end mb-2">
						<button
							on:click={() => toggleLang(currentLang === 'fr' ? 'en' : 'fr')}
							class="text-xs px-2 py-1 rounded border border-gray2 text-gray3 hover:text-[#844CE5] hover:border-[#844CE5] transition-colors"
						>
							{currentLang === 'fr' ? 'EN' : 'FR'}
						</button>
					</div>

					{#if currentLang === 'fr'}
						<!-- FRENCH CONTENT -->
						<div>
							<h3 class="text-[#844CE5] font-bold mb-2 text-base">
								New City Gas – Conditions d’utilisation du Wi-Fi
							</h3>
							<p class="mb-4">
								En accédant à ce réseau Wi-Fi, vous acceptez de l’utiliser de manière responsable et
								conforme aux lois applicables. Il est interdit d’utiliser ce réseau pour des
								activités illégales, abusives ou nuisibles, incluant le piratage, l’accès non
								autorisé, le harcèlement, l’envoi de pourriel ou la violation de droits d’auteur.
							</p>
							<p class="mb-4">
								Ce réseau n’est pas garanti comme étant sécurisé, et New City Gas n’est pas
								responsable de toute perte, dommage ou accès non autorisé affectant votre appareil
								ou vos données.
							</p>
							<p>
								New City Gas peut suspendre ou interrompre votre accès en tout temps pour des
								raisons de sécurité ou de mauvaise utilisation.
							</p>
						</div>
						<hr class="border-gray2" />
						<div>
							<h3 class="text-[#844CE5] font-bold mb-2 text-base">
								New City Gas – Politique de confidentialité
							</h3>
							<p class="mb-4">
								Lorsque vous vous connectez au Wi-Fi de New City Gas, nous recueillons certaines
								informations personnelles, notamment votre nom, votre adresse courriel, votre numéro
								de téléphone, les identifiants de votre appareil et les horodatages de connexion.
								Ces informations sont recueillies pour offrir l’accès au réseau, assurer la sécurité
								et gérer l’utilisation du Wi-Fi.
							</p>
							<p class="mb-4">
								Vos données sont conservées pour une durée indéterminée et ne sont accessibles qu’au
								personnel autorisé. New City Gas ne vend pas vos informations à des tiers.
							</p>
							<p class="mb-4">
								Vous pouvez communiquer avec nous à <a
									href="mailto:info@newcitygas.com"
									class="text-[#844CE5] hover:underline">info@newcitygas.com</a
								> pour demander l’accès, la correction ou la suppression de vos renseignements personnels,
								ou pour toute question concernant la confidentialité ou l’utilisation des données.
							</p>
							<p>
								En utilisant ce réseau, vous consentez à la collecte, au stockage et à l’utilisation
								de vos informations telles que décrites dans cette politique de confidentialité.
							</p>
						</div>
					{:else}
						<!-- ENGLISH CONTENT -->
						<div>
							<h3 class="text-[#844CE5] font-bold mb-2 text-base">
								New City Gas – Wi-Fi Terms of Service
							</h3>
							<p class="mb-4">
								By accessing this Wi-Fi network, you agree to use it responsibly and in compliance
								with all applicable laws. You may not engage in illegal, abusive, or harmful
								activities, including hacking, unauthorized access, harassment, spam, or copyright
								infringement. This network is not guaranteed to be secure, and New City Gas is not
								responsible for any loss, damage, or unauthorized access affecting your device or
								data.
							</p>
							<p>
								New City Gas may suspend or terminate your access at any time for security or
								misuse.
							</p>
						</div>
						<hr class="border-gray2" />
						<div>
							<h3 class="text-[#844CE5] font-bold mb-2 text-base">New City Gas – Privacy Policy</h3>
							<p class="mb-4">
								When you connect to the New City Gas Wi-Fi, we collect certain personal information,
								including your name, email address, phone number, device identifiers, and connection
								timestamps. This information is collected to provide network access, maintain
								network security, and manage Wi-Fi usage.
							</p>
							<p class="mb-4">
								Your data is stored indefinitely and may only be accessed by authorized personnel.
								New City Gas does not sell your information to third parties.
							</p>
							<p class="mb-4">
								You may contact us at <a
									href="mailto:info@newcitygas.com"
									class="text-[#844CE5] hover:underline">info@newcitygas.com</a
								> to request access, correction, or deletion of your personal information, or to ask
								any questions regarding privacy or data use.
							</p>
							<p>
								By using this network, you consent to the collection, storage, and use of your
								information as described in this Privacy Policy.
							</p>
						</div>
					{/if}
				</div>

				<div class="p-4 border-t border-gray2 text-center">
					<button
						on:click={() => (showTosModal = false)}
						class="bg-[#844CE5] px-8 py-2 rounded text-white font-bold hover:bg-[#733bd4] transition"
						>{t[currentLang].close}</button
					>
				</div>
			</div>
		</div>
	{/if}
</div>
