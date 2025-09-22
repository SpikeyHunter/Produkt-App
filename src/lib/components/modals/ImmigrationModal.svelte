<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import Modal from './Modal.svelte';
	import PromoterLetter from '../advance/PromoterLetter.svelte';
	import PreviewModal from './PreviewModal.svelte';
	import type { EventAdvance, Person } from '$lib/types/events.js';
	import type { PromoterLetterData } from '$lib/types/letter';
	import { updateEventAdvance } from '$lib/services/eventsService.js';
	import DropdownButton from '../buttons/DropdownButton.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import PassportNavigation from '../passport/PassportNavigation.svelte';
	import { supabase } from '$lib/supabase.js';
	import { PDFDocument } from 'pdf-lib';

	// --- Types ---
	interface SimpleImmigrationInfo {
		letter_type: string;
		visa_required: boolean;
		visa_number: string;
		gender: 'male' | 'female' | '';
		artist_fee: string;
		letter_url: string;
		letter_path: string;
		letter_sent: boolean;
	}

	// --- Props ---
	export let isOpen = false;
	export let event: EventAdvance | null = null;

	const dispatch = createEventDispatcher<{ save: { event: EventAdvance }; close: void }>();

	// --- State ---
	let people: Person[] = [];
	let immigrationInfos: Map<string, SimpleImmigrationInfo> = new Map();
	let currentPersonIndex = 0;
	let isSubmitting = false;
	let showLetterPreview = false;
	let isFeeFocused = false;
	let isGeneratingPdf = false;
	let showPreviewModal = false;
	let previewFileUrl = '';
	let previewFileName = '';
	let isDeleting = false;
	let confirmDelete = false;
	let isGeneratingImmForm = false;
	let customJobDescription = '';
	let isGeneratingEmail = false;

	const createDefaultImmigrationData = (): SimpleImmigrationInfo => ({
		letter_type: 'IMM5686E Form', // Changed default to IMM5686E Form
		visa_required: false,
		visa_number: '',
		gender: 'male', // Changed default to male
		artist_fee: '',
		letter_url: '',
		letter_path: '',
		letter_sent: false
	});

	// --- Reactive Statements ---
	$: currentPerson = people[currentPersonIndex];
	$: currentImmigrationInfo = currentPerson ? immigrationInfos.get(currentPerson.id) : undefined;

	$: passportData = event?.passport_info;
	$: parsedPassportInfo =
		typeof passportData === 'string' ? JSON.parse(passportData || '[]') : passportData || [];
	$: currentPassportInfo = parsedPassportInfo.find(
		(p: {
			id: string;
			country: string;
			givenName?: string;
			lastName?: string;
			dateOfBirth?: string;
			passportNumber?: string;
		}) => p.id === currentPerson?.id
	);
	$: rolesData = event?.roles;
	$: parsedRoles = typeof rolesData === 'string' ? JSON.parse(rolesData || '[]') : rolesData || [];
	$: currentRole = parsedRoles.find((r: Person) => r.id === currentPerson?.id);
	$: isArtist = currentRole?.role === 'Artist';

	$: groundInfoData = event?.ground_info;
	$: parsedGroundInfo =
		typeof groundInfoData === 'string' ? JSON.parse(groundInfoData || '{}') : groundInfoData || {};
	$: currentArrival = parsedGroundInfo.arrivals?.find((a: any) =>
		a.assignedRoles?.includes(`${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}`)
	);
	$: currentDeparture = parsedGroundInfo.departures?.find((d: any) =>
		d.assignedRoles?.includes(`${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}`)
	);
	$: stayDuration = (() => {
		if (currentArrival?.date && currentDeparture?.date) {
			const arrival = new Date(currentArrival.date);
			const departure = new Date(currentDeparture.date);
			const diff = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
			return Math.max(1, diff);
		}
		return 2;
	})();
	$: showDuration = (() => {
		if (!event) return 2;
		return 2;
	})();
	$: formattedFee = (() => {
		const amount = currentImmigrationInfo?.artist_fee;
		if (amount === null || amount === undefined || amount === '') return '';
		const num = Number(amount);
		if (isNaN(num)) return amount;
		return new Intl.NumberFormat('en-US').format(num);
	})();
	$: letterInfoIsFilled = !!(
		currentImmigrationInfo?.gender &&
		currentImmigrationInfo?.artist_fee &&
		isArtist &&
		currentImmigrationInfo?.letter_type === 'Promoter Letter'
	);
	$: canGeneratePdf = currentImmigrationInfo?.letter_type === 'Promoter Letter';
	$: formattedDob = (() => {
		if (!currentPassportInfo?.dateOfBirth) return '';
		const date = new Date(currentPassportInfo.dateOfBirth);
		return date.toISOString().split('T')[0]; // YYYY-MM-DD format
	})();
	$: formattedArrivalDate = (() => {
		console.log('Raw event object:', event);
		console.log('Event.date:', event?.date);
		console.log('Event.event_date:', event?.event_date);
		
		// Try to get the raw event_date first, fallback to date
		const rawDate = event?.event_date || event?.date;
		console.log('Using raw date:', rawDate);
		
		if (!rawDate) return '';
		
		const dateStr = String(rawDate);
		
		// If it's already YYYY-MM-DD, use it directly
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
			console.log('Using date string directly:', dateStr);
			return dateStr;
		}
		
		// If it's just "September 19" or similar, we need to add current year
		// This is a fallback - ideally we should get the full date from the database
		if (/^[A-Za-z]+ \d{1,2}$/.test(dateStr)) {
			console.log('Detected month/day only format, adding current year');
			const currentYear = new Date().getFullYear();
			const date = new Date(`${dateStr}, ${currentYear}`);
			if (!isNaN(date.getTime())) {
				const result = date.toISOString().split('T')[0];
				console.log('Converted to:', result);
				return result;
			}
		}
		
		// Fallback: try to parse as-is
		const date = new Date(dateStr);
		if (!isNaN(date.getTime())) {
			const result = date.toISOString().split('T')[0];
			console.log('Parsed date result:', result);
			return result;
		}
		
		console.log('Could not parse date:', dateStr);
		return '';
	})();
	
	$: formattedDepartureDate = (() => {
		if (!formattedArrivalDate) return '';
		
		console.log('Calculating departure from:', formattedArrivalDate, 'duration:', stayDuration);
		
		// Parse the YYYY-MM-DD string manually to avoid timezone issues
		const [year, month, day] = formattedArrivalDate.split('-').map(num => parseInt(num, 10));
		const arrivalDate = new Date(year, month - 1, day); // month is 0-indexed
		console.log('Parsed arrival date object:', arrivalDate);
		
		const departureDate = new Date(arrivalDate);
		departureDate.setDate(arrivalDate.getDate() + stayDuration - 1);
		console.log('Calculated departure date object:', departureDate);
		
		const result = departureDate.toISOString().split('T')[0];
		console.log('Final departure date:', result);
		return result;
	})();

	$: promoterLetterRenderData = (() => {
		const data: PromoterLetterData = {
			artistFullName: `${currentPassportInfo?.givenName || ''} ${currentPassportInfo?.lastName || ''} AKA ${event?.artist_name || ''}`,
			artistLegalFullName: `${currentPassportInfo?.givenName || ''} ${currentPassportInfo?.lastName || ''}`,
			artistLastName: currentPassportInfo?.lastName || '',
			artistDob: currentPassportInfo?.dateOfBirth ? new Date(currentPassportInfo.dateOfBirth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
			artistCitizenship: normalizeCountry(currentPassportInfo?.country || ''),
			passportNumber: currentPassportInfo?.passportNumber || '',
			performanceName: event?.artist_name || '',
			performanceDate: event?.date || '',
			arrivalDate: currentArrival?.date ? new Date(currentArrival.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : (event?.date ? new Date(event.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''),
			showDuration: showDuration,
			paymentCurrency: 'USD',
			stayDurationDays: stayDuration,
			letterDate: new Date().toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			}),
			artistGender: (currentImmigrationInfo?.gender || 'male') as 'male' | 'female',
			paymentAmount: formattedFee,
			visaNumber: currentImmigrationInfo?.visa_required ?
			currentImmigrationInfo?.visa_number : ''
		};
		return data;
	})();

	$: if (isOpen && event) {
		setTimeout(() => loadEventData(), 50);
	}

	function loadEventData() {
		if (!event) return;
		const allPeople =
			typeof event.roles === 'string' ? JSON.parse(event.roles || '[]') : event.roles || [];
		people = allPeople.filter((person: Person) => person.immigration === true);

		const existingData =
			typeof event.immigration_info === 'string'
				? JSON.parse(event.immigration_info || '{}')
				: event.immigration_info || {};
		const newInfos = new Map<string, SimpleImmigrationInfo>();

		people.forEach((person) => {
			const oldData = existingData[person.id] || {};
			const cleanData: SimpleImmigrationInfo = {
				letter_type: oldData.letter_type || 'IMM5686E Form', // Default to IMM5686E Form
				visa_required: oldData.visa_required || false,
				visa_number: oldData.visa_number || '',
				gender: oldData.gender || 'male', // Default to male
				artist_fee: oldData.artist_fee || '',
				letter_url: oldData.letter_url || '',
				letter_path: oldData.letter_path || '',
				letter_sent: oldData.letter_sent || false
			};
			newInfos.set(person.id, cleanData);
		});
		immigrationInfos = newInfos;
		currentPersonIndex = 0;
	}

	async function saveImmigrationDataSilent() {
		if (!event) return;
		try {
			const dataToSave = Object.fromEntries(immigrationInfos);
			const updates = { immigration_info: JSON.stringify(dataToSave) };
			await updateEventAdvance(event.event_id, event.artist_name, updates);
		} catch (error) {
			console.error('Error saving immigration info:', error);
		}
	}

	async function saveImmigrationData() {
		if (!event) return;
		try {
			const dataToSave = Object.fromEntries(immigrationInfos);
			const updates = { immigration_info: JSON.stringify(dataToSave) };
			await updateEventAdvance(event.event_id, event.artist_name, updates);
			dispatch('save', { event });
		} catch (error) {
			console.error('Error saving immigration info:', error);
		}
	}

	function handleUpdateField(column: keyof SimpleImmigrationInfo, value: any) {
		if (!currentPerson) return;
		const info = immigrationInfos.get(currentPerson.id);
		if (!info) return;
		(info as any)[column] = value;
		immigrationInfos.set(currentPerson.id, info);
		immigrationInfos = new Map(immigrationInfos);
	}

	function handleLetterTypeChange(newLetterType: string) {
		if (!currentPerson) return;
		if (currentImmigrationInfo?.letter_type === 'Promoter Letter' && 
			newLetterType !== 'Promoter Letter' && 
			currentImmigrationInfo?.letter_url) {
			
			handleUpdateField('letter_url', '');
			handleUpdateField('letter_path', '');
			handleUpdateField('letter_sent', false);
		}
		
		handleUpdateField('letter_type', newLetterType);
	}

	async function handleGenerateAndUploadPDF() {
		if (!letterInfoIsFilled || !currentPerson || !currentPassportInfo) return;
		
		isGeneratingPdf = true;
		showLetterPreview = true;
		await tick();

		await new Promise(resolve => setTimeout(resolve, 500));
		const html2pdf = (await import('html2pdf.js')).default;
		const element = document.getElementById('letter-content');
		if (!element) {
			console.error('PDF preview element not found.');
			isGeneratingPdf = false;
			showLetterPreview = false; 
			return;
		}

		try {
			// Debug: Check current user
			const { data: { user } } = await supabase.auth.getUser();
			console.log('Current user:', user);
			
			const pdfBlob = await html2pdf().set({
				margin: 0.5,
				filename: 'Promoter Letter.pdf', 
				image: { type: 'jpeg' as const, quality: 0.98 },
				html2canvas: { 
					scale: 3,
					useCORS: true,
					allowTaint: false,
					backgroundColor: '#ffffff',
					width: 816, 
					height: 1056, 
					windowWidth: 816,
					windowHeight: 1056,
					x: 0,
					y: 0
				}, 
				jsPDF: { 
					unit: 'in', 
					format: [8.5, 11],
					orientation: 'portrait' as const
				}
			}).from(element).output('blob');
			
			const fileName = `Promoter Letter_Artist - ${currentPassportInfo.givenName} ${currentPassportInfo.lastName}.pdf`;
			const filePath = `promoter_letters/${fileName}`;
			
			console.log('Attempting upload with:', { fileName, filePath, blobSize: pdfBlob.size });
			
			const { error: uploadError, data: uploadData } = await supabase.storage
				.from('documents')
				.upload(filePath, pdfBlob, { upsert: true });
				
			if (uploadError) {
				console.error('Upload error details:', uploadError);
				throw uploadError;
			}
			
			console.log('Upload successful:', uploadData);
			const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
			
			handleUpdateField('letter_url', urlData.publicUrl);
			handleUpdateField('letter_path', filePath);
			
			await saveImmigrationDataSilent();
		} catch (error) {
			console.error('Error generating or uploading PDF:', error);
		} finally {
			isGeneratingPdf = false; 
			showLetterPreview = false;
		}
	}

	async function handleDeleteLetter() {
		if (!currentImmigrationInfo) return;

		if (!confirmDelete) {
			confirmDelete = true;
			return;
		}

		let pathToDelete = currentImmigrationInfo.letter_path;
		const bucketName = 'documents';
		if (!pathToDelete && currentImmigrationInfo.letter_url) {
			try {
				const url = new URL(currentImmigrationInfo.letter_url);
				const pathPrefix = `/${bucketName}/`;
				const pathStartIndex = url.pathname.indexOf(pathPrefix);
				if (pathStartIndex !== -1) {
					pathToDelete = decodeURIComponent(
						url.pathname.substring(pathStartIndex + pathPrefix.length)
					);
				}
			} catch (e) {
				console.error('Could not parse letter URL to get path:', e);
				return;
			}
		}

		if (!pathToDelete) {
			return;
		}

		isDeleting = true;
		try {
			console.log(`Attempting to delete file from bucket '${bucketName}' at path: ${pathToDelete}`);
			const { error } = await supabase.storage.from(bucketName).remove([pathToDelete]);
			if (error) throw error;
			console.log('File successfully deleted from storage.');

			handleUpdateField('letter_url', '');
			handleUpdateField('letter_path', '');
			handleUpdateField('letter_sent', false);

			await saveImmigrationDataSilent();
			console.log('Local state cleared and saved to database.');
		} catch (error) {
			console.error('Error deleting file:', error);
		} finally {
			isDeleting = false;
			confirmDelete = false;
		}
	}

	function handlePreview(url: string, fileName: string) {
		previewFileUrl = url;
		previewFileName = fileName;
		showPreviewModal = true;
	}

	async function convertImageToPDF(imageUrl: string, fileName: string): Promise<void> {
		try {
			// Fetch the image
			const response = await fetch(imageUrl);
			if (!response.ok) throw new Error('Failed to fetch image');
			const imageBlob = await response.blob();
			
			// Create a canvas to get image dimensions
			const img = new Image();
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			
			return new Promise((resolve, reject) => {
				img.onload = async () => {
					try {
						// Set canvas size to image size
						canvas.width = img.width;
						canvas.height = img.height;
						
						// Draw image on canvas
						ctx?.drawImage(img, 0, 0);
						
						// Convert canvas to blob
						canvas.toBlob(async (canvasBlob) => {
							if (!canvasBlob) {
								reject(new Error('Failed to convert canvas to blob'));
								return;
							}
							
							// Use jsPDF to create PDF
							const { jsPDF } = await import('jspdf');
							const pdf = new jsPDF();
							
							// Calculate dimensions to fit page
							const pdfWidth = pdf.internal.pageSize.getWidth();
							const pdfHeight = pdf.internal.pageSize.getHeight();
							const imgRatio = img.width / img.height;
							const pageRatio = pdfWidth / pdfHeight;
							
							let finalWidth, finalHeight;
							if (imgRatio > pageRatio) {
								finalWidth = pdfWidth - 20; // 10px margin on each side
								finalHeight = finalWidth / imgRatio;
							} else {
								finalHeight = pdfHeight - 20; // 10px margin on each side
								finalWidth = finalHeight * imgRatio;
							}
							
							// Center the image
							const x = (pdfWidth - finalWidth) / 2;
							const y = (pdfHeight - finalHeight) / 2;
							
							// Convert canvas to data URL and add to PDF
							const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
							pdf.addImage(dataUrl, 'JPEG', x, y, finalWidth, finalHeight);
							
							// Download the PDF
							pdf.save(fileName);
							resolve();
						}, 'image/jpeg', 0.95);
					} catch (error) {
						reject(error);
					}
				};
				
				img.onerror = () => reject(new Error('Failed to load image'));
				img.src = URL.createObjectURL(imageBlob);
			});
		} catch (error) {
			console.error('Error converting image to PDF:', error);
			throw error;
		}
	}

	async function handleDownloadAll() {
		if (!event || immigrationInfos.size === 0) return;

		let downloadCount = 0;
		
		// Count total files (immigration docs + passports)
		const immigrationFiles = Array.from(immigrationInfos.values()).filter(info => info.letter_url).length;
		const passportFiles = parsedPassportInfo.filter((p: any) => p.passportImageUrl).length;
		const totalFiles = immigrationFiles + passportFiles;

		if (totalFiles === 0) {
			alert('No files available to download');
			return;
		}

		console.log(`Starting download of ${totalFiles} files (${immigrationFiles} immigration docs + ${passportFiles} passports)...`);

		try {
			// Download immigration documents
			for (const [personId, info] of immigrationInfos) {
				if (info.letter_url) {
					const person = people.find(p => p.id === personId);
					const passportInfo = parsedPassportInfo.find((p: any) => p.id === personId);
					
					if (person && passportInfo) {
						const fileName = info.letter_type === 'Promoter Letter' 
							? `Promoter Letter_Artist - ${passportInfo.givenName} ${passportInfo.lastName}.pdf`
							: `IMM5686E_${passportInfo.givenName} ${passportInfo.lastName}.pdf`;
						
						try {
							await handleDirectDownload(info.letter_url, fileName);
							downloadCount++;
							await new Promise(resolve => setTimeout(resolve, 500));
						} catch (error) {
							console.error(`Failed to download ${fileName}:`, error);
						}
					}
				}
			}

			// Download passport images as PDFs
			for (const passportInfo of parsedPassportInfo) {
				if (passportInfo.passportImageUrl) {
					const fileName = `Passport - ${passportInfo.givenName} ${passportInfo.lastName}.pdf`;
					
					try {
						await convertImageToPDF(passportInfo.passportImageUrl, fileName);
						downloadCount++;
						await new Promise(resolve => setTimeout(resolve, 1000)); // Longer delay for PDF conversion
					} catch (error) {
						console.error(`Failed to download passport for ${passportInfo.givenName} ${passportInfo.lastName}:`, error);
					}
				}
			}

			console.log(`Downloaded ${downloadCount} of ${totalFiles} files`);
			
		} catch (error) {
			console.error('Error during bulk download:', error);
		}
	}

	async function generateEMLFile() {
		if (!event || !currentPassportInfo) return;

		isGeneratingEmail = true;

		try {
			// Get event date and format it
			const eventDateStr = event?.event_date || event?.date || '';
			let eventDate;
			if (eventDateStr && /^\d{4}-\d{2}-\d{2}$/.test(eventDateStr)) {
				eventDate = new Date(eventDateStr + 'T00:00:00');
			} else {
				eventDate = new Date(eventDateStr) || new Date();
			}
			
			const formattedEventDate = eventDate.toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'long', 
				day: 'numeric' 
			});

			// Get full legal name and artist name
			const fullLegalName = `${currentPassportInfo.givenName} ${currentPassportInfo.lastName}`;
			const artistName = event?.artist_name || '';

			// Generate travelling party list
			const travellingParty = people.map((person: Person) => {
				const passportInfo = parsedPassportInfo.find((p: any) => p.id === person.id);
				const roleInfo = parsedRoles.find((r: Person) => r.id === person.id);
				const fullName = passportInfo ? `${passportInfo.givenName} ${passportInfo.lastName}` : 'Unknown';
				const role = roleInfo?.role || 'Unknown';
				return `${fullName} - ${role}`;
			}).join('<br>');

			console.log('Collecting attachments...');
			const attachments = [];
			
			// Add passport images converted to PDF
			for (const passportInfo of parsedPassportInfo) {
				if (passportInfo.passportImageUrl) {
					try {
						console.log('Converting passport to PDF for:', passportInfo.givenName, passportInfo.lastName);
						const response = await fetch(passportInfo.passportImageUrl);
						const blob = await response.blob();
						
						// Convert image to PDF using jsPDF
						const { jsPDF } = await import('jspdf');
						const pdf = new jsPDF();
						
						// Create image element to get dimensions
						const img = new Image();
						const canvas = document.createElement('canvas');
						const ctx = canvas.getContext('2d');
						
						await new Promise<void>((resolve, reject) => {
							img.onload = () => {
								// Set canvas size to image size
								canvas.width = img.width;
								canvas.height = img.height;
								
								// Draw image on canvas
								ctx?.drawImage(img, 0, 0);
								
								// Calculate dimensions to fit page
								const pdfWidth = pdf.internal.pageSize.getWidth();
								const pdfHeight = pdf.internal.pageSize.getHeight();
								const imgRatio = img.width / img.height;
								const pageRatio = pdfWidth / pdfHeight;
								
								let finalWidth, finalHeight;
								if (imgRatio > pageRatio) {
									finalWidth = pdfWidth - 20; // 10px margin on each side
									finalHeight = finalWidth / imgRatio;
								} else {
									finalHeight = pdfHeight - 20; // 10px margin on each side
									finalWidth = finalHeight * imgRatio;
								}
								
								// Center the image
								const x = (pdfWidth - finalWidth) / 2;
								const y = (pdfHeight - finalHeight) / 2;
								
								// Convert canvas to data URL and add to PDF
								const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
								pdf.addImage(dataUrl, 'JPEG', x, y, finalWidth, finalHeight);
								
								// Get PDF as base64
								const pdfBase64 = pdf.output('datauristring').split(',')[1];
								
								attachments.push({
									filename: `Passport - ${passportInfo.givenName} ${passportInfo.lastName}.pdf`,
									content: pdfBase64,
									contentType: 'application/pdf'
								});
								
								resolve();
							};
							
							img.onerror = reject;
							img.src = URL.createObjectURL(blob);
						});
						
					} catch (e) {
						console.warn('Failed to convert passport to PDF for', passportInfo.givenName, passportInfo.lastName, e);
					}
				}
			}

			// Add IMM5686E PDFs
			for (const [personId, info] of immigrationInfos) {
				if (info.letter_url) {
					const passportInfo = parsedPassportInfo.find((p: any) => p.id === personId);
					if (passportInfo) {
						try {
							console.log('Fetching document for:', passportInfo.givenName, passportInfo.lastName);
							const response = await fetch(info.letter_url);
							const blob = await response.blob();
							const base64 = await blobToBase64(blob);
							const fileName = info.letter_type === 'Promoter Letter' 
								? `Promoter Letter_Artist - ${passportInfo.givenName} ${passportInfo.lastName}.pdf`
								: `IMM5686E_${passportInfo.givenName} ${passportInfo.lastName}.pdf`;
							
							attachments.push({
								filename: fileName,
								content: base64.split(',')[1],
								contentType: 'application/pdf'
							});
						} catch (e) {
							console.warn('Failed to fetch document for', passportInfo.givenName, passportInfo.lastName);
						}
					}
				}
			}

			console.log(`Collected ${attachments.length} attachments, generating EML...`);

			// Create EML content
			const boundary = `----=_NextPart_${Date.now()}`;
			const emlContent = `Message-ID: <${Date.now()}@produkt.ca>
Date: ${new Date().toUTCString()}
From: Charles <charles@produkt.ca>
To: IRCC.IMWU-UMIT.IRCC@cic.gc.ca
CC: janie@produkt.ca, allanah@produkt.ca
Subject: WP Exemption for ${fullLegalName} AKA ${artistName} at New City Gas ${formattedEventDate}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${boundary}"

--${boundary}
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 8bit

<html>
<body>
<p>Greetings,</p>

<p>Please find attached WP exemption request for <strong>${fullLegalName} AKA ${artistName} at New City Gas ${formattedEventDate}</strong></p>

<p>Here is the list of documents:<br>
<strong>1. Performers' passport ID page</strong><br>
<strong>2. Service contract between Performer and 4427319 Canada inc.</strong><br>
<strong>3. Invitation Letter</strong><br>
<strong>4. Biography</strong></p>

<p><strong>Travelling party:</strong><br>
${travellingParty}</p>

<p>Please let me know if you need any further information from me.</p>

<p>Best regards,<br>
Charles</p>
</body>
</html>

${attachments.map(att => `--${boundary}
Content-Type: ${att.contentType}
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="${att.filename}"

${att.content}
`).join('')}
--${boundary}--`;

			// Download the EML file
			const emlBlob = new Blob([emlContent], { type: 'message/rfc822' });
			const url = URL.createObjectURL(emlBlob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `IRCC_WP_Exemption_${fullLegalName.replace(/\s+/g, '_')}_${formattedEventDate.replace(/\s+/g, '_')}.eml`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			console.log('EML file generated successfully!');
			console.log('INSTRUCTIONS: After the .eml file downloads:');
			console.log('1. Double-click the .eml file to open it in Apple Mail');
			console.log('2. A new email draft will open with all content and attachments');
			console.log('3. Click the Send button in Apple Mail to send the email');

		} catch (error) {
			console.error('Error generating EML file:', error);
		} finally {
			isGeneratingEmail = false;
		}
	}

	function blobToBase64(blob: Blob): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as string);
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	}

	function handleEmailIRCC() {
		generateEMLFile();
	}

	function closePreviewModal() {
		showPreviewModal = false;
		previewFileUrl = '';
		previewFileName = '';
	}

	async function handleDirectDownload(fileUrl: string, fileName: string) {
		try {
			const response = await fetch(fileUrl);
			if (!response.ok) throw new Error('Failed to fetch file');
			const blob = await response.blob();
			const downloadUrl = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = downloadUrl;
			link.download = fileName;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(downloadUrl);
		} catch (error) {
			console.error('Download failed:', error);
			window.open(fileUrl, '_blank');
		}
	}

	function handleNavigate(event: CustomEvent<number>) {
		confirmDelete = false; 
		currentPersonIndex = event.detail;
	}

	async function handleSave() {
		isSubmitting = true;
		await saveImmigrationData();
		isSubmitting = false;
		closeModal();
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		people = [];
		immigrationInfos.clear();
		currentPersonIndex = 0;
		isSubmitting = false;
		confirmDelete = false;
		isGeneratingEmail = false;
	}

	function getBadgeColor(value: boolean | undefined) {
		if (value === true) return 'bg-confirmed text-black';
		if (value === false) return 'bg-problem text-black';
		return 'bg-gray2 text-black';
	}

	function getLetterTypeBadgeColor(letterType: string) {
		return letterType ? 'bg-lime text-black' : 'bg-gray2 text-black';
	}

	function getDeleteButtonClass() {
		if (confirmDelete) {
			return "p-2 bg-problem text-white rounded-full hover:bg-red-600";
		} else {
			return "p-2 bg-gray2 text-black rounded-full hover:bg-problem";
		}
	}

	function getDeleteButtonTitle() {
		if (confirmDelete) {
			return "Click again to confirm deletion";
		} else {
			return "Delete";
		}
	}
	
	const getJobTitle = (role: string | undefined) => {
		const jobTitleMap = {
			Artist: 'Artist / DJ',
			Manager: 'Artist Manager',
			'Tour Manager': 'Artist Tour Manager',
			LD: 'Lighting Technician',
			VJ: 'Visual Technician',
			Sound: 'Sound Technician',
			Media: 'Media Manager',
			Photographer: 'Photographer',
			Videographer: 'Videographer',
		};
		return role && jobTitleMap[role as keyof typeof jobTitleMap] 
			? jobTitleMap[role as keyof typeof jobTitleMap] 
			: role || 'Unknown';
	};

	const getJobDescription = (role: string | undefined) => {
		const descriptions = {
			Artist: 'Provides Music and plays music',
			Manager: 'Manages the artist\'s career, bookings, and business affairs',
			'Tour Manager': 'Coordinates and manages all aspects of touring activities',
			LD: 'Designs and operates lighting systems for performances',
			VJ: 'Creates and operates visual content and video projections',
			Sound: 'Operates and maintains audio equipment and sound systems',
			Media: 'Manages social media, marketing, and promotional content',
			Photographer: 'Captures and produces photographic content',
			Videographer: 'Records and produces video content',
		};
		if (role && descriptions[role as keyof typeof descriptions]) {
			return descriptions[role as keyof typeof descriptions];
		}
		return customJobDescription;
	};

	const normalizeCountry = (country: string) => {
		if (country === 'United States' || country === 'US' || country === 'USA') {
			return 'United States of America';
		}
		return country;
	};

	async function handleGenerateAndUploadIMMForm() {
		if (!currentPerson || !currentPassportInfo || !currentImmigrationInfo) return;

		isGeneratingImmForm = true;

		try {
			const formUrl = '/pdf/IMM5686E_Template_Empty.pdf';
			const existingPdfBytes = await fetch(formUrl).then((res) => res.arrayBuffer());

			const pdfDoc = await PDFDocument.load(existingPdfBytes);
			const form = pdfDoc.getForm();

			console.log('Debug - Event date:', event?.date);
			console.log('Debug - Formatted arrival:', formattedArrivalDate);
			console.log('Debug - Formatted departure:', formattedDepartureDate);
			console.log('Debug - Stay duration:', stayDuration);
			
			const fields = {
				'Date_of_birth': formattedDob,
				'Gender': currentImmigrationInfo.gender.charAt(0).toUpperCase() + currentImmigrationInfo.gender.slice(1),
				'Family_Name': currentPassportInfo.lastName,
				'Given_names': currentPassportInfo.givenName,
				'Citizenship': normalizeCountry(currentPassportInfo.country),
				'Country_of_birth': normalizeCountry(currentPassportInfo.country),
				'Country_of_residence': normalizeCountry(currentPassportInfo.country),
				'Job_Title': getJobTitle(currentRole?.role),
				'From': formattedArrivalDate,
				'To': formattedDepartureDate,
				'Total_Duration': `${stayDuration}`,
				'Job_Description': getJobDescription(currentRole?.role),
			};

			for (const [fieldName, value] of Object.entries(fields)) {
				try {
					const field = form.getTextField(fieldName);
					field.setText(value);
				} catch (e) {
					console.warn(`Field '${fieldName}' not found in the PDF.`, e);
				}
			}

			// Try to find and check a "No" checkbox - this might not exist
			try {
				const noCheckbox = form.getCheckBox('No');
				noCheckbox.check();
			} catch (e) {
				console.warn('No checkbox not found in the PDF form.', e);
			}

			const pdfBytes = await pdfDoc.save();
			const pdfBlob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });

			const fileName = `IMM5686E_${currentPassportInfo.givenName} ${currentPassportInfo.lastName}.pdf`;
			const filePath = `IMM5686E/${fileName}`;

			const { error: uploadError } = await supabase.storage
				.from('documents')
				.upload(filePath, pdfBlob, { upsert: true });

			if (uploadError) throw uploadError;

			const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

			handleUpdateField('letter_url', urlData.publicUrl);
			handleUpdateField('letter_path', filePath);
			handleUpdateField('letter_sent', false);

			await saveImmigrationDataSilent();
		} catch (error) {
			console.error('Error generating or uploading IMM Form:', error);
		} finally {
			isGeneratingImmForm = false;
		}
	}
