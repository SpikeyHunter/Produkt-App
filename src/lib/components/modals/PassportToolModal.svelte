<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Modal from './Modal.svelte';
	import PassportPreview from '../passport/PassportPreview.svelte';
	import PassportNavigation from '../passport/PassportNavigation.svelte';
	import PassportImageUpload from '../passport/PassportImageUpload.svelte';
	import PassportInfoForm from '../passport/PassportInfoForm.svelte';
	import { updateEventAdvance } from '$lib/services/eventsService.js';
	import { getAccessToken } from '$lib/stores/auth';
	import type { EventAdvance, Person } from '$lib/types/events.js';
	import { parseRoles } from '$lib/utils/roleUtils';
	import { portal } from '$lib/utils/portalUtils';
	import type { PassportInfo } from '$lib/types/passport';
	import {
		createEmptyPassportInfo,
		isFormReadyToSave,
		parsePassportData,
		preparePassportDataForSave
	} from '$lib/utils/passport/modalUtils';

	export let isOpen = false;
	export let event: EventAdvance | null = null;

	const dispatch = createEventDispatcher();

	// State
	let people: Person[] = [];
	let passportInfos: PassportInfo[] = [];
	let currentPersonIndex = 0;
	let isSubmitting = false;

	// Upload states
	let showPreviewModal = false;
	let isUploading = false;
	let isDeleting = false;
	let currentPassportUrl = '';
	let fileInput: HTMLInputElement;
	let tempFiles: Map<string, File> = new Map();
	let currentTempFile: File | null = null;
	// For robust preview

	// Auto-detect states
	let isDetecting = false;
	let detectionError = '';

	// Reactive statements
	$: currentPerson = people[currentPersonIndex];
	$: currentPassportInfo = currentPerson ? passportInfos.find((p) => p.id === currentPerson.id) : undefined;
	$: canSave = isFormReadyToSave(passportInfos);
	$: if (isOpen && event) {
		setTimeout(() => loadEventData(), 50);
	}

	function loadEventData() {
		if (!event || !event.roles) return;

		let allPeople: any[] = [];
		try {
			// Safely parse roles, handling both string and object formats
			allPeople = typeof event.roles === 'string' ? JSON.parse(event.roles) : event.roles;
			if (!Array.isArray(allPeople)) {
				allPeople = [];
			}
		} catch (e) {
			console.error('Failed to parse roles JSON:', e);
			allPeople = [];
		}

		// Filter people to only include those with immigration set to true
		people = allPeople.filter((person) => person.immigration === true);

		const loadedPassports = parsePassportData(event.passport_info);
		passportInfos = loadedPassports.map((info) => ({
			...info,
			fieldsVerified: info.fieldsVerified || {
				givenName: true,
				lastName: true,
				dateOfBirth: true,
				country: true,
				passportNumber: true
			}
		}));
		people.forEach((person) => {
			if (!passportInfos.find((p) => p.id === person.id)) {
				passportInfos.push(createEmptyPassportInfo(person.id));
			}
		});
		currentPersonIndex = 0;
	}

	function updateCurrentPassportInfo(field: string, value: any) {
		if (!currentPerson) return;
		passportInfos = passportInfos.map((info) => {
			if (info.id === currentPerson.id) {
				const updatedInfo = { ...info, [field]: value };
				if (updatedInfo.fieldsVerified && field in updatedInfo.fieldsVerified) {
					updatedInfo.fieldsVerified = {
						...updatedInfo.fieldsVerified,
						[field as keyof typeof updatedInfo.fieldsVerified]: true
					};
				}
				return updatedInfo;
			}
			return info;
		});
	}

	function handleNavigate(event: CustomEvent<number>) {
		currentPersonIndex = event.detail;
	}

	function triggerFileInput() {
		fileInput?.click();
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file || !currentPerson) return;
		try {
			isUploading = true;
			const tempUrl = URL.createObjectURL(file);
			tempFiles.set(currentPerson.id, file);
			updateCurrentPassportInfo('passportImageUrl', tempUrl);
		} finally {
			isUploading = false;
			if (fileInput) fileInput.value = '';
		}
	}

	function openPreviewModal() {
		if (!currentPerson || !currentPassportInfo?.passportImageUrl) return;
		currentPassportUrl = currentPassportInfo.passportImageUrl;
		currentTempFile = tempFiles.get(currentPerson.id) || null;
		showPreviewModal = true;
	}

	function closePreviewModal() {
		showPreviewModal = false;
		currentPassportUrl = '';
		currentTempFile = null;
	}

	async function handleDeletePassport() {
		if (!currentPerson || !currentPassportInfo?.passportImageUrl) return;
		try {
			isDeleting = true;
			if (isDetecting) isDetecting = false;
			if (currentPassportInfo.passportImageUrl.startsWith('blob:')) {
				URL.revokeObjectURL(currentPassportInfo.passportImageUrl);
				tempFiles.delete(currentPerson.id);
			} else {
				const token = await getAccessToken();
				if (!token) throw new Error('Not authenticated.');
				await fetch('/api/upload', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ fileUrl: currentPassportInfo.passportImageUrl, bucket: 'documents' })
				});
			}
			passportInfos = passportInfos.map((info) => {
				if (info.id === currentPerson.id) return createEmptyPassportInfo(currentPerson.id);
				return info;
			});
			detectionError = '';
			closePreviewModal();
			await saveStateToDB();
		} catch (error) {
			console.error('❌ Error deleting passport:', error);
		} finally {
			isDeleting = false;
		}
	}

	async function handleAutoDetect() {
		if (!currentPassportInfo?.passportImageUrl || !currentPerson) return;
		try {
			isDetecting = true;
			detectionError = '';
			const token = await getAccessToken();
			if (!token) throw new Error('Not authenticated.');

			let imageData = currentPassportInfo.passportImageUrl;
			if (imageData.startsWith('blob:')) {
				const response = await fetch(imageData);
				const blob = await response.blob();
				const reader = new FileReader();
				const base64Promise = new Promise<string>((resolve, reject) => {
					reader.onloadend = () => resolve(reader.result as string);
					reader.onerror = reject;
				});
				reader.readAsDataURL(blob);
				imageData = await base64Promise;
			}

			const response = await fetch('/api/passport-ocr', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
				body: JSON.stringify({
					imageUrl: imageData,
					nameHints: { expectedFirstName: currentPerson.firstName, expectedLastName: currentPerson.lastName }
				})
			});
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || 'OCR detection failed.');
			}
			const result = await response.json();
			if (!result.success || !result.detectedInfo) {
				throw new Error('Failed to detect passport information.');
			}

			const ocrResult = result.detectedInfo;
			passportInfos = passportInfos.map((info) => {
				if (info.id === currentPerson.id) {
					const updatedInfo = { ...info };
					const fields = updatedInfo.fieldsVerified || ({} as any);
					if (ocrResult.givenName) {
						updatedInfo.givenName = ocrResult.givenName;
						fields.givenName = false;
					}
					if (ocrResult.lastName) {
						updatedInfo.lastName = ocrResult.lastName;
						fields.lastName = false;
					}
					if (ocrResult.dateOfBirth) {
						updatedInfo.dateOfBirth = ocrResult.dateOfBirth;
						fields.dateOfBirth = false;
					}
					if (ocrResult.country) {
						updatedInfo.country = ocrResult.country;
						fields.country = false;
					}
					if (ocrResult.passportNumber) {
						updatedInfo.passportNumber = ocrResult.passportNumber;
						fields.passportNumber = false;
					}
					updatedInfo.fieldsVerified = fields;
					return updatedInfo;
				}
				return info;
			});
		} catch (error) {
			console.error('❌ Error during auto-detection:', error);
			detectionError = error instanceof Error ? error.message : 'Failed to detect info.';
		} finally {
			isDetecting = false;
		}
	}

	async function handleUploadViaAPI(file: File, filePath: string, token: string) {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('filePath', filePath);
		formData.append('bucket', 'documents');
		formData.append('eventId', event!.event_id.toString());
		formData.append('artistName', event!.artist_name);
		const response = await fetch('/api/upload', {
			method: 'POST',
			credentials: 'include',
			headers: { Authorization: `Bearer ${token}` },
			body: formData
		});
		if (!response.ok) {
			const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
			throw new Error(errorData.error || `Upload failed with status ${response.status}`);
		}
		return await response.json();
	}

	async function saveStateToDB() {
		if (!event) return;
		const passportDataToSave = preparePassportDataForSave(passportInfos);
		const passportData = JSON.stringify(passportDataToSave);
		const updates = { passport_info: passportData };
		await updateEventAdvance(event.event_id, event.artist_name, updates);
		event.passport_info = passportData;
	}

	async function handleSave() {
		if (!event) return;
		try {
			isSubmitting = true;
			for (const info of passportInfos) {
				if (info.passportImageUrl && info.passportImageUrl.startsWith('blob:')) {
					const file = tempFiles.get(info.id);
					if (!file) continue;
					try {
						const token = await getAccessToken();
						if (!token) throw new Error('Not authenticated.');
						const givenName = info.givenName.trim() || 'Unknown';
						const lastName = info.lastName.trim() || 'Person';
						const passportFileName = `Passport - ${givenName} ${lastName}`;
						const filePath = `passports/${passportFileName}.png`;
						const uploadResult = await handleUploadViaAPI(file, filePath, token);
						info.passportImageUrl = uploadResult.publicUrl;
						tempFiles.delete(info.id);
					} catch (uploadError) {
						console.error('Error uploading passport for', info.id, uploadError);
					}
				}
			}
			await saveStateToDB();
			dispatch('save', {
				event: { ...event, passport_info: JSON.stringify(preparePassportDataForSave(passportInfos)) }
			});
			closeModal();
		} catch (error) {
			console.error('Error saving passport info:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		people = [];
		passportInfos = [];
		currentPersonIndex = 0;
		isSubmitting = false;
		showPreviewModal = false;
		detectionError = '';
		passportInfos.forEach((info) => {
			if (info.passportImageUrl && info.passportImageUrl.startsWith('blob:')) {
				URL.revokeObjectURL(info.passportImageUrl);
			}
		});
		tempFiles.clear();
	}

	function handleUpdateField(event: CustomEvent<{ field: string; value: any }>) {
		updateCurrentPassportInfo(event.detail.field, event.detail.value);
	}
</script>

<input bind:this={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" on:change={handleFileSelect} class="hidden" />

<Modal
	bind:isOpen
	title="Passport Management - {event?.artist_name || 'Event'}"
	maxWidth="max-w-4xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	{#if people.length === 0}
		<div class="text-center py-6">
			<div class="w-14 h-14 bg-gray1 rounded-full flex items-center justify-center mx-auto mb-3">
				<svg class="w-7 h-7 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
					<circle cx="8.5" cy="7" r="4" />
					<path d="M20 8v6" />
					<path d="M23 11h-6" />
				</svg>
			</div>
			<h3 class="text-base font-bold text-white mb-1">No Team Members Found</h3>
			<p class="text-gray2 text-sm">Please add team members to the role list first before managing passports.</p>
		</div>
	{:else}
		<div class="space-y-4">
			<PassportNavigation {people} {currentPersonIndex} on:navigate={handleNavigate} />
			<div class="grid grid-cols-2 s:grid-cols-2 gap-6">
				<PassportImageUpload
					{currentPerson}
					{currentPassportInfo}
					{isUploading}
					{isDeleting}
					{isDetecting}
					{detectionError}
					on:fileInput={triggerFileInput}
					on:preview={openPreviewModal}
					on:delete={handleDeletePassport}
					on:autoDetect={handleAutoDetect}
				/>
				<PassportInfoForm {currentPerson} {currentPassportInfo} on:updateField={handleUpdateField} />
			</div>
		</div>
	{/if}

	<div slot="footer" class="flex gap-2 justify-end">
		<button
			class="px-4 py-2 border border-gray2 text-gray2 rounded-full 
text-sm hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
			on:click={closeModal}
		>
			Cancel
		</button>
		<button
			class="px-4 py-2 rounded-full transition-colors cursor-pointer text-sm border border-white text-white hover:bg-lime hover:text-black hover:border-lime disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={isSubmitting ||
people.length === 0 || !canSave}
			on:click={handleSave}
		>
			{isSubmitting ? 'Saving...' : 'Done'}
		</button>
	</div>
</Modal>

{#if showPreviewModal}
	<div use:portal>
		<PassportPreview
			bind:isOpen={showPreviewModal}
			fileUrl={currentPassportUrl}
			on:close={closePreviewModal}
		/>
	</div>
{/if}