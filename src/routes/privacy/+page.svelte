<script lang="ts">
	// Static page for Produkt Privacy Policy
</script>

<svelte:head>
	<title>Privacy Policy | Produkt</title>
</svelte:head>

<div class="h-screen w-full bg-navbar overflow-y-auto flex flex-col items-center p-6 text-white font-sans">
	
	<div class="my-auto flex flex-col items-center w-full">
		<h1 class="text-4xl font-bold mb-8 tracking-tight text-lime uppercase text-center">
			Privacy Policy
		</h1>

		<div class="max-w-3xl w-full bg-gray1/30 p-8 rounded-xl border border-gray1 backdrop-blur-sm shadow-xl mb-6">
			<p class="text-lg leading-relaxed text-gray2 text-center mb-4">
				At Produkt (4427319 Canada Inc.), your privacy is our priority. By using our services, you consent to the collection, storage, and use of your information as described below.
			</p>
			
			<hr class="my-8 border-gray1" />

			<div class="space-y-8 overflow-y-auto max-h-[40vh] min-h-[200px] pr-4 custom-scrollbar">
				<section>
					<h2 class="text-xl font-semibold text-white mb-2">1. Information Collection</h2>
					<p class="text-gray2">
						When you connect to our services, we collect certain personal information, including your name, email address, phone number, device identifiers, and connection timestamps. This information is collected to provide network access, maintain network security, and manage usage.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-white mb-2">2. Data Usage & Sharing</h2>
					<p class="text-gray2">
						Any data collected is used strictly for the functionality and security of the application. **Produkt does not sell your information to third parties.** Data is stored indefinitely and may only be accessed by authorized personnel.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-white mb-2">3. Terms of Service</h2>
					<p class="text-gray2">
						You agree to use this platform responsibly and in compliance with all applicable laws. Engaging in illegal, abusive, or harmful activities—including hacking, unauthorized access, or harassment—is strictly prohibited. 
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-white mb-2">4. Security Disclaimer</h2>
					<p class="text-gray2">
						While we implement industry-standard security measures, no network is guaranteed to be 100% secure. Produkt is not responsible for any loss, damage, or unauthorized access affecting your device or data. We reserve the right to suspend or terminate access at any time for security reasons.
					</p>
				</section>

				<section>
					<h2 class="text-xl font-semibold text-white mb-2">5. Your Rights & Contact</h2>
					<p class="text-gray2">
						You may contact us to request access, correction, or deletion of your personal information. For any questions regarding privacy or data use, please reach out to us at:
					</p>
					<p class="mt-2 font-mono text-lime">support@produkt.ca</p>
				</section>
			</div>

			<div class="mt-10 text-center">
				<a href="/" class="text-lime hover:underline font-medium px-6 py-2 border border-lime rounded-full transition-colors hover:bg-lime hover:text-black">
					Return to Login
				</a>
			</div>
		</div>
	</div>
</div>

<style>
	/* Background variable mapped from your themeStore */
	.bg-navbar {
		background-color: var(--color-navbar);
	}

	/* Target the main wrapper scrollbar */
	div::-webkit-scrollbar {
		width: 8px;
	}
	
	div::-webkit-scrollbar-thumb {
		background: var(--color-lime); /* Faded lime for main scroll */
		border-radius: 5px;
	}

	/* Custom scrollbar for the internal policy text */
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-lime);
		border-radius: 2px;
	}
</style>