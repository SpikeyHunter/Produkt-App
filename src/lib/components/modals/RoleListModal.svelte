<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from './Modal.svelte';
	import { updateEventAdvance } from '$lib/services/eventsService.js';
	import type { EventAdvance, Person } from '$lib/types/events.js';
	import { getAccessToken } from '$lib/stores/auth';
	import { parsePassportData } from '$lib/utils/passport/modalUtils';
	export let isOpen = false;
	export let event: EventAdvance | null = null;

	const dispatch = createEventDispatcher();
	// Extended Person interface for modal use
	interface PersonWithUI extends Person {
		showDropdown: boolean;
		customRole: string;
		immigration: boolean;
	}

	// Internal state
	let people: PersonWithUI[] = [];
	let isSubmitting = false;
	// Common role options
	const roleOptions = [
		'Artist',
		'Manager',
		'Tour Manager',
		'LD',
		'VJ',
		'Sound',
		'Media',
		'Photographer',
		'Videographer',
		'Other'
	];
	// Reset form when modal opens/closes or event changes
	$: if (event && isOpen) {
		loadExistingRoles();
	}

	function loadExistingRoles() {
		if (!event?.roles) {
			people = [createEmptyPerson()];
			return;
		}

		try {
			// Parse existing roles JSON
			const existingRoles = typeof event.roles === 'string' 
				?
			JSON.parse(event.roles) 
				: event.roles;
			
			if (Array.isArray(existingRoles) && existingRoles.length > 0) {
				people = existingRoles.map((person: any): PersonWithUI => ({
					id: person.id || Math.random().toString(36).substr(2, 9),
					firstName: person.firstName || '',
					lastName: person.lastName || '',
					role: person.role || '',
					customRole: person.role === 'Other' ? '' : (person.role && !roleOptions.includes(person.role) ? person.role : ''),
					immigration: person.immigration || false,
					showDropdown: false
				}));
			} else {
				people = [createEmptyPerson()];
			}
		} catch (error) {
			console.error('Error parsing existing roles:', error);
			people = [createEmptyPerson()];
		}
	}

	function createEmptyPerson(): PersonWithUI {
		return {
			id: Math.random().toString(36).substr(2, 9),
			firstName: '',
			lastName: '',
			role: '',
			customRole: '',
			immigration: true,
			showDropdown: false
		};
	}

	function addPerson() {
		if (people.length < 20) { // Reasonable limit
			people = [...people, createEmptyPerson()];
		}
	}

	function togglePersonDropdown(personId: string) {
		people = people.map(person => ({
			...person,
			showDropdown: person.id === personId ? !person.showDropdown : false
		}));
	}

	function selectRole(personId: string, role: string) {
		people = people.map(person => 
			person.id === personId 
				? { ...person, role, showDropdown: false }
				: { ...person, showDropdown: false }
		);
	}

	function toggleImmigration(personId: string) {
		people = people.map((person) =>
			person.id === personId ? { ...person, immigration: !person.immigration } : person
		);
	}

	// Updated removePerson function
	async function removePerson(personId: string) {
		if (!event) return;
		// Find the passport info for the person being removed
		const existingPassportInfo = parsePassportData(event.passport_info);
		const passportToRemove = existingPassportInfo.find(p => p.id === personId);

		// If a passport image exists, attempt to delete it from storage
		if (passportToRemove?.passportImageUrl) {
			try {
				const token = await getAccessToken();
				if (!token) throw new Error('Authentication token not found.');

				const response = await fetch('/api/upload', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ fileUrl: passportToRemove.passportImageUrl, bucket: 'documents' })
				});
				if (!response.ok) {
					console.error('Failed to delete passport image from storage.');
				}
			} catch (error) {
				console.error('Error deleting passport image:', error);
				// Continue with data removal even if file deletion fails
			}
		}

		// Filter out the deleted person and their passport data
		const updatedPeople = people.filter(p => p.id !== personId);
		const updatedPassportInfo = existingPassportInfo.filter(p => p.id !== personId);
        
        // Check for valid people to determine role_list status
        const validPeopleCount = updatedPeople.filter(p => p.firstName.trim() && p.lastName.trim()).length;
		// Prepare the data for the database update
		const rolesData = JSON.stringify(updatedPeople);
		const passportData = JSON.stringify(updatedPassportInfo);
		const updates = {
			roles: rolesData,
			passport_info: passportData,
            role_list: validPeopleCount > 0
		};
		// Save the changes to the database
		isSubmitting = true;
		try {
			await updateEventAdvance(event.event_id, event.artist_name, updates);
			// Upon success, update the local state to reflect the changes
			dispatch('save', {
				event: { ...event, ...updates }
			});
			people = updatedPeople;
			if (people.length === 0) {
				people = [createEmptyPerson()];
			}
		} catch (error) {
			console.error('Error updating roles after person removal:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		people = [createEmptyPerson()];
		isSubmitting = false;
	}

async function handleSave() {
	if (!event) return;
	
	const validPeople = people.filter(person => 
		person.firstName.trim() && person.lastName.trim()
	);
	
	const peopleToSave = validPeople.map(person => {
		if (person.role === 'Other' && person.customRole) {
			return { ...person, role: person.customRole };
		}
		return person;
	});

	isSubmitting = true;
	try {
		const rolesData = JSON.stringify(peopleToSave);
		const updates = { 
			roles: rolesData,
			role_list: peopleToSave.length > 0
		};
		await updateEventAdvance(event.event_id, event.artist_name, updates);
		
		dispatch('save', {
			eventId: event.event_id,
			artistName: event.artist_name,
			updates,
			event: {
				...event,
				...updates
			}
		});
		
		closeModal();
	} catch (error) {
		console.error('Error saving roles:', error);
	} finally {
		isSubmitting = false;
	}
}

	// Validation
	$: validPeopleCount = people.filter(person => 
		person.firstName.trim() && person.lastName.trim()
	).length;

	$: isFormValid = validPeopleCount > 0;
	// Handle click outside dropdowns
	function handleClickOutside(event: MouseEvent) {
		// Close any open dropdowns when clicking outside
		if (event.target && (event.target as Element).closest && !(event.target as Element).closest('.dropdown-container')) {
			// Close all dropdowns
			people = people.map(person => ({ ...person, showDropdown: false }));
		}
	}

	// Get display name for a person
	function getPersonDisplayName(person: Person): string {
		const fullName = `${person.firstName} ${person.lastName}`.trim();
		return fullName || 'Unnamed Person';
	}

	// Get role display
	function getRoleDisplay(person: Person): string {
		return person.role || 'No Role';
	}
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Role List - {event?.artist_name || 'Event'}"
	maxWidth="max-w-2xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-3">
		{#if event}
			<div class="flex items-center justify-between mb-3">
				<div>
					<h3 class="text-base font-bold text-white mb-0.5">Team Members</h3>
					<p class="text-gray2 text-xs">Add people and their roles for this event</p>
				</div>
				<button
					type="button"
					class="px-3 py-1.5 bg-lime text-black rounded-full font-bold text-xs hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
					disabled={people.length >= 20}
					on:click={addPerson}
				>
					Add Person ({people.length}/20)
				</button>
			</div>

			<div class="space-y-2">
				{#each people as person, index (person.id)}
					<div class="border border-gray1 rounded-lg p-2.5 bg-gray1/20">
						<div class="flex items-center gap-2.5">
							<div class="flex-shrink-0 w-6 h-6 bg-lime text-black rounded-full flex items-center justify-center font-bold text-xs">
								{index + 1}
							</div>

							<div class="flex-1 min-w-0">
								<input
									id="firstName-{person.id}"
									type="text"
									class="w-full bg-transparent border border-lime rounded-full px-3 py-1.5 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime text-sm"
									placeholder="Enter first name"
									bind:value={person.firstName}
								/>
							</div>

							<div class="flex-1 min-w-0">
								<input
									id="lastName-{person.id}"
									type="text"
									class="w-full bg-transparent border border-lime rounded-full px-3 py-1.5 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 
focus:ring-lime text-sm"
									placeholder="Enter last name"
									bind:value={person.lastName}
								/>
							</div>

							<div class="dropdown-container relative w-36">
								{#if person.role === 'Other'}
									<div class="relative">
										<input
											type="text"
											class="w-full bg-transparent border border-lime rounded-full px-3 py-0.5 pr-8 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime text-sm"
											placeholder="Enter role"
											bind:value={person.customRole}
										/>
										<button
											type="button"
											class="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer"
											on:click={() => togglePersonDropdown(person.id)}
											aria-label="Toggle dropdown"
										>
											<svg 
												class="w-3 h-3 text-lime transition-transform {person.showDropdown ?
'rotate-180' : ''}" 
												viewBox="0 0 24 24" 
												fill="none" 
												stroke="currentColor" 
												stroke-width="2"
											>
												<path d="M6 9l6 6 6-6"/>
											</svg>
										</button>
									</div>
								{:else}
									<button
										type="button"
										class="w-full bg-transparent border border-lime rounded-full px-3 py-1.5 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer text-sm"
										on:click={() => togglePersonDropdown(person.id)}
									>
										<span class={person.role ? 'text-white' : 'text-gray2'}>
											{person.role || 'Select role'}
										</span>
										<svg 
											class="w-3 h-3 text-lime transition-transform {person.showDropdown ?
'rotate-180' : ''}" 
											viewBox="0 0 24 24" 
											fill="none" 
											stroke="currentColor" 
											stroke-width="2"
										>
											<path d="M6 9l6 6 6-6"/>
										</svg>
									</button>
								{/if}
								
								{#if person.showDropdown}
									<div class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-50">
										{#each roleOptions as option}
											<button
												type="button"
												class="w-full px-3 py-2 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0 text-sm"
												on:click={() => selectRole(person.id, option)}
											>
												{option}
											</button>
										{/each}
									</div>
								{/if}
							</div>

							<div class="flex-shrink-0">
								<button
									type="button"
									class="flex items-center justify-center w-6 h-6 rounded-full transition-colors cursor-pointer"
									class:text-lime={person.immigration}
									class:text-gray-500={!person.immigration}
									aria-label="Toggle passport requirement"
									title="Toggle passport requirement"
									on:click={() => toggleImmigration(person.id)}
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										viewBox="0 0 24 24"
										fill="currentColor"
										class="w-5 h-5"
									>
										<path
											fill-rule="evenodd"
											d="M4.5 3.75a3 3 0 0 0-3 3v10.5a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3V6.75a3 3 0 0 0-3-3h-15Zm4.125 3a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Zm-3.873 8.703a4.126 4.126 0 0 1 7.746 0 .75.75 0 0 1-.351.92 7.47 7.47 0 0 1-3.522.877 7.47 7.47 0 0 1-3.522-.877.75.75 0 0 1-.351-.92ZM15 8.25a.75.75 0 0 0 0 1.5h3.75a.75.75 0 0 0 0-1.5H15ZM14.25 12a.75.75 0 0 1 .75-.75h3.75a.75.75 0 0 1 0 1.5H15a.75.75 0 0 1-.75-.75Zm.75 2.25a.75.75 0 0 0 0 1.5h3.75a.75.75 
0 0 0 0-1.5H15Z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							</div>

							<div class="flex-shrink-0">
								<button
									type="button"
									class="flex items-center justify-center w-6 h-6 text-red-500 hover:bg-red-500 hover:text-white rounded-full transition-colors cursor-pointer"
									aria-label="Remove person"
									on:click={() => removePerson(person.id)}
								>
									<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<path d="M3 6h18"/>
										<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
										<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
										<line x1="10" y1="11" x2="10" y2="17"/>
										<line x1="14" y1="11" x2="14" y2="17"/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div slot="footer" class="flex gap-2 justify-end pt-2">
		<button
			class="px-4 py-2 border border-gray2 
text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer text-sm"
			on:click={closeModal}
		>
			Cancel
		</button>
		<button
			class="px-4 py-2 rounded-full transition-colors cursor-pointer text-sm bg-lime text-black hover:bg-lime"
			disabled={isSubmitting}
			on:click={handleSave}
		>
			{isSubmitting ? 'Saving...' : 'Done'}
		</button>
	</div>
</Modal>