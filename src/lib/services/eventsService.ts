// src/lib/services/eventsService.ts
import { supabase } from '$lib/supabase.js';
import { cleanupEventFiles } from './storageService';
import { calculateDynamicProgress } from '$lib/utils/progressUtils';

// Import all types needed for this file AND for re-exporting
import type {
	EventAdvance,
	Event,
	Person,
	ApiResponse,
	PassportInfo,
	HotelInfo,
	SoundcheckInfo
} from '$lib/types/events.ts';

// Re-export the types for other components to use
export type { EventAdvance, Event, Person, ApiResponse, PassportInfo, HotelInfo, SoundcheckInfo };

// --- MODIFIED TYPES FOR JSON-BASED SET TIMES ---
export interface TimetableEntry {
	id: string;
	time: string;
	artist: string;
	notes: string;
	status: 'Problem' | 'Tentative' | 'Proposed' | 'Confirmed' | 'Default';
	length: string;
	isLocked?: boolean;
	showTimeDropdown?: boolean;
}

export async function fetchMainEvent(eventId: number): Promise<any | null> {
	try {
		console.log('Fetching main event with id:', eventId);

		const { data: event, error } = await supabase
			.from('events')
			.select('*')
			.eq('event_id', eventId)
			.single();

		if (error) {
			console.error('Error fetching main event:', error);
			return null;
		}

		console.log('Successfully fetched main event:', event);
		return event;
	} catch (err) {
		console.error('Error in fetchMainEvent:', err);
		return null;
	}
}

export interface EventWithTimetable {
	event_id: number;
	event_name: string;
	event_date: string;
	event_flyer: string | null;
	timetable_active?: boolean;
	timetable: TimetableEntry[] | null;
}
// --- END MODIFIED TYPES ---

export async function updateEvent(eventId: number, updates: { [key: string]: any }) {
	console.log(`Updating event record ${eventId}...`);
	const { data, error } = await supabase
		.from('events')
		.update(updates)
		.eq('event_id', eventId)
		.select()
		.single();

	if (error) {
		console.error('Error updating event record:', error);
		throw error;
	}

	console.log('Event record updated successfully:', data);
	return data;
}

const CUSTOM_EVENT_ID = -1;

export async function updateEventTimetable(
	eventId: number,
	timetable: TimetableEntry[] | null
): Promise<void> {
	try {
		console.log(`Updating timetable for event ${eventId}`);
		const { error } = await supabase
			.from('events')
			.update({ timetable: timetable })
			.eq('event_id', eventId);

		if (error) {
			console.error('Error updating timetable:', error);
			throw error;
		}
		console.log(`Timetable for event ${eventId} updated successfully.`);
	} catch (error) {
		console.error(`Fatal error in updateEventTimetable:`, error);
		throw error;
	}
}

export async function updateEventTimetableActive(eventId: string, active: boolean): Promise<void> {
	try {
		console.log(`Updating timetable_active for event ${eventId} to ${active}`);
		const numericEventId = parseInt(eventId);
		const { data, error } = await supabase
			.from('events')
			.update({ timetable_active: active })
			.eq('event_id', numericEventId)
			.select();

		if (error) {
			console.error(`Error updating timetable_active:`, error);
			throw error;
		}

		console.log(`Successfully updated timetable_active for event ${eventId}:`, data);
	} catch (error) {
		console.error(`Error in updateEventTimetableActive:`, error);
		throw error;
	}
}

export async function fetchLiveEventsWithSetTimes(): Promise<EventWithTimetable[]> {
	try {
		console.log("Fetching 'LIVE' events for Set Times dashboard...");
		const { data: liveEvents, error: eventsError } = await supabase
			.from('events')
			.select('event_id, event_name, event_date, event_flyer, timetable_active, timetable')
			.eq('event_status', 'LIVE')
			.order('event_date', { ascending: true });

		if (eventsError) {
			console.error('Error fetching live events:', eventsError);
			throw eventsError;
		}

		if (!liveEvents || liveEvents.length === 0) {
			console.log('No live events found.');
			return [];
		}

		console.log(`Successfully fetched ${liveEvents.length} live events with their timetables.`);
		return liveEvents as EventWithTimetable[];
	} catch (error) {
		console.error('Fatal error in fetchLiveEventsWithSetTimes:', error);
		return [];
	}
}

async function deleteFileByUrl(fileUrl: string) {
	if (!fileUrl || typeof fileUrl !== 'string') return;
	try {
		const url = new URL(fileUrl);
		const pathParts = url.pathname.split('/');
		const bucketName = pathParts[5];
		const filePath = pathParts.slice(6).join('/');

		if (!bucketName || !filePath) {
			console.warn(`Could not parse bucket or path from URL: ${fileUrl}`);
			return;
		}

		console.log(
			`Attempting to delete from bucket "${bucketName}" file "${decodeURIComponent(filePath)}"`
		);
		const { error } = await supabase.storage
			.from(bucketName)
			.remove([decodeURIComponent(filePath)]);

		if (error) {
			console.warn(`Could not delete file ${filePath}:`, error.message);
		} else {
			console.log(`Successfully deleted file: ${filePath}`);
		}
	} catch (e) {
		console.error(`Invalid URL or error in deleteFileByUrl: ${e}`);
	}
}

export async function updateEventColumn(
	eventId: string,
	column: string,
	value: any
): Promise<void> {
	try {
		console.log(`Updating column ${column} to:`, value);
		let numericEventId: number;
		let artistName: string;

		if (eventId.includes('-')) {
			const parts = eventId.split('-');
			numericEventId = parseInt(parts[0]);
			artistName = parts.slice(1).join('-');
		} else {
			throw new Error('Invalid event ID format');
		}

		const { data, error } = await supabase
			.from('events_advance')
			.update({ [column]: value })
			.eq('event_id', numericEventId)
			.eq('artist_name', artistName)
			.select();

		if (error) {
			console.error(`Error updating ${column}:`, error);
			throw error;
		}

		console.log(`Successfully updated ${column}:`, data);
	} catch (error) {
		console.error(`Error in updateEventColumn:`, error);
		throw error;
	}
}

/**
 * MODIFICATION: The returned object now strictly aligns with your provided schema.
 */
export async function fetchEventsAdvance(): Promise<EventAdvance[]> {
	try {
		console.log('Fetching events from Supabase...');

		const { data: advanceData, error: advanceError } = await supabase
			.from('events_advance')
			.select('*')
			.order('created_at', { ascending: false });

		if (advanceError) {
			console.error('Error fetching events_advance:', advanceError);
			throw advanceError;
		}

		if (!advanceData || advanceData.length === 0) {
			console.log('No events found');
			return [];
		}

		const eventIds = [...new Set(advanceData.map((item) => item.event_id))].filter(
			(id) => id !== CUSTOM_EVENT_ID
		);
		let eventsMap = new Map();

		if (eventIds.length > 0) {
			const { data: eventsData, error: eventsError } = await supabase
				.from('events')
				.select(
					'event_id, event_name, event_date, event_artist, event_status, event_genre, event_flyer, event_tags, event_venue'
				)
				.in('event_id', eventIds);

			if (eventsError) {
				console.warn('Error fetching events details:', eventsError);
			} else if (eventsData) {
				eventsData.forEach((event) => {
					eventsMap.set(event.event_id, event);
				});
			}
		}

		const transformedEvents: EventAdvance[] = advanceData.map((row: any) => {
			const eventData = eventsMap.get(row.event_id);
			const eventName = eventData?.event_name || 'Custom Event';
			const eventDate = eventData?.event_date ? formatEventDate(eventData.event_date) : 'TBD';

			return {
				// Base fields from events_advance
				id: `${row.event_id}-${row.artist_name}`,
				event_id: row.event_id,
				artist_name: row.artist_name,
				artist_type: row.artist_type,
				dos: row.dos,
				main_contact: row.main_contact,
				contract_url: row.contract_url,
				roles: row.roles,
				passport_info: row.passport_info,
				hotel_info: row.hotel_info,
				immigration_info: row.immigration_info,
				immigration_status: row.immigration_status,
				tech_rider: row.tech_rider,
				sfx_rider: row.sfx_rider,
				soundcheck: row.soundcheck,
				hospo_rider: row.hospo_rider,
				ground_transport: row.ground_transport,
				ground_info: row.ground_info,
				advance_completed: row.advance_completed,
				asked: row.asked,
				contract: row.contract,
				role_list: row.role_list,
				ground_done: row.ground_done,
				created_at: row.created_at,
				updated_at: row.updated_at,
				artist_bio: row.artist_bio,
				artist_bio_url: row.artist_bio_url,
				rider_files: row.rider_files,
				visuals: row.visuals,
				visual_received: row.visual_received,
				calendar_synced: row.calendar_synced,
				calendar_sync_time: row.calendar_sync_time,
				calendar_event_ids: row.calendar_event_ids,

				// Computed fields for UI
				name: eventName,
				date: eventDate,
				progress: calculateDynamicProgress(row),
				poster: eventData?.event_flyer || null,
				tags: [
					eventName,
					...(row.artist_type ? [row.artist_type] : []),
					...(eventData?.event_venue ? [eventData.event_venue] : [])
				].filter(Boolean),

				// Joined fields from events table
				venue: eventData?.event_venue || null,
				event_venue: eventData?.event_venue || null,
				event_flyer: eventData?.event_flyer || null,
				event_name: eventData?.event_name || null,
				event_date: eventData?.event_date || null,
				event_artist: eventData?.event_artist,
				event_status: eventData?.event_status,
				event_genre: eventData?.event_genre,
				event_tags: eventData?.event_tags || []
			};
		});

		console.log('Successfully fetched and transformed events:', transformedEvents.length);
		return transformedEvents;
	} catch (error) {
		console.error('Error in fetchEventsAdvance:', error);
		return [];
	}
}

function formatEventDate(dateString: string): string {
	try {
		const date = new Date(dateString);
		date.setDate(date.getDate() + 1);
		return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
	} catch (error) {
		console.error('Error formatting date:', error);
		return dateString;
	}
}

export async function createEventAdvance(
	eventId: number | null,
	artistName: string,
	artistType?: string,
	venue?: string,
	customEventName?: string,
	customEventDate?: string
) {
	try {
		let finalEventId = eventId;

		if (finalEventId === null) {
			console.log('Creating a new custom shell event...');
			if (!customEventName || !customEventDate) {
				throw new Error('Custom event name and date are required to create a new event.');
			}

			const { data: newEvent, error: eventError } = await supabase
				.from('events')
				.insert({
					event_name: customEventName,
					event_date: customEventDate,
					event_status: 'LIVE',
					is_custom: true,
					event_venue: venue || null
				})
				.select('event_id')
				.single();

			if (eventError) {
				console.error('Error creating shell event in "events" table:', eventError);
				throw eventError;
			}
			finalEventId = newEvent.event_id;
			console.log(`Shell event created with new unique ID: ${finalEventId}`);
		}

		if (finalEventId === null) {
			throw new Error('Could not determine a valid event ID for the advance.');
		}

		console.log(`Creating advance record for event ID: ${finalEventId}`);
		const { data, error } = await supabase
			.from('events_advance')
			.insert({
				event_id: finalEventId,
				artist_name: artistName,
				artist_type: artistType || null
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating record in "events_advance" table:', error);
			throw error;
		}

		console.log('Successfully created event advance:', data);
		return data;
	} catch (error) {
		console.error('Fatal error in createEventAdvance:', error);
		throw error;
	}
}

export async function updateEventAdvance(
	originalEventId: number,
	artistName: string,
	updates: Record<string, any>
) {
	try {
		console.log(`Updating event advance for ${artistName} on event ${originalEventId} with:`, updates);
		
		// First check if the record exists
		const { data: existingRecord, error: checkError } = await supabase
			.from('events_advance')
			.select('*')
			.eq('event_id', originalEventId)
			.eq('artist_name', artistName)
			.single();

		if (checkError || !existingRecord) {
			console.error('Record not found for update:', { 
				event_id: originalEventId, 
				artist_name: artistName,
				error: checkError 
			});
			throw new Error(`No record found for event_id: ${originalEventId}, artist_name: ${artistName}`);
		}

		console.log('Existing record calendar fields:', {
			calendar_synced: existingRecord.calendar_synced,
			calendar_sync_time: existingRecord.calendar_sync_time,
			calendar_event_ids: existingRecord.calendar_event_ids
		});

		// Now perform the update with RPC if direct update fails
		const { data: updateData, error: updateError } = await supabase
			.from('events_advance')
			.update(updates)
			.eq('event_id', originalEventId)
			.eq('artist_name', artistName)
			.select();

		if (updateError) {
			console.error('Error updating event advance record:', updateError);
			console.error('Update error details:', {
				code: updateError.code,
				message: updateError.message,
				details: updateError.details,
				hint: updateError.hint
			});
			
			// Check if it's a column not found error
			if (updateError.message?.includes('column') || updateError.code === '42703') {
				console.error('Database schema issue: The calendar sync columns might not exist in the events_advance table');
				console.error('Required columns: calendar_synced (boolean), calendar_sync_time (timestamp), calendar_event_ids (jsonb)');
			}
			
			throw updateError;
		}

		// Log what was actually updated
		if (updateData && updateData.length > 0) {
			console.log('Update response data:', updateData[0]);
			console.log('Calendar fields after update:', {
				calendar_synced: updateData[0].calendar_synced,
				calendar_sync_time: updateData[0].calendar_sync_time,
				calendar_event_ids: updateData[0].calendar_event_ids
			});
			return updateData[0];
		}

		// Fallback: fetch the updated record
		const { data: updatedRecord, error: selectError } = await supabase
			.from('events_advance')
			.select('*')
			.eq('event_id', originalEventId)
			.eq('artist_name', artistName)
			.single();

		if (selectError) {
			console.warn('Could not fetch updated record:', selectError);
			// Return the existing record merged with updates as fallback
			return { ...existingRecord, ...updates };
		}

		console.log('Successfully updated event advance record:', updatedRecord);
		console.log('Final calendar fields:', {
			calendar_synced: updatedRecord.calendar_synced,
			calendar_sync_time: updatedRecord.calendar_sync_time,
			calendar_event_ids: updatedRecord.calendar_event_ids
		});
		return updatedRecord;
	} catch (error) {
		console.error('Fatal error in updateEventAdvance:', error);
		throw error;
	}
}

export async function deleteEventAdvance(
	eventId: number,
	artistName: string,
	contractUrl?: string | null,
	passportInfo?: any | null
) {
	try {
		console.log('Deleting event advance entry and associated files...');
		if (contractUrl) {
			await deleteFileByUrl(contractUrl);
		}
		if (passportInfo) {
			/* (Your logic to parse and delete passport images) */
		}
		await cleanupEventFiles(eventId, artistName);

		const { error: deleteAdvanceError } = await supabase
			.from('events_advance')
			.delete()
			.eq('event_id', eventId)
			.eq('artist_name', artistName);

		if (deleteAdvanceError) {
			console.error('Error deleting event advance from DB:', deleteAdvanceError);
			throw deleteAdvanceError;
		}
		console.log('Successfully deleted advance record.');
	} catch (error) {
		console.error('Error in deleteEventAdvance:', error);
		throw error;
	}
}

/**
 * MODIFICATION: The returned object now strictly aligns with your provided schema.
 */
export async function fetchEventById(eventId: string): Promise<EventAdvance | null> {
	try {
		console.log('Fetching event with id:', eventId);
		let numericEventId: number;
		let artistName: string | null = null;

		if (eventId.includes('-')) {
			const parts = eventId.split('-');
			numericEventId = parseInt(parts[0]);
			artistName = parts.slice(1).join('-');
		} else {
			numericEventId = parseInt(eventId);
		}

		let eventData = null;
		const { data: event, error: eventError } = await supabase
			.from('events')
			.select(
				'event_id, event_name, event_date, event_artist, event_status, event_genre, event_flyer, event_tags, event_venue'
			)
			.eq('event_id', numericEventId)
			.single();

		if (eventError) {
			console.warn('Event not found in events table:', eventError);
		} else {
			eventData = event;
		}

		let query = supabase
			.from('events_advance')
			.select('*')
			.eq('event_id', numericEventId);
		if (artistName) {
			query = query.eq('artist_name', artistName);
		}
		const { data: advanceData, error: advanceError } = await query.single();

		if (advanceError) {
			console.error('Advance data not found:', advanceError);
			return null;
		}

		const finalEventName = eventData?.event_name || 'Unnamed Event';
		const finalEventDate = eventData?.event_date ? formatEventDate(eventData.event_date) : 'TBD';

		const combinedData: EventAdvance = {
			// Base fields from events_advance
			id: `${advanceData.event_id}-${advanceData.artist_name}`,
			event_id: advanceData.event_id,
			artist_name: advanceData.artist_name,
			artist_type: advanceData.artist_type,
			dos: advanceData.dos,
			main_contact: advanceData.main_contact,
			contract_url: advanceData.contract_url,
			roles: advanceData.roles,
			passport_info: advanceData.passport_info,
			hotel_info: advanceData.hotel_info,
			immigration_info: advanceData.immigration_info,
			immigration_status: advanceData.immigration_status,
			tech_rider: advanceData.tech_rider,
			sfx_rider: advanceData.sfx_rider,
			soundcheck: advanceData.soundcheck,
			hospo_rider: advanceData.hospo_rider,
			ground_transport: advanceData.ground_transport,
			ground_info: advanceData.ground_info,
			advance_completed: advanceData.advance_completed,
			asked: advanceData.asked,
			contract: advanceData.contract,
			role_list: advanceData.role_list,
			ground_done: advanceData.ground_done,
			created_at: advanceData.created_at,
			updated_at: advanceData.updated_at,
			artist_bio: advanceData.artist_bio,
			artist_bio_url: advanceData.artist_bio_url,
			rider_files: advanceData.rider_files,
			visuals: advanceData.visuals,
			visual_received: advanceData.visual_received,
			calendar_synced: advanceData.calendar_synced,
			calendar_sync_time: advanceData.calendar_sync_time,
			calendar_event_ids: advanceData.calendar_event_ids,

			// Computed fields for UI
			name: finalEventName,
			date: finalEventDate,
			progress: calculateDynamicProgress(advanceData),
			poster: eventData?.event_flyer || null,
			tags: eventData?.event_tags || [],

			// Joined fields from events table
			venue: eventData?.event_venue || null,
			event_venue: eventData?.event_venue || null,
			event_flyer: eventData?.event_flyer || null,
			event_name: finalEventName,
			event_date: eventData?.event_date || null,
			event_artist: eventData?.event_artist,
			event_status: eventData?.event_status,
			event_genre: eventData?.event_genre,
			event_tags: eventData?.event_tags || []
		};

		return combinedData;
	} catch (err) {
		console.error('Error fetching event by ID:', err);
		throw new Error(
			`Failed to fetch event: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
}
