// src/routes/api/google-calendar/+server.ts
// Updated to ensure proper Eastern Time handling

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncToCalendar } from '$lib/utils/GoogleCalendar';
import { updateEventAdvance } from '$lib/services/eventsService';
import type { CalendarSyncRequest } from '$lib/types/GoogleCalendar';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Parse and validate request body
		const requestData: CalendarSyncRequest = await request.json();
		const { rows, artistName, eventId, existingEventIds } = requestData;

		// Guests come from the client: artist liaisons (excluding Charles / Mezz,
		// who already own the calendar) plus any assigned drivers.
		const attendees: string[] = Array.isArray((requestData as any).attendees)
			? Array.from(
					new Set(
						(requestData as any).attendees
							.map((email: unknown) => String(email || '').trim().toLowerCase())
							.filter((email: string) => email.includes('@'))
					)
				)
			: [];

		// Validate required fields
		if (!rows || !Array.isArray(rows) || rows.length === 0) {
			return json(
				{
					success: false,
					error: 'No transport data provided'
				},
				{ status: 400 }
			);
		}

		if (!artistName || !eventId) {
			return json(
				{
					success: false,
					error: 'Missing required fields: artistName or eventId'
				},
				{ status: 400 }
			);
		}

		console.log(`Starting calendar sync for event ${eventId} - ${artistName}`);
		console.log(`Processing ${rows.length} transport entries`);
		console.log(
			attendees.length ? `Inviting ${attendees.length} guest(s): ${attendees.join(', ')}` : 'No guests to invite'
		);
		
		// Log sample entry for debugging timezone issues
		if (rows.length > 0) {
			console.log('Sample entry:', {
				date: rows[0].date,
				pickupTime: rows[0].pickupTime,
				type: rows[0].type
			});
		}

		// Sync with Google Calendar
		// The syncToCalendar function now handles all timezone conversions internally
		// Times in 'rows' are expected to be in HH:MM format (Eastern Time)
		// Dates are expected to be in YYYY-MM-DD format
		const result = await syncToCalendar(rows, artistName, existingEventIds, attendees);

		if (result.success) {
			try {
				// Update the event in database with calendar sync info
				const calendarSyncData = {
					calendar_synced: true,
					calendar_sync_time: new Date().toISOString(),
					calendar_event_ids: result.eventIds
				};

				await updateEventAdvance(parseInt(eventId), artistName, {
					ground_transport: rows,
					...calendarSyncData
				});

				console.log(`Successfully updated database for event ${eventId}`);

				return json({
					success: true,
					eventIds: result.eventIds,
					message: result.message || (existingEventIds ? 'Calendar updated successfully' : 'Events synced to calendar')
				});
			} catch (dbError: any) {
				console.error('Database update error:', dbError);
				// Calendar sync worked but DB update failed
				return json({
					success: true,
					eventIds: result.eventIds,
					message: 'Events synced to calendar (database update failed)',
					warning: 'Calendar sync succeeded but database update failed'
				});
			}
		} else {
			console.error('Calendar sync failed:', result.error);
			return json(
				{
					success: false,
					error: result.error || 'Failed to sync with calendar'
				},
				{ status: 500 }
			);
		}
	} catch (error: any) {
		console.error('Calendar sync API error:', error);
		
		// Provide more specific error messages
		let errorMessage = 'Internal server error';
		let statusCode = 500;

		if (error.name === 'SyntaxError') {
			errorMessage = 'Invalid JSON in request body';
			statusCode = 400;
		} else if (error.message?.includes('authentication') || error.message?.includes('credentials')) {
			errorMessage = 'Google Calendar authentication failed - check environment variables';
		} else if (error.message?.includes('quota') || error.message?.includes('rate')) {
			errorMessage = 'Google Calendar API quota exceeded - try again later';
		} else if (error.message) {
			errorMessage = error.message;
		}

		return json(
			{
				success: false,
				error: errorMessage,
				details: process.env.NODE_ENV === 'development' ? error.stack : undefined
			},
			{ status: statusCode }
		);
	}
};