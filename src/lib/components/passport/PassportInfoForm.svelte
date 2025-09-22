<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Person } from '$lib/types/events';
	import type { PassportInfo } from '$lib/types/passport';
	import { countries } from '$lib/utils/passport/countries';
	import { formatDateInput } from '$lib/utils/passport/modalUtils';
	export let currentPerson: Person | undefined;
	export let currentPassportInfo: PassportInfo | undefined;

	const dispatch = createEventDispatcher();
	// Country dropdown states
	let showCountryDropdown = false;
	let countrySearchValue = currentPassportInfo?.country || '';
	// Validation state
	let dateOfBirthError: string | null = null;

	$: filteredCountries = countrySearchValue
		? countries.filter((country) => country.toLowerCase().includes(countrySearchValue.toLowerCase()))
		: countries;

	$: if (currentPassportInfo) {
		countrySearchValue = currentPassportInfo.country || '';
	}

	function updateField(field: string, value: any) {
		dispatch('updateField', { field, value });
	}

	function selectCountry(country: string) {
		updateField('country', country);
		showCountryDropdown = false;
		countrySearchValue = country;
	}

	function toggleCountryDropdown() {
		showCountryDropdown = !showCountryDropdown;
		if (!showCountryDropdown) {
			countrySearchValue = currentPassportInfo?.country || '';
		}
	}

	function handleDateInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const formatted = formatDateInput(input.value);
		updateField('dateOfBirth', formatted);
	}

	function validateDate(dateStr: string | undefined) {
		dateOfBirthError = null;
		if (!dateStr || dateStr.trim() === '') return;

		const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
		if (!dateRegex.test(dateStr)) {
			dateOfBirthError = 'Date must be in YYYY-MM-DD format.';
			return;
		}
		const date = new Date(dateStr);
		const now = new Date();
		if (isNaN(date.getTime()) || date > now) {
			dateOfBirthError = 'Please enter a valid past date.';
			return;
		}
	}

	function isFieldVerified(fieldName: keyof NonNullable<PassportInfo['fieldsVerified']>): boolean {
		return currentPassportInfo?.fieldsVerified?.[fieldName] !== false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			event.target &&
			(event.target as Element).closest &&
			!(event.target as Element).closest('.country-dropdown-container')
		) {
			showCountryDropdown = false;
			countrySearchValue = currentPassportInfo?.country || '';
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="space-y-3">
	<h4 class="text-base font-bold text-white">Passport Information</h4>

	<div class="space-y-3">
		<div>
			<label for="given-names-{currentPerson?.id}" class="block text-xs font-bold text-lime mb-1">Given Names</label>
			<input
				id="given-names-{currentPerson?.id}"
				type="text"
				class="w-full bg-transparent border rounded-full px-3 py-2 text-white text-sm placeholder-gray2 focus:outline-none focus:ring-1 {isFieldVerified(
					'givenName'
				)
					? 'border-lime focus:border-lime focus:ring-lime'
					: 'border-red-500 focus:border-red-500 focus:ring-red-500'}"
				placeholder="Enter given names"
				value={currentPassportInfo?.givenName || ''}
				on:input={(e) => updateField('givenName', e.currentTarget.value)}
			/>
		</div>

		<div>
			<label for="last-names-{currentPerson?.id}" class="block text-xs font-bold text-lime mb-1">Last Names</label>
			<input
				id="last-names-{currentPerson?.id}"
				type="text"
				class="w-full bg-transparent border rounded-full px-3 py-2 text-white text-sm placeholder-gray2 focus:outline-none focus:ring-1 {isFieldVerified(
					'lastName'
				)
					? 'border-lime focus:border-lime focus:ring-lime'
					: 'border-red-500 focus:border-red-500 focus:ring-red-500'}"
				placeholder="Enter last names"
				value={currentPassportInfo?.lastName || ''}
				on:input={(e) => updateField('lastName', e.currentTarget.value)}
			/>
		</div>

		<div>
			<label for="date-of-birth-{currentPerson?.id}" class="block text-xs font-bold text-lime mb-1">Date of Birth</label>
			<input
				id="date-of-birth-{currentPerson?.id}"
				type="text"
				class="w-full bg-transparent border rounded-full px-3 py-2 text-white text-sm placeholder-gray2 focus:outline-none focus:ring-1 {isFieldVerified(
					'dateOfBirth'
				) && !dateOfBirthError
					? 'border-lime focus:border-lime focus:ring-lime'
					: 'border-red-500 focus:border-red-500 focus:ring-red-500'}"
				placeholder="Enter date YYYY-MM-DD"
				value={currentPassportInfo?.dateOfBirth || ''}
				on:input={handleDateInput}
				on:blur={(e) => validateDate(e.currentTarget.value)}
				maxlength="10"
				pattern="\d{4}-\d{2}-\d{2}"
			/>
			{#if dateOfBirthError}
				<p class="text-xs text-red-500 mt-1 pl-3">{dateOfBirthError}</p>
			{/if}
		</div>

		<div class="country-dropdown-container relative">
			<label for="country-{currentPerson?.id}" class="block text-xs font-bold text-lime mb-1">Country</label>
			<div class="relative">
				<input
					id="country-{currentPerson?.id}"
					type="text"
					class="w-full bg-transparent border rounded-full px-3 py-2 pr-8 text-white text-sm placeholder-gray2 focus:outline-none focus:ring-1 cursor-pointer {isFieldVerified(
						'country'
					)
						? 'border-lime focus:border-lime focus:ring-lime'
						: 'border-red-500 focus:border-red-500 focus:ring-red-500'}"
					placeholder="Select or search country"
					bind:value={countrySearchValue}
					on:focus={() => (showCountryDropdown = true)}
					on:input={() => (showCountryDropdown = true)}
				/>
				<button
					type="button"
					class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer"
					on:click={toggleCountryDropdown}
					aria-label="Toggle country dropdown"
				>
					<svg
						class="w-3.5 h-3.5 text-lime transition-transform {showCountryDropdown ? 'rotate-180' : ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>
			</div>

			{#if showCountryDropdown}
				<div
					class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
				>
					{#each filteredCountries as country}
						<button
							type="button"
							class="w-full px-3 py-2 text-left text-white text-sm hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
							on:click={() => selectCountry(country)}
						>
							{country}
						</button>
					{:else}
						<div class="px-3 py-2 text-center text-gray2 text-sm">No countries found</div>
					{/each}
				</div>
			{/if}
		</div>

		<div>
			<label for="passport-number-{currentPerson?.id}" class="block text-xs font-bold text-lime mb-1">Passport Number</label>
			<input
				id="passport-number-{currentPerson?.id}"
				type="text"
				class="w-full bg-transparent border rounded-full px-3 py-2 text-white text-sm placeholder-gray2 focus:outline-none focus:ring-1 {isFieldVerified(
					'passportNumber'
				)
					? 'border-lime focus:border-lime focus:ring-lime'
					: 'border-red-500 focus:border-red-500 focus:ring-red-500'}"
				placeholder="Enter passport number"
				value={currentPassportInfo?.passportNumber || ''}
				on:input={(e) => updateField('passportNumber', e.currentTarget.value)}
			/>
		</div>
	</div>
</div>