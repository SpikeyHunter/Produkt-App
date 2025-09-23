// src/routes/api/calendar-sync/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncToCalendar } from '$lib/utils/GoogleCalendar';
import { updateEventAdvance } from '$lib/services/eventsService';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { rows, artistName, eventId, existingEventIds } = await request.json();

		// Sync with Google Calendar
		const result = await syncToCalendar(rows, artistName, existingEventIds);

		if (result.success) {
			// Update the event in database with calendar sync info
			const calendarSyncData = {
				calendar_synced: true,
				calendar_sync_time: new Date().toISOString(),
				calendar_event_ids: result.eventIds
			};

			await updateEventAdvance(eventId, artistName, {
				ground_transport: rows,
				...calendarSyncData
			});

			return json({
				success: true,
				eventIds: result.eventIds,
				message: existingEventIds ? 'Calendar updated successfully' : 'Events synced to calendar'
			});
		} else {
			return json(
				{
					success: false,
					error: result.error || 'Failed to sync with calendar'
				},
				{ status: 500 }
			);
		}
	} catch (error: any) {
		console.error('Calendar sync error:', error);
		return json(
			{
				success: false,
				error: error.message || 'Internal server error'
			},
			{ status: 500 }
		);
	}
};