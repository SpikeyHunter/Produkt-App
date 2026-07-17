<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import Modal from '$lib/components/modals/Modal.svelte';
	import DatePicker from '$lib/components/buttons/DatePicker.svelte';
	import {
		updateEventAdvance,
		deleteEventAdvance,
		updateEvent
	} from '$lib/services/eventsService.js';
	import { supabase } from '$lib/supabase.js';

	export let isOpen = false;
	export let event: any = null;
	const dispatch = createEventDispatcher();

	let artistName = '';
	let artistType = '';
	let selectedEvent: any = null;
	let searchValue = '';
	let isSubmitting = false;
	let showDeleteConfirm = false;
	let showDropdown = false;
	let showEventDropdown = false;
	let showVenueDropdown = false;
	let customArtistType = '';

	let isCustomEvent = false;
	let customEventDate = '';
	let showPastEvents = false;

	let availableEvents: any[] = [];
	let filteredEvents: any[] = [];
	let hasLoadedEvents = false;
	let venue = '';
	let customVenue = '';
	const artistTypeOptions = ['Headliner', 'Support', 'Local', 'Other'];
	const venueOptions = ['New City Gas', 'Bazart', 'Other'];

	const excludeKeywords = [
		'test',
		'réservations',
		'pass',
		'event',
		'template',
		'produktworld',
		'piknic',
		'oktoberfest'
	];

	// Reset form when modal opens/closes or event changes
	$: if (event && isOpen && !hasLoadedEvents) {
		artistName = event?.artist_name || '';
		const currentEventId = event?.id?.split('-')[0] || '';
		const eventArtistType = event?.artist_type || '';
		const eventVenue = event?.event_venue || event?.venue || '';

		if (eventVenue) {
			const knownVenue = venueOptions.find((v) => v.toLowerCase() === eventVenue.toLowerCase());
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else {
				venue = 'Other';
				customVenue = eventVenue;
			}
		} else {
			venue = '';
			customVenue = '';
		}

		loadEvents()
			.then(() => {
				selectedEvent =
					availableEvents.find((e) => e.event_id.toString() === currentEventId) || null;
				if (selectedEvent) {
					searchValue = selectedEvent.event_name;
					isCustomEvent = selectedEvent.is_custom || false;
					if (isCustomEvent) {
						customEventDate = selectedEvent.event_date;
					}
				} else {
					searchValue = 'Custom Event';
					isCustomEvent = true;
				}
				hasLoadedEvents = true;
			})
			.catch(() => {
				searchValue = 'Custom Event';
				isCustomEvent = true;
				hasLoadedEvents = true;
			});

		if (artistTypeOptions.includes(eventArtistType)) {
			artistType = eventArtistType;
			customArtistType = '';
		} else if (eventArtistType) {
			artistType = 'Other';
			customArtistType = eventArtistType;
		} else {
			artistType = '';
			customArtistType = '';
		}

		showDeleteConfirm = false;
		showDropdown = false;
		showEventDropdown = false;
		showVenueDropdown = false;
	}

	$: if (searchValue && !isCustomEvent) {
		filteredEvents = availableEvents.filter(
			(e) =>
				e.event_name.toLowerCase().includes(searchValue.toLowerCase()) ||
				e.event_id.toString().includes(searchValue)
		);
	} else {
		filteredEvents = availableEvents;
	}

	async function loadEvents() {
		try {
			let query = supabase
				.from('events')
				.select('event_id, event_name, event_date, event_flyer, event_venue, is_custom');

			if (showPastEvents) {
				query = query
					.in('event_status', ['LIVE', 'PAST'])
					.order('event_date', { ascending: false });
			} else {
				query = query.eq('event_status', 'LIVE').order('event_date', { ascending: true });
			}

			const { data, error } = await query;
			if (error) {
				console.error('Error loading events:', error);
				availableEvents = [];
				return;
			}

			const rawEvents = data || [];
			const currentEventId = event?.id?.split('-')[0];
			const eventToKeep = rawEvents.find((e) => e.event_id.toString() === currentEventId);

			availableEvents = rawEvents.filter((e) => {
				const lowerName = (e.event_name || '').toLowerCase();
				if (eventToKeep && e.event_id === eventToKeep.event_id) {
					return true;
				}
				return !excludeKeywords.some((keyword) => lowerName.includes(keyword));
			});
		} catch (error) {
			console.error('Error loading events:', error);
			availableEvents = [];
		}
	}

	function closeModal() {
		dispatch('close');
		resetForm();
	}

	function resetForm() {
		artistName = '';
		artistType = '';
		selectedEvent = null;
		searchValue = '';
		customEventDate = '';
		customArtistType = '';
		venue = '';
		customVenue = '';
		isSubmitting = false;
		showDeleteConfirm = false;
		showDropdown = false;
		showEventDropdown = false;
		showVenueDropdown = false;
		isCustomEvent = false;
		hasLoadedEvents = false;
	}

	function selectEvent(e: any) {
		selectedEvent = e;
		searchValue = e.event_name;
		showEventDropdown = false;
		isCustomEvent = e.is_custom || false;

		if (e.event_venue) {
			const knownVenue = venueOptions.find((v) => v.toLowerCase() === e.event_venue.toLowerCase());
			if (knownVenue) {
				venue = knownVenue;
				customVenue = '';
			} else {
				venue = 'Other';
				customVenue = e.event_venue;
			}
		} else {
			venue = '';
			customVenue = '';
		}
	}

	function selectCustomEvent() {
		selectedEvent = null;
		isCustomEvent = true;
		showEventDropdown = false;
		searchValue = '';
		customEventDate = '';
	}

	function toggleEventDropdown() {
		showEventDropdown = !showEventDropdown;
	}

	function selectVenue(selectedVenue: string) {
		venue = selectedVenue;
		showVenueDropdown = false;
		if (selectedVenue !== 'Other') {
			customVenue = '';
		}
	}

	function toggleVenueDropdown() {
		showVenueDropdown = !showVenueDropdown;
	}

	// 2. TRANSFER FUNCTION (Events Table) — copies content fields + date + link,
	// but NEVER the flyer or identity fields (those stay Tixr-authoritative).
	async function transferEventData(oldId: number, newId: number): Promise<boolean> {
		if (!oldId || !newId || oldId === newId || oldId === -1) return true; // nothing to do

		console.log(`[Transfer] Moving base event data from ${oldId} to ${newId}`);
		try {
			// maybeSingle (not single): if the old event_id was never backed by
			// its own `events` row — it only ever existed via events_advance
			// references — there is legitimately nothing to transfer. .single()
			// throws/406s on 0 rows and would wrongly abort the whole save for
			// what is actually a valid, harmless case.
			const { data: oldData, error: fetchError } = await supabase
				.from('events')
				.select('*')
				.eq('event_id', oldId)
				.maybeSingle();

			if (fetchError) {
				console.error('[Transfer] Could not fetch old event row:', fetchError);
				return false;
			}

			if (!oldData) {
				console.log(
					`[Transfer] No events row found for old event_id ${oldId} — nothing to transfer, continuing.`
				);
				return true;
			}

			// Identity / Tixr-authoritative / audit columns — NEVER copied.
			// event_flyer explicitly excluded: real Tixr flyer wins over the
			// custom row's (usually empty) flyer.
			const {
				event_id,
				event_name,
				event_status,
				event_flyer,
				is_custom,
				event_updated,
				event_order_updated,
				event_attendance_updated,
				event_sales_updated,
				...carryOver
			} = oldData;
			// carryOver now includes: event_date, calendar_link, event_genre,
			// event_tags, timetable, timetable_active, tech_mail, vj_mail, crew,
			// email_data, settimes_display, stage_type, color, pinned.

			// 🔑 Free the OLD row's link first — calendar_link is ~1:1, so writing
			// it onto the new row while the old row still holds it can violate a
			// unique constraint and silently no-op the whole update.
			if (carryOver.calendar_link) {
				const { error: unlinkError } = await supabase
					.from('events')
					.update({ calendar_link: null })
					.eq('event_id', oldId);
				if (unlinkError) {
					console.error('[Transfer] Failed to clear old row link:', unlinkError);
					return false;
				}
			}

			const { error: updateError } = await supabase
				.from('events')
				.update(carryOver)
				.eq('event_id', newId);

			if (updateError) {
				console.error('[Transfer] FAILED to copy fields to new event:', updateError);
				return false;
			}

			console.log('[Transfer] Success — date, link, and content fields copied.');
			return true;
		} catch (err) {
			console.error('[Transfer] Error:', err);
			return false;
		}
	}

	async function handleSave() {
		if (!artistName.trim() || (!selectedEvent && !isCustomEvent) || !event) return;

		isSubmitting = true;
		try {
			const originalEventIdStr = event.id?.split('-')[0] || '';
			const originalArtistName = event.id?.split('-').slice(1).join('-') || '';
			const oldId = parseInt(originalEventIdStr);

			let newId = selectedEvent ? selectedEvent.event_id : -1;
			const finalArtistType =
				artistType === 'Other' ? customArtistType.trim() || null : artistType || null;
			const finalVenue = venue === 'Other' ? customVenue.trim() : venue;

			// Handle Custom Event Creation or Modification
			if (isCustomEvent) {
				if (selectedEvent && selectedEvent.is_custom) {
					// Updating existing custom event that we are already editing
					await supabase
						.from('events')
						.update({
							event_name: searchValue.trim(),
							event_date: customEventDate,
							event_venue: finalVenue
						})
						.eq('event_id', selectedEvent.event_id);
					newId = selectedEvent.event_id;
				} else {
					// Creating a completely new custom event (user clicked "Custom Event" -> entered details)
					const { data: newCustomEvent, error: customErr } = await supabase
						.from('events')
						.insert([
							{
								event_name: searchValue.trim(),
								event_date: customEventDate,
								event_venue: finalVenue,
								event_status: 'LIVE',
								is_custom: true
							}
						])
						.select('event_id')
						.single();
					if (customErr) throw customErr;
					newId = newCustomEvent.event_id;
				}
			}

			// === SCENARIO 1: MOVING TO A NEW EVENT ID (CLONE STRATEGY) ===
			if (!isNaN(oldId) && oldId !== -1 && oldId !== newId) {
				console.log('[Save] Detected Event ID change. Starting Clone Strategy...');
				const transferOk = await transferEventData(oldId, newId);
				if (!transferOk) {
					throw new Error(
						'Failed to transfer event data (date/link/fields) to the new event. Aborting before touching the old row.'
					);
				}

				// Fetch EVERY advance row tied to the old event — not just the
				// artist currently being edited. The old `events` row gets
				// deleted at the end of this block; if a foreign key from
				// events_advance -> events cascades on delete, any row left
				// behind here would be silently wiped out along with it. So we
				// clone all of them up front, then explicitly delete all of them
				// before ever touching the old events row.
				const { data: oldRecords, error: fetchAllError } = await supabase
					.from('events_advance')
					.select('*')
					.eq('event_id', oldId);

				if (fetchAllError || !oldRecords || oldRecords.length === 0) {
					throw new Error('Could not find any advance record(s) to clone for this event.');
				}

				console.log(
					`[Save] Found ${oldRecords.length} advance record(s) tied to event ${oldId}. Cloning all of them to event ${newId}...`
				);

				for (const record of oldRecords) {
					// Only the artist actually being edited gets the user's new
					// name/type — every other artist tied to this event clones
					// through completely unchanged.
					const isEditedRow = record.artist_name === originalArtistName;

					const { id, created_at, updated_at, contract_id, ...dataToKeep } = record;
					const newRecord = {
						...dataToKeep,
						event_id: newId,
						artist_name: isEditedRow ? artistName.trim() : record.artist_name,
						artist_type: isEditedRow ? finalArtistType : record.artist_type
					};

					const { data: newAdvance, error: insertError } = await supabase
						.from('events_advance')
						.insert(newRecord)
						.select()
						.single();

					if (insertError || !newAdvance) {
						console.error(
							`[Save] Failed to clone advance record for "${record.artist_name}":`,
							insertError
						);
						throw (
							insertError ||
							new Error(`Failed to clone advance record for "${record.artist_name}".`)
						);
					}
					console.log(
						`[Save] Cloned advance record for "${record.artist_name}" -> new advance id ${newAdvance.id}`
					);

					// Clone that artist's contract row, if any.
					const { data: oldContract } = await supabase
						.from('events_contract')
						.select('*')
						.eq('advance_id', record.id)
						.single();

					if (oldContract) {
						const {
							contract_id: old_cid,
							created_at: c_at,
							updated_at: u_at,
							...contractDataToKeep
						} = oldContract;
						const { error: contractInsertError } = await supabase.from('events_contract').insert({
							...contractDataToKeep,
							advance_id: newAdvance.id,
							event_id: newId
						});
						if (contractInsertError) {
							console.error(
								`[Save] Failed to clone contract for "${record.artist_name}":`,
								contractInsertError
							);
							throw contractInsertError;
						}
						console.log(`[Save] Cloned contract for "${record.artist_name}".`);
					} else {
						const { error: blankContractError } = await supabase
							.from('events_contract')
							.insert({ advance_id: newAdvance.id, event_id: newId });
						if (blankContractError) {
							console.error(
								`[Save] Failed to create blank contract for "${record.artist_name}":`,
								blankContractError
							);
							throw blankContractError;
						}
					}
				}

				const targetEventUpdates: any = { is_custom: isCustomEvent }; // keep flag if custom
				if (finalVenue) {
					targetEventUpdates.event_venue = finalVenue;
				}
				await updateEvent(newId, targetEventUpdates);

				// ============================================================
				// 🟢 NEW: TRANSFER MARKETING PROJECT LINK
				// ============================================================
				const { error: marketingUpdateError } = await supabase
					.from('events_marketing')
					.update({ event_id: newId })
					.eq('event_id', oldId);

				if (marketingUpdateError) {
					console.warn('[Save] Could not update marketing project link:', marketingUpdateError);
				}

				// Every advance row now has a cloned counterpart on newId — safe
				// to delete ALL the old advance rows for oldId
				const { error: deleteAdvanceError } = await supabase
					.from('events_advance')
					.delete()
					.eq('event_id', oldId);
				if (deleteAdvanceError) {
					console.error('[Save] Failed to delete old ADVANCE record(s):', deleteAdvanceError);
					throw deleteAdvanceError;
				}
				console.log(`[Save] Deleted ${oldRecords.length} old ADVANCE record(s).`);

				// ============================================================
				// STEP 0: Does the old event_id even have an `events` row?
				// If it doesn't (it only ever existed via events_advance
				// references), there's nothing to clear or delete — skip
				// straight through instead of running Step 1/2/3 against a
				// row that was never there (which would 406 on the verify
				// re-read and throw a misleading "still linked" warning).
				// ============================================================
				const { data: oldRowExists, error: existsCheckError } = await supabase
					.from('events')
					.select('event_id')
					.eq('event_id', oldId)
					.maybeSingle();

				if (existsCheckError) {
					console.error(
						'[Save] Could not check whether old event row exists — skipping clear/delete to be safe:',
						existsCheckError
					);
				} else if (!oldRowExists) {
					console.log(
						`[Save] No events row exists for old event_id ${oldId} — nothing to clear or delete.`
					);
				} else {
					// ============================================================
					// STEP 1: Flip the old event row to is_custom = false and clear
					// its calendar_link. This MUST land — and be CONFIRMED landed —
					// before we attempt to delete the row.
					// ============================================================
					console.log(
						'[Save] Step 1: Clearing old event row (is_custom -> false, calendar_link -> null)...'
					);
					const { error: clearError } = await supabase
						.from('events')
						.update({ is_custom: false, calendar_link: null })
						.eq('event_id', oldId);

					if (clearError) {
						console.error(
							'[Save] Step 1 FAILED — old row not cleared, aborting delete:',
							clearError
						);
						alert(
							'Warning: could not clear the old event row (is_custom/calendar_link) before deletion. ' +
								'Data was copied to the new event, but the old row was left in place — please check it manually.\n\n' +
								clearError.message
						);
					} else {
						// ============================================================
						// STEP 2: WAIT — re-read the row to confirm the update actually
						// committed (not just that Supabase returned no error) before
						// moving on to delete.
						// ============================================================
						console.log('[Save] Step 2: Waiting for confirmation the clear committed...');
						const { data: verifiedRow, error: verifyError } = await supabase
							.from('events')
							.select('event_id, is_custom, calendar_link')
							.eq('event_id', oldId)
							.maybeSingle();

						const isCleared =
							!verifyError &&
							verifiedRow &&
							verifiedRow.is_custom === false &&
							verifiedRow.calendar_link === null;

						if (!isCleared) {
							console.error(
								'[Save] Step 2 FAILED — old row did not verify as cleared, aborting delete:',
								verifyError || verifiedRow
							);
							alert(
								'Warning: the old event row still appears custom/linked after clearing — a database rule may be ' +
									'blocking it. Data was copied to the new event, but the old row was left in place — please check it manually.'
							);
						} else {
							// ============================================================
							// STEP 3: DELETE — only now, after the clear was confirmed.
							// ============================================================
							console.log('[Save] Step 3: Deleting old event row...');
							const { error: deleteEventError } = await supabase
								.from('events')
								.delete()
								.eq('event_id', oldId);

							if (deleteEventError) {
								console.error(
									'[Save] Step 3 FAILED — old row cleared but could not be deleted:',
									deleteEventError
								);
								alert(
									`Warning: the old event row was cleared but could not be deleted (${deleteEventError.message}). ` +
										'Please check it manually.'
								);
							} else {
								console.log('[Save] Old EVENT row deleted successfully.');
							}
						}
					}
				}
			} else {
				// === SCENARIO 2: STANDARD UPDATE (SAME EVENT ID) ===
				console.log('[Save] Same Event ID detected. Updating existing records...');
				if (originalArtistName !== artistName.trim() || event.artist_type !== finalArtistType) {
					await updateEventAdvance(oldId, originalArtistName, {
						artist_name: artistName.trim(),
						artist_type: finalArtistType
					});
				}

				if (event.venue !== finalVenue || event.event_venue !== finalVenue) {
					await updateEvent(oldId, { event_venue: finalVenue });
				}
			}

			if (
				event.gdrive_folder_id &&
				(originalArtistName !== artistName.trim() || event.venue !== finalVenue)
			) {
				console.log('[Save] Artist or Venue changed. Triggering GDrive folder rename...');
				const targetDate = selectedEvent
					? selectedEvent.event_date
					: isCustomEvent
						? customEventDate
						: event.event_date;

				fetch('/api/gdrive', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'rename',
						folderId: event.gdrive_folder_id,
						eventDate: targetDate,
						artistName: artistName.trim(),
						venueName: finalVenue
					})
				}).catch((e) => console.error('[Save] GDrive rename failed:', e));
			}

			dispatch('save', {
				eventId: oldId,
				originalArtistName: originalArtistName,
				event: {
					...event,
					id: `${newId}-${artistName.trim()}`,
					event_id: newId,
					artist_name: artistName.trim(),
					name: artistName.trim(),
					artist_type: finalArtistType,
					venue: finalVenue,
					event_venue: finalVenue
				}
			});
			closeModal();
		} catch (error) {
			console.error('Error saving event:', error);
			alert('Error saving changes. Please check console.');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!event) return;
		isSubmitting = true;
		try {
			const eventParts = event.id?.split('-') || [];
			const eventIdStr = eventParts[0] || '';
			const originalArtistName = eventParts.slice(1).join('-') || '';
			if (!eventIdStr || !originalArtistName) {
				throw new Error('Invalid event ID format');
			}

			const eventId = parseInt(eventIdStr);
			await deleteEventAdvance(
				eventId,
				originalArtistName,
				event.contract_url,
				event.passport_info
			);

			const { data: parentEvent } = await supabase
				.from('events')
				.select('is_custom')
				.eq('event_id', eventId)
				.single();

			if (parentEvent?.is_custom) {
				const { error: deleteParentError } = await supabase
					.from('events')
					.delete()
					.eq('event_id', eventId);
				if (deleteParentError) {
					console.warn('[Delete] Could not delete parent custom event:', deleteParentError);
				} else {
					console.log('[Delete] Parent custom event deleted successfully.');
				}
			}

			dispatch('delete', {
				eventId: eventId,
				artistName: originalArtistName,
				event
			});

			closeModal();
		} catch (error) {
			console.error('Error deleting event:', error);
			alert('Failed to delete event. Please check the console for details.');
		} finally {
			isSubmitting = false;
		}
	}

	function confirmDelete() {
		showDeleteConfirm = true;
	}

	function cancelDelete() {
		showDeleteConfirm = false;
	}

	function selectArtistType(type: string) {
		artistType = type;
		showDropdown = false;
		if (type !== 'Other') {
			customArtistType = '';
		}
	}

	function toggleDropdown() {
		showDropdown = !showDropdown;
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			event.target &&
			(event.target as Element).closest &&
			!(event.target as Element).closest('.dropdown-container')
		) {
			showDropdown = false;
			showEventDropdown = false;
			showVenueDropdown = false;
		}
	}

	function formatEventDate(dateString: string): string {
		try {
			const date = new Date(dateString);
			date.setDate(date.getDate() + 1);
			return date.toLocaleDateString('en-US', {
				month: 'long',
				day: 'numeric',
				year: 'numeric'
			});
		} catch (error) {
			return dateString;
		}
	}

	$: isFormValid =
		artistName.trim().length > 0 &&
		(selectedEvent || (isCustomEvent && searchValue.trim() && customEventDate)) &&
		(artistType !== 'Other' || customArtistType.trim().length > 0) &&
		(venue !== 'Other' || customVenue.trim().length > 0) &&
		venue.trim().length > 0;