</script>

<Modal
	bind:isOpen
	title="Immigration - {event?.artist_name || 'Event'}"
	maxWidth="max-w-5xl"
	hasFooter={true}
	on:close={closeModal}
>
	{#if people.length === 0}
		<div class="text-center py-6">
			<h3 class="text-base font-bold text-white mb-1">No Team Members Found</h3>
			<p class="text-gray2 text-sm">
				Add team members via the 'Roles' tool and set 'Requires Immigration' to 'Yes'.
			</p>
		</div>
	{:else}
		<div class="space-y-4">
			<PassportNavigation {people} {currentPersonIndex} on:navigate={handleNavigate} />
			<div class="grid grid-cols-2 gap-x-12 gap-y-6 pt-4">
				{#if currentImmigrationInfo}
					<div class="pl-4 border-l-2 border-gray1 flex flex-col gap-4">
						<div class="flex items-center gap-3 text-sm">
							<span class="font-semibold min-w-[130px] text-gray3">Letter Type</span>
							<DropdownButton
								options={['Promoter Letter', 'IMM5686E Form']}
								value={currentImmigrationInfo.letter_type}
								buttonClass={getLetterTypeBadgeColor(currentImmigrationInfo.letter_type)}
								on:select={(e) => handleLetterTypeChange(e.detail)}
							/>
						</div>

						{#if currentImmigrationInfo.letter_type === 'Promoter Letter'}
							<div class="flex items-center gap-3 text-sm">
								<div class="font-semibold min-w-[130px] text-gray3 flex items-center gap-1.5">
									<span>Visa Required</span>
									<div class="relative group">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											class="h-4 w-4 text-gray-400"
											viewBox="0 0 20 20"
											fill="currentColor"
											><path
												fill-rule="evenodd"
												d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
												clip-rule="evenodd"
											/></svg
										>
										<div
											class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-black text-white text-xs 
											rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
										>
											Country: {currentPassportInfo?.country || 'No info available'}
										</div>
									</div>
								</div>
								<DropdownButton
									options={['Yes', 'No']}
									value={currentImmigrationInfo.visa_required ? 'Yes' : 'No'}
									buttonClass={getBadgeColor(currentImmigrationInfo.visa_required)}
									on:select={(e) => handleUpdateField('visa_required', e.detail === 'Yes')}
								/>
							</div>
						{/if}

						{#if currentImmigrationInfo.visa_required}
							<div class="flex items-center gap-3 text-sm">
								<span class="font-semibold min-w-[130px] text-gray3">Visa Number</span>
								<input
									type="text"
									class="w-full bg-transparent border border-lime rounded-full px-3 py-1.5 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime text-sm"
									placeholder="Enter visa number"
									value={currentImmigrationInfo.visa_number}
									on:input={(e) => handleUpdateField('visa_number', e.currentTarget.value)}
								/>
							</div>
						{/if}

						<div class="flex items-center gap-3 text-sm">
							<span class="font-semibold min-w-[130px] text-gray3">
								{currentImmigrationInfo.letter_type}
							</span>
							
							{#if currentImmigrationInfo.letter_type === 'IMM5686E Form'}
								{#if currentImmigrationInfo.letter_url}
									<div class="flex items-center gap-2">
										<button
											on:click={() =>
												handlePreview(
													currentImmigrationInfo.letter_url,
													`IMM5686E_${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}`
												)}
											class="px-3 py-1.5 bg-gray2 text-black rounded-full text-sm font-semibold hover:bg-lime"
										>
											Preview
										</button>
										<button
											on:click={() =>
												handleDirectDownload(
													currentImmigrationInfo.letter_url,
													`IMM5686E_${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}.pdf`
												)}
											class="p-2 bg-gray2 text-black rounded-full hover:bg-lime"
											aria-label="Download"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="w-4 h-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
												/></svg
											>
										</button>
										<button
											on:click={handleDeleteLetter}
											disabled={isDeleting}
											class={getDeleteButtonClass()}
											aria-label={getDeleteButtonTitle()}
											title={getDeleteButtonTitle()}
										>
											{#if isDeleting}
												<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
											{:else if confirmDelete}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
												</svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
												</svg>
											{/if}
										</button>
									</div>
								{:else}
									<button
										on:click={handleGenerateAndUploadIMMForm}
										disabled={isGeneratingImmForm}
										class="px-3 py-1.5 bg-lime text-black rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{isGeneratingImmForm ? 'Generating...' : 'Generate PDF'}
									</button>
								{/if}
							{:else if currentImmigrationInfo.letter_type === 'Promoter Letter'}
								{#if !isArtist}
									<span class="text-gray2 text-xs italic">
										Can't use template for non-Artist roles
									</span>
								{:else if currentImmigrationInfo.letter_url}
									<div class="flex items-center gap-2">
										<button
											on:click={() =>
												handlePreview(
													currentImmigrationInfo.letter_url,
													`Promoter Letter_Artist - ${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}`
												)}
											class="px-3 py-1.5 bg-gray2 text-black rounded-full text-sm font-semibold hover:bg-lime"
										>
											Preview
										</button>
										<button
											on:click={() =>
												handleDirectDownload(
													currentImmigrationInfo.letter_url,
													`Promoter Letter_Artist - ${currentPassportInfo?.givenName} ${currentPassportInfo?.lastName}.pdf`
												)}
											class="p-2 bg-gray2 text-black rounded-full hover:bg-lime"
											aria-label="Download"
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												class="w-4 h-4"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												stroke-width="2"
												><path
													stroke-linecap="round"
													stroke-linejoin="round"
													d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
												/></svg
											>
										</button>
										<button
											on:click={handleDeleteLetter}
											disabled={isDeleting}
											class={getDeleteButtonClass()}
											aria-label={getDeleteButtonTitle()}
											title={getDeleteButtonTitle()}
										>
											{#if isDeleting}
												<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
											{:else if confirmDelete}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
												</svg>
											{:else}
												<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
												</svg>
											{/if}
										</button>
									</div>
								{:else}
									<button
										on:click={handleGenerateAndUploadPDF}
										disabled={!letterInfoIsFilled || isGeneratingPdf}
										class="px-3 py-1.5 bg-lime text-black rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
									</button>
								{/if}
							{/if}
						</div>

						<div
							class="flex items-center gap-3 text-sm transition-opacity"
							class:opacity-50={!currentImmigrationInfo.letter_url}
						>
							<span class="font-semibold min-w-[130px] text-gray3">Letter Sent</span>
							<div class:pointer-events-none={!currentImmigrationInfo.letter_url}>
								<DropdownButton
									options={['Yes', 'No']}
									value={currentImmigrationInfo.letter_sent ? 'Yes' : 'No'}
									buttonClass={getBadgeColor(currentImmigrationInfo.letter_sent)}
									on:select={(e) => handleUpdateField('letter_sent', e.detail === 'Yes')}
								/>
							</div>
						</div>
					</div>

					<div class="flex flex-col gap-4">
						<div class="flex items-center gap-3 text-sm">
							<span class="font-semibold min-w-[130px] text-gray3">Gender</span>
							<DropdownButton
								options={['Male', 'Female']}
								value={currentImmigrationInfo.gender === 'male' ? 'Male' : currentImmigrationInfo.gender === 'female' ? 'Female' : ''}
								placeholder="Select Gender"
								buttonClass={currentImmigrationInfo.gender
									? 'bg-lime text-black capitalize'
									: 'bg-gray2 text-black'}
								on:select={(e) => handleUpdateField('gender', e.detail.toLowerCase())}
							/>
						</div>
						
						{#if currentImmigrationInfo.letter_type === 'Promoter Letter'}
							<div class="flex items-center gap-3 text-sm">
								<span class="font-semibold min-w-[130px] text-gray3">Artist Fee (USD)</span>
								<input
									type="text"
									class="w-full bg-transparent border border-gray2 rounded-full px-3 py-1.5 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime text-sm"
									placeholder="Enter amount"
									value={isFeeFocused ? currentImmigrationInfo.artist_fee || '' : formattedFee}
									on:input={(e) =>
										handleUpdateField('artist_fee', e.currentTarget.value.replace(/[^0-9]/g, ''))}
									on:focus={() => (isFeeFocused = true)}
									on:blur={() => (isFeeFocused = false)}
								/>
							</div>
						{/if}

						{#if !isArtist && currentPerson && currentImmigrationInfo.letter_type === 'Promoter Letter'}
							<div class="mt-2 p-3 bg-gray1 border border-gray2 rounded-lg">
								<p class="text-xs text-gray2">
									Note: Promoter Letter template is only available for Artist roles.
									Current role: <span
										class="text-white font-semibold">{currentRole?.role || 'Unknown'}</span
									>
								</p>
							</div>
						{:else if currentImmigrationInfo.letter_type === 'IMM5686E Form'}
							<div class="mt-2 p-3 bg-gray1 border border-gray2 rounded-lg">
								<p class="text-xs text-gray2">
									This form will be filled with available data. You may need to verify and add a custom job description.
								</p>
							</div>
							
							{#if !['Artist', 'Manager', 'Tour Manager', 'LD', 'VJ', 'Sound', 'Media', 'Photographer', 'Videographer'].includes(currentRole?.role)}
								<div class="flex items-center gap-3 text-sm">
									<span class="font-semibold min-w-[130px] text-gray3">Job Description</span>
									<input
										type="text"
										class="w-full bg-transparent border border-gray2 rounded-full px-3 py-1.5 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime text-sm"
										placeholder="Enter job description"
										bind:value={customJobDescription}
									/>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<svelte:fragment slot="footer">
		<div class="flex items-center justify-between w-full">
			<div class="flex items-center gap-3">
				{#if people.length > 0}
					<button
						on:click={handleDownloadAll}
						class="px-4 py-2 bg-gray2 text-black rounded-lg hover:bg-lime transition-colors flex items-center gap-2"
						title="Download all immigration documents and passports"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
						</svg>
						Download All
					</button>
					<button
						on:click={handleEmailIRCC}
						disabled={isGeneratingEmail}
						class="px-4 py-2 bg-lime text-black rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						title="Generate email with attachments for IRCC"
					>
						{#if isGeneratingEmail}
							<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
							Generating...
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
							</svg>
							Email IRCC
						{/if}
					</button>
				{/if}
			</div>
			
			<div class="flex items-center gap-3">
				<button
					on:click={closeModal}
					class="px-4 py-2 text-gray3 border border-gray2 rounded-lg hover:text-white hover:border-white transition-colors"
					disabled={isSubmitting}
				>
					Cancel
				</button>
				<button
					on:click={handleSave}
					disabled={isSubmitting}
					class="px-4 py-2 bg-lime text-black rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isSubmitting ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</svelte:fragment>
</Modal>

{#if showLetterPreview}
	<div id="letter-content" style="position: absolute; left: -9999px;">
		<PromoterLetter data={promoterLetterRenderData} />
	</div>
{/if}

{#if showPreviewModal}
	<PreviewModal
		bind:isOpen={showPreviewModal}
		fileUrl={previewFileUrl}
		fileName={previewFileName}
		on:close={closePreviewModal}
	/>
{/if}