<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import TourDatePicker from '$lib/components/sultanshepard/tour/TourDatePicker.svelte';
	import { createTourDate, updateTourDate, deleteTourDate } from '$lib/services/tourService';
	import type { SSTourDate, SSTourDateAddress } from '$lib/types/tour';
	import { TOUR_DATE_TYPES } from '$lib/types/tour';
	import { initUserSettings, typeColors } from '$lib/stores/userSettings';

	export let isOpen = false;
	export let tourId: string;
	export let tourDate: SSTourDate | null = null;
	export let initialType = 'Tour Date';
	export let tourStartDate = '';
	export let tourEndDate = '';
	// All existing dates for the tour — used to compute blocking rules
	export let bookedDates: string[] = [];
	// Dates that already have a Tour Break — nothing else can share those
	export let tourBreakDates: string[] = [];

	const dispatch = createEventDispatcher();

	let loading = false;
	let showDeleteConfirm = false;

	let addressObj: SSTourDateAddress | null = null;
	let venue = '';
	let date = '';
	let currentType = 'Tour Date';

	let notes = '';

	let searchInputValue = '';
	let predictions: any[] = [];
	let showPredictions = false;

	let AutocompleteSuggestion: any = null;
	let AutocompleteSessionToken: any = null;
	let sessionToken: any = null;

	// Types that have no location
	const NO_LOCATION_TYPES = ['Travel Day', 'Tour Break'];
	$: isNoLocation = NO_LOCATION_TYPES.includes(currentType);

	// Blocking rules:
	// - Tour Break: blocked on any day that already has ANY event
	// - All other types: only blocked on days that already have a Tour Break
	//   (because nothing can share a day with a Tour Break)
	// - When editing, exclude the current date from the blocked list so it
	//   doesn't block itself
	$: ownDate = tourDate?.date ?? null;

	$: effectiveBookedDates = (() => {
		if (currentType === 'Tour Break') {
			// Tour Break can't share with any other date
			return bookedDates.filter((d) => d !== ownDate);
		} else {
			// All other types: only blocked by existing Tour Breaks
			return tourBreakDates.filter((d) => d !== ownDate);
		}
	})();

	$: if (isNoLocation) {
		addressObj = null;
		searchInputValue = '';
		predictions = [];
		showPredictions = false;
	}

	$: isFormValid = isNoLocation ? !!(date && venue) : !!(date && venue && addressObj);

	onMount(() => {
		initUserSettings();
	});

	$: colors = $typeColors;
	function getTypeColor(type: string) {
		return colors[type] || colors['Tour Date'] || '#E1FF00';
	}

	let wasOpen = false;

	$: if (isOpen && !wasOpen) {
		wasOpen = true;
		if (tourDate) {
			notes = tourDate.notes || '';
			date = tourDate.date;
			venue = tourDate.venue;
			currentType = tourDate.type || 'Tour Date';
			if (!NO_LOCATION_TYPES.includes(currentType)) {
				addressObj = typeof tourDate.address === 'object' ? tourDate.address : null;
				searchInputValue = addressObj?.full_address || tourDate.venue || '';
			} else {
				addressObj = null;
				searchInputValue = '';
			}
		} else {
			resetForm();
			currentType = initialType;
		}
		showDeleteConfirm = false;
		setTimeout(loadGoogleMaps, 100);
	} else if (!isOpen && wasOpen) {
		wasOpen = false;
	}

	const GOOGLE_MAPS_API_KEY =
		import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'YOUR_GOOGLE_MAPS_API_KEY';

	function loadGoogleMaps() {
		if (typeof window !== 'undefined') {
			const win = window as any;
			if (win.google?.maps?.importLibrary) {
				initGooglePlaces();
			} else if (!document.querySelector('#google-maps-script')) {
				win.__initGooglePlacesCallback = initGooglePlaces;
				const script = document.createElement('script');
				script.id = 'google-maps-script';
				script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&v=weekly&loading=async&callback=__initGooglePlacesCallback`;
				script.async = true;
				script.defer = true;
				document.head.appendChild(script);
			}
		}
	}

	async function initGooglePlaces() {
		try {
			const win = window as any;
			const placesLib = await win.google.maps.importLibrary('places');
			AutocompleteSuggestion = placesLib.AutocompleteSuggestion;
			AutocompleteSessionToken = placesLib.AutocompleteSessionToken;
			sessionToken = new AutocompleteSessionToken();
		} catch (error) {
			console.error('❌ [Google] Failed to load Google Places library:', error);
		}
	}

	async function handleSearchInput() {
		addressObj = null;
		if (!searchInputValue.trim() || !AutocompleteSuggestion) {
			predictions = [];
			showPredictions = false;
			return;
		}
		try {
			const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
				input: searchInputValue,
				sessionToken
			});
			if (suggestions && suggestions.length > 0) {
				predictions = suggestions.map((s: any) => s.placePrediction).filter(Boolean);
				showPredictions = true;
			} else {
				predictions = [];
				showPredictions = false;
			}
		} catch (error) {
			console.error('❌ [Search] Error fetching predictions:', error);
			predictions = [];
			showPredictions = false;
		}
	}

	async function selectPrediction(prediction: any) {
		try {
			searchInputValue = prediction.text?.text || prediction.description || '';
			showPredictions = false;
			predictions = [];

			const place = prediction.toPlace();
			await place.fetchFields({
				fields: ['displayName', 'formattedAddress', 'location', 'addressComponents']
			});

			let city = '',
				country = '',
				country_code = '';
			for (const component of place.addressComponents || []) {
				const types = component.types || [];
				if (
					types.includes('locality') ||
					types.includes('postal_town') ||
					types.includes('administrative_area_level_2')
				) {
					if (!city) city = component.longText || '';
				}
				if (types.includes('country')) {
					country = component.longText || '';
					country_code = component.shortText || '';
				}
			}

			addressObj = {
				full_address: place.formattedAddress || '',
				city,
				country,
				lat: place.location ? place.location.lat() : 0,
				lng: place.location ? place.location.lng() : 0,
				country_code
			};

			const placeName = place.displayName
				? typeof place.displayName === 'object'
					? place.displayName.text
					: place.displayName
				: '';
			if (!venue) venue = placeName || prediction.structuredFormat?.mainText?.text || '';
			searchInputValue = placeName
				? `${placeName}, ${place.formattedAddress}`
				: place.formattedAddress;
			sessionToken = new AutocompleteSessionToken();
		} catch (error) {
			console.error('❌ [Select] Error fetching place details:', error);
		}
	}

	function closePredictions(e: MouseEvent) {
		if (showPredictions && !(e.target as Element).closest('.location-search-container')) {
			showPredictions = false;
		}
	}

	function resetForm() {
		date = '';
		venue = '';
		addressObj = null;
		searchInputValue = '';
		loading = false;
		notes = '';
	}

	function closeModal() {
		dispatch('close');
		showDeleteConfirm = false;
		if (!isEditMode) resetForm();
	}

	$: isEditMode = !!tourDate;

	async function handleSave() {
		if (!isFormValid || loading) return;

		const addressToSave: SSTourDateAddress = isNoLocation
			? { full_address: '', city: '', country: '', lat: 0, lng: 0, country_code: '' }
			: addressObj!;

		try {
			loading = true;
			if (isEditMode && tourDate) {
				const updatedDate = await updateTourDate(tourDate.id, {
					date,
					venue,
					notes,
					address: addressToSave,
					type: currentType
				});
				dispatch('save', { date: updatedDate });
			} else {
				const newDate = await createTourDate({
					tour_id: tourId,
					date,
					venue,
					notes,
					address: addressToSave,
					type: currentType
				});
				dispatch('save', { date: newDate });
			}
			closeModal();
		} catch (error) {
			console.error('Error saving date:', error);
			alert('Failed to save date');
		} finally {
			loading = false;
		}
	}

	async function handleDelete() {
		if (!tourDate) return;
		try {
			loading = true;
			await deleteTourDate(tourDate.id);
			dispatch('delete', { id: tourDate.id });
			closeModal();
		} catch (error) {
			console.error('Error deleting date:', error);
		} finally {
			loading = false;
		}
	}
</script>

<svelte:window on:click={closePredictions} />

<Modal
	bind:isOpen
	title={isEditMode ? `Edit ${currentType}` : `Add ${currentType}`}
	maxWidth="max-w-2xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-6">
		<!-- TYPE TABS -->
		<div
			class="flex items-center gap-1.5 p-1.5 bg-gray1/30 border border-gray1 rounded-full overflow-x-auto custom-scrollbar-x"
		>
			{#each TOUR_DATE_TYPES as t}
				{@const isActive = currentType === t}
				<button
					type="button"
					aria-pressed={isActive}
					class="flex-1 min-w-fit px-3 py-2 rounded-full text-[11px] font-black uppercase tracking-wide whitespace-nowrap cursor-pointer transition-all duration-200 border-2 flex items-center justify-center gap-1.5
                        {isActive
						? 'text-[#1a1a1a] scale-[1.03] shadow-lg'
						: 'text-white/70 hover:text-white bg-transparent hover:bg-white/5'}"
					style="
                        background-color: {isActive ? getTypeColor(t) : 'transparent'};
                        border-color: {isActive ? getTypeColor(t) : 'transparent'};
                    "
					on:click={() => (currentType = t)}
				>
					<span
						class="w-2 h-2 rounded-full shrink-0 transition-colors"
						style="background-color: {isActive ? '#1a1a1a' : getTypeColor(t)};"
					></span>
					{t}
				</button>
			{/each}
		</div>

		<!-- NAME / INFO + DATE row -->
		<div class="flex gap-4">
			<div class="w-1/2">
				<p class="font-normal text-lime mb-2">
					{#if currentType === 'Tour Date'}
						Venue Name
					{:else if isNoLocation}
						{currentType} Info
					{:else}
						{currentType} Location
					{/if}
				</p>
				<input
					type="text"
					class="w-full bg-gray1 rounded-3xl px-4 h-[50px] text-white placeholder-gray2 outline-none focus:outline-none focus:ring-0 shadow-none m-0 appearance-none border-2 border-transparent"
					placeholder={currentType === 'Tour Date'
						? 'Enter venue name'
						: isNoLocation
							? `Enter ${currentType.toLowerCase()} details`
							: `Enter ${currentType.toLowerCase()} location`}
					bind:value={venue}
				/>
				<!-- Full width row: Notes -->
				<div class="mt-2">
					<p class="font-normal text-lime mb-2">
						Notes <span class="text-gray2 font-normal text-xs">(optional)</span>
					</p>
					<input
						type="text"
						class="w-full bg-gray1 rounded-3xl px-4 h-[50px] text-white placeholder-gray2 outline-none focus:outline-none focus:ring-0 border-2 border-transparent text-sm"
						placeholder="Add any notes for this date"
						bind:value={notes}
					/>
				</div>
			</div>
			<div class="w-1/2 relative z-50">
				<p class="font-normal text-lime mb-2">
					{currentType === 'Tour Date' ? 'Show Date' : `${currentType} Date`}
				</p>
				<TourDatePicker
					bind:value={date}
					variant="input"
					width="w-full"
					height="h-[50px]"
					{tourStartDate}
					{tourEndDate}
					bookedDates={effectiveBookedDates}
					placeholder="Select Date"
				/>
			</div>
		</div>

		<!-- LOCATION SECTION — hidden for Travel Day / Tour Break -->
		{#if !isNoLocation}
			<div class="relative z-40">
				<div class="flex items-center justify-between mb-2">
					<p class="font-normal text-lime">Search Location</p>
					{#if addressObj}
						<span
							class="text-[10px] text-lime font-bold uppercase tracking-wider bg-lime/10 px-2 py-0.5 rounded-md flex items-center gap-1"
						>
							<svg
								class="w-3 h-3"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg
							>
							Verified
						</span>
					{:else if searchInputValue}
						<span
							class="text-[10px] text-red-400 font-bold uppercase tracking-wider bg-red-400/10 px-2 py-0.5 rounded-md"
						>
							Must select from list
						</span>
					{/if}
				</div>

				<div class="relative location-search-container">
					<input
						type="text"
						bind:value={searchInputValue}
						on:input={handleSearchInput}
						class="w-full bg-gray1 rounded-3xl px-4 h-[50px] text-white placeholder-gray2 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 shadow-none m-0 appearance-none transition-colors border-2 {addressObj
							? 'border-lime focus:border-lime'
							: 'border-transparent focus:border-lime'}"
						placeholder="Search Google Maps for a venue"
					/>
					{#if showPredictions && predictions.length > 0}
						<div
							class="absolute top-full mt-2 left-0 w-full bg-[#1a1a1a] border border-gray1 rounded-2xl shadow-xl overflow-hidden z-[60]"
						>
							{#each predictions as pred}
								<button
									type="button"
									class="w-full text-left px-4 py-3 hover:bg-white/5 text-white text-sm border-b border-gray1/50 last:border-0 transition-colors cursor-pointer"
									on:click|preventDefault|stopPropagation={() => selectPrediction(pred)}
								>
									<div class="font-bold">
										{pred.structuredFormat?.mainText?.text || pred.text?.text}
									</div>
									{#if pred.structuredFormat?.secondaryText?.text}
										<div class="text-xs text-gray2">{pred.structuredFormat.secondaryText.text}</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
				<p class="text-[11px] text-gray2 mt-1.5 ml-2">
					Type and select a location from the dropdown to auto-fill details.
				</p>
			</div>

			<div class="space-y-4 bg-gray1/20 p-4 rounded-xl border border-gray1 relative z-10">
				<div>
					<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">Address</p>
					<input
						type="text"
						class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
						value={addressObj?.full_address || ''}
						placeholder="Select address"
						readonly
						tabindex="-1"
					/>
				</div>
				<div class="flex gap-4">
					<div class="w-1/2">
						<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">City</p>
						<input
							type="text"
							class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
							value={addressObj?.city || ''}
							placeholder="Select address"
							readonly
							tabindex="-1"
						/>
					</div>
					<div class="w-1/2">
						<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">Country</p>
						<input
							type="text"
							class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
							value={addressObj?.country || ''}
							placeholder="Select address"
							readonly
							tabindex="-1"
						/>
					</div>
				</div>
				<div class="flex gap-4">
					<div class="w-1/3">
						<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">
							Country Code
						</p>
						<input
							type="text"
							class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
							value={addressObj?.country_code || ''}
							placeholder="Select address"
							readonly
							tabindex="-1"
						/>
					</div>
					<div class="w-1/3">
						<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">Latitude</p>
						<input
							type="text"
							class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
							value={addressObj?.lat || ''}
							placeholder="Select address"
							readonly
							tabindex="-1"
						/>
					</div>
					<div class="w-1/3">
						<p class="font-normal text-gray2 text-xs mb-1.5 uppercase tracking-wide">Longitude</p>
						<input
							type="text"
							class="w-full bg-gray1/50 rounded-xl px-4 h-10 text-gray2 outline-none shadow-none m-0 border border-transparent cursor-not-allowed text-sm placeholder-gray2/30"
							value={addressObj?.lng || ''}
							placeholder="Select address"
							readonly
							tabindex="-1"
						/>
					</div>
				</div>
			</div>
		{/if}

		{#if isEditMode && showDeleteConfirm}
			<div class="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
				<div class="flex items-center gap-2 mb-2">
					<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20"
						><path
							fill-rule="evenodd"
							d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
							clip-rule="evenodd"
						/></svg
					>
					<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
				</div>
				<p class="text-red-300 text-sm mb-3">Are you sure you want to delete this date?</p>
				<div class="flex gap-2">
					<button
						type="button"
						class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
						on:click={() => (showDeleteConfirm = false)}>Cancel</button
					>
					<button
						type="button"
						class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
						disabled={loading}
						on:click={handleDelete}>{loading ? 'Deleting...' : 'Delete'}</button
					>
				</div>
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-between">
		{#if isEditMode && !showDeleteConfirm}
			<button
				type="button"
				class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
				disabled={loading}
				on:click={() => (showDeleteConfirm = true)}>Delete</button
			>
		{:else}<div></div>{/if}
		<div class="flex gap-3">
			<button
				type="button"
				class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
				on:click={closeModal}>Cancel</button
			>
			<button
				type="button"
				class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				class:bg-lime={isFormValid && !loading}
				class:text-black={isFormValid && !loading}
				class:bg-gray1={!isFormValid || loading}
				class:text-gray2={!isFormValid || loading}
				disabled={!isFormValid || loading || showDeleteConfirm}
				on:click={handleSave}
			>
				{loading ? (isEditMode ? 'Saving...' : 'Adding...') : isEditMode ? 'Save Changes' : 'Add'}
			</button>
		</div>
	</div>
</Modal>

<style>
	.custom-scrollbar-x::-webkit-scrollbar {
		height: 4px;
	}
	.custom-scrollbar-x::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar-x::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 2px;
	}
</style>