</script>

<svelte:window on:click={handleClickOutside} />

<Modal
	bind:isOpen
	title="Edit Event"
	maxWidth="max-w-xl"
	hasFooter={true}
	closeOnBackdropClick={true}
	on:close={closeModal}
>
	<div class="space-y-4">
		{#if event}
			{#if !isCustomEvent}
				<div class="dropdown-container relative">
					<div class="flex items-center justify-between mb-2">
						<p class="font-normal text-lime">Select Event</p>
						<label class="flex items-center gap-2 cursor-pointer relative z-10">
							<span class="text-xs text-gray2 font-bold uppercase tracking-wider">Show Past</span>
							<div
								class="relative w-8 h-4 bg-gray1 rounded-full transition-colors duration-200"
								class:bg-lime={showPastEvents}
							>
								<div
									class="absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200"
									class:translate-x-4={showPastEvents}
								></div>
							</div>
							<input
								type="checkbox"
								class="sr-only"
								bind:checked={showPastEvents}
								on:change={loadEvents}
							/>
						</label>
					</div>
					<div class="relative">
						<input
							type="text"
							class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime pr-16"
							placeholder={selectedEvent
								? selectedEvent.event_name
								: isCustomEvent
									? 'Custom Event'
									: 'Search for an event'}
							bind:value={searchValue}
							on:focus={() => (showEventDropdown = true)}
							on:input={() => {
								if (selectedEvent) {
									selectedEvent = null;
									isCustomEvent = false;
								}
								showEventDropdown = true;
							}}
						/>
						<div
							class="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-2"
						>
							{#if selectedEvent || isCustomEvent || searchValue}
								<button
									type="button"
									class="p-1 text-gray2 hover:text-lime rounded-full hover:bg-gray1 transition-colors cursor-pointer"
									on:click={() => {
										selectedEvent = null;
										searchValue = '';
										isCustomEvent = false;
										showEventDropdown = false;
									}}
									aria-label="Clear selection"
								>
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<line x1="18" y1="6" x2="6" y2="18" />
										<line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							{/if}
							<button
								type="button"
								class="cursor-pointer"
								aria-label="Toggle dropdown"
								on:click={toggleEventDropdown}
							>
								<svg
									class="w-4 h-4 text-lime transition-transform {showEventDropdown
										? 'rotate-180'
										: ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M6 9l6 6 6-6" />
								</svg>
							</button>
						</div>
					</div>

					{#if showEventDropdown}
						<div
							class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto"
						>
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1"
								on:click={selectCustomEvent}
							>
								<div class="flex items-center gap-3">
									<div class="w-12 h-12 bg-gray1 rounded-lg flex items-center justify-center">
										<svg
											class="w-6 h-6 text-lime"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<line x1="12" y1="5" x2="12" y2="19" />
											<line x1="5" y1="12" x2="19" y2="12" />
										</svg>
									</div>
									<div>
										<p class="font-medium">Custom Event</p>
										<p class="text-sm opacity-70">Event not in Tixr system</p>
									</div>
								</div>
							</button>

							{#each filteredEvents as eventOption}
								<button
									type="button"
									class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
									on:click={() => selectEvent(eventOption)}
								>
									<div class="flex items-center gap-3">
										<div class="w-12 h-12 rounded-lg overflow-hidden bg-gray1 flex-shrink-0">
											{#if eventOption.event_flyer}
												<img
													src={eventOption.event_flyer}
													alt={eventOption.event_name}
													class="w-full h-full object-cover"
												/>
											{:else}
												<div
													class="w-full h-full bg-gradient-to-br from-lime/40 to-lime/20 flex items-center justify-center"
												>
													<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="currentColor">
														<path
															d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
														/>
													</svg>
												</div>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="font-medium truncate">{eventOption.event_name}</p>
											<p class="text-sm opacity-70">
												{formatEventDate(eventOption.event_date)} • ID: {eventOption.event_id}
											</p>
										</div>
									</div>
								</button>
							{/each}

							{#if searchValue && filteredEvents.length === 0}
								<div class="px-4 py-6 text-center text-gray2">
									<p>No events found matching "{searchValue}"</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else}
				<div class="space-y-4">
					<div class="flex items-center gap-3 mb-4">
						<button
							type="button"
							class="flex items-center justify-center w-8 h-8 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
							on:click={() => {
								isCustomEvent = false;
								searchValue = '';
								customEventDate = '';
								selectedEvent = null;
							}}
							aria-label="Back to search"
						>
							<svg
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M19 12H5" />
								<path d="M12 19l-7-7 7-7" />
							</svg>
						</button>
						<h3 class="text-lg font-bold text-white">Edit Custom Event Details</h3>
					</div>

					<div>
						<p class="font-normal text-lime mb-2">Event Name</p>
						<input
							type="text"
							class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
							placeholder="Enter custom event name"
							bind:value={searchValue}
						/>
					</div>

					<div>
						<p class="font-normal text-lime mb-2">Event Date</p>
						<DatePicker
							bind:value={customEventDate}
							placeholder="Select event date"
							variant="slim"
							width="w-full"
							height="h-12"
						/>
					</div>
				</div>
			{/if}

			<div>
				<p class="font-normal text-lime mb-2">Artist Name</p>
				<input
					type="text"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
					placeholder="Enter artist name"
					bind:value={artistName}
				/>
			</div>

			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Artist Type</p>
				<button
					type="button"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
					on:click={toggleDropdown}
				>
					<span class={artistType ? 'text-white' : 'text-gray2'}>
						{#if artistType === 'Other' && customArtistType}
							{customArtistType}
						{:else if artistType}
							{artistType}
						{:else}
							Select artist type
						{/if}
					</span>
					<svg
						class="w-4 h-4 text-lime transition-transform {showDropdown ? 'rotate-180' : ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>

				{#if showDropdown}
					<div
						class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"
					>
						{#each artistTypeOptions as option}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectArtistType(option)}
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}
			</div>

			{#if artistType === 'Other'}
				<div>
					<p class="font-normal text-lime mb-2">Custom Artist Type</p>
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime"
						placeholder="Enter custom artist type"
						bind:value={customArtistType}
					/>
				</div>
			{/if}

			<div class="dropdown-container relative">
				<p class="font-normal text-lime mb-2">Venue</p>
				<button
					type="button"
					class="w-full bg-transparent border border-lime rounded-full px-4 py-3 text-white focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime flex items-center justify-between cursor-pointer"
					on:click={toggleVenueDropdown}
				>
					<span class={venue ? 'text-white' : 'text-gray2'}>
						{#if venue}
							{venue === 'Other' && customVenue ? `${venue}: ${customVenue}` : venue}
						{:else}
							Select venue
						{/if}
					</span>
					<svg
						class="w-4 h-4 text-lime transition-transform {showVenueDropdown ? 'rotate-180' : ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M6 9l6 6 6-6" />
					</svg>
				</button>

				{#if showVenueDropdown}
					<div
						class="absolute top-full left-0 right-0 mt-1 bg-navbar border border-lime rounded-lg shadow-lg z-10"
					>
						{#each venueOptions as option}
							<button
								type="button"
								class="w-full px-4 py-3 text-left text-white hover:bg-lime hover:text-black transition-colors cursor-pointer border-b border-gray1 last:border-b-0"
								on:click={() => selectVenue(option)}
							>
								{option}
							</button>
						{/each}
					</div>
				{/if}

				{#if venue === 'Other'}
					<input
						type="text"
						class="w-full bg-transparent border border-lime rounded-full px-4 py-2 text-white placeholder-gray2 focus:outline-none focus:border-lime focus:ring-1 focus:ring-lime mt-2"
						placeholder="Enter custom venue"
						bind:value={customVenue}
					/>
				{/if}
			</div>

			{#if showDeleteConfirm}
				<div class="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
					<div class="flex items-center gap-2 mb-2">
						<svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
								clip-rule="evenodd"
							/>
						</svg>
						<h4 class="text-red-400 font-bold text-sm">Confirm Deletion</h4>
					</div>
					<p class="text-red-300 text-sm mb-3">
						Are you sure you want to delete this event entry? This action cannot be undone.
					</p>
					<div class="flex gap-2">
						<button
							class="px-4 py-2 text-sm border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
							on:click={cancelDelete}>Cancel</button
						>
						<button
							class="px-4 py-2 text-sm bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
							disabled={isSubmitting}
							on:click={handleDelete}
						>
							{isSubmitting ? 'Deleting...' : 'Delete'}
						</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>

	<div slot="footer" class="flex gap-3 justify-between">
		{#if !showDeleteConfirm}
			<button
				class="px-6 py-3 border border-red-500 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
				disabled={isSubmitting}
				on:click={confirmDelete}
			>
				Delete Event
			</button>
		{:else}
			<div></div>
		{/if}

		<div class="flex gap-3">
			<button
				class="px-6 py-3 border border-gray2 text-gray2 rounded-full hover:bg-gray2 hover:text-black transition-colors cursor-pointer"
				on:click={closeModal}>Cancel</button
			>
			<button
				class="px-6 py-3 rounded-full transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
				class:bg-lime={isFormValid && !isSubmitting}
				class:text-black={isFormValid && !isSubmitting}
				class:bg-gray1={!isFormValid || isSubmitting}
				class:text-gray2={!isFormValid || isSubmitting}
				class:hover:bg-lime={isFormValid && !isSubmitting}
				disabled={!isFormValid || isSubmitting || showDeleteConfirm}
				on:click={handleSave}
			>
				{isSubmitting ? 'Saving...' : 'Save Changes'}
			</button>
		</div>
	</div>
</Modal>
