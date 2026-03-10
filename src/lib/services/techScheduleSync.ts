// src/lib/services/techScheduleSync.ts
import { supabase } from '$lib/supabase';
import type { CalendarEvent } from '$lib/types/calendar-types';
import type { TechRow } from '$lib/types/tech-schedule';
import { syncRowToCalendar } from '$lib/services/calendar';
import dayjs from 'dayjs';

/**
 * Converts { start: "10:00", end: "18:00" } to "10AM-6PM"
 */
function formatOpHours(start?: string | null, end?: string | null): string {
	if (!start || !end) return '';

	// 👇 NEW: Check for All Day events and return empty string
	if (start === '00:00' && end === '23:59') return '';

	const formatTime = (time24: string) => {
		const [h, m] = time24.split(':').map(Number);
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return m > 0 ? `${h12}:${m.toString().padStart(2, '0')}${ampm}` : `${h12}${ampm}`;
	};
	return `${formatTime(start)}-${formatTime(end)}`;
}

export async function syncEventToTechSchedule(
	event: CalendarEvent,
	newStatus: 'CONFIRMED' | 'HOLD' | 'CANCELED'
) {
	// --- 1. SAFE PARSING ---
	// Prevent undefined errors if Supabase passes JSONB as a string
	const venueObj = typeof event.venue === 'string' ? JSON.parse(event.venue) : event.venue || {};
	const detailsObj =
		typeof event.details === 'string' ? JSON.parse(event.details) : event.details || {};
	const timeObj = typeof event.time === 'string' ? JSON.parse(event.time) : event.time || {};

	const venueCategoryName = venueObj.category; // e.g., "New City Gas"
	const eventType = detailsObj.type;

	// --- 2. HANDLE CANCELLATIONS / HOLDS ---
	if (newStatus === 'CANCELED' || newStatus === 'HOLD') {
		const { data: existingRows } = await supabase
			.from('schedule_techs')
			.select('*')
			.eq('group_id', event.group_id);

		if (existingRows && existingRows.length > 0) {
			for (const row of existingRows) {
				const updatedRow = { ...row, type: 'Canceled' };
				// Update DB to Canceled
				await supabase.from('schedule_techs').update({ type: 'Canceled' }).eq('id', row.id);
				// Trigger Google Calendar Delete
				await syncRowToCalendar(updatedRow, 'DELETE', row);
			}
		}
		return; // Stop here for cancellations
	}

	// --- 3. HANDLE CONFIRMATIONS ---
	if (newStatus === 'CONFIRMED') {
		const { data: settings } = await supabase
			.from('calendar_settings')
			.select('setting_params')
			.eq('setting_name', 'Schedule Tech Sync')
			.single();

		if (!settings?.setting_params) return;

		let params;
		try {
			params =
				typeof settings.setting_params === 'string'
					? JSON.parse(settings.setting_params)
					: settings.setting_params;
		} catch (e) {
			console.error('Failed to parse Schedule Tech Sync settings', e);
			return;
		}

		if (!params.enabled) return;

		// --- 4. UUID TO NAME TRANSLATION ---
		const allowedVenueIds = params.venues || [];
		const allowedTypes = params.types || [];

		if (allowedVenueIds.length === 0 || allowedTypes.length === 0) return;

		// Fetch the actual string names of the allowed venues
		const { data: allowedVenuesData } = await supabase
			.from('calendar_settings')
			.select('setting_name')
			.in('id', allowedVenueIds);

		const allowedVenueNames = allowedVenuesData?.map((v) => v.setting_name) || [];

		// --- 5. VALIDATE CRITERIA ---
		const isVenueAllowed = allowedVenueNames.includes(venueCategoryName);
		const isTypeAllowed = allowedTypes.includes(eventType);

		// Stop if it doesn't meet BOTH criteria
		if (!isVenueAllowed || !isTypeAllowed) return;

		const eventDate = event.date;
		const year = dayjs(eventDate).year();

		// --- 6. FIND OR CREATE ROW ---
		const { data: existingByGroup } = await supabase
			.from('schedule_techs')
			.select('*')
			.eq('group_id', event.group_id)
			.single();

		let targetRow: TechRow | null = existingByGroup;
		let isNew = false;

		if (!targetRow) {
			// Look for an empty row on this date
			const { data: dayRows } = await supabase
				.from('schedule_techs')
				.select('*')
				.eq('date', eventDate)
				.order('sort_order', { ascending: true });

			const emptyRow = dayRows?.find(
				(r) => (!r.event_name || r.event_name.trim() === '') && (!r.type || r.type.trim() === '')
			);

			if (emptyRow) {
				targetRow = emptyRow as TechRow;
			} else {
				// No empty row -> Create one
				isNew = true;
				const maxSortOrder = dayRows?.length ? Math.max(...dayRows.map((r) => r.sort_order)) : 0;
				targetRow = {
					date: eventDate,
					year: year,
					sort_order: maxSortOrder + 1
				} as TechRow;
			}
		}

		// --- 7. PREPARE DATA ---
		const opHours = formatOpHours(timeObj.start, timeObj.end);

		let updates: Partial<TechRow> = {
			event_name: event.title || (event as any).calendar?.title || 'Unnamed Event',
			type: eventType as string,
			op_hours: opHours,
			group_id: event.group_id
		};

		// --- 8. "TO BOOK" AUTO-FILL LOGIC ---
		const targetTypes = ['NCGSHOW', 'NCG360', 'DSTRKT', 'TOURPROD'];
		const normalizedType = String(eventType).toUpperCase().replace(/\s+/g, '');

		if (targetTypes.includes(normalizedType)) {
			const staffCols: (keyof TechRow)[] = [
				'ld',
				'video',
				'vj',
				'sound',
				'tech_sm',
				'dt',
				'artist_liaison'
			];
			staffCols.forEach((col) => {
				const currentVal = targetRow![col];
				if (!currentVal || String(currentVal).trim() === '') {
					updates[col] = 'To Book' as any;
				}
			});
		}

		// --- 9. SAVE & GOOGLE CALENDAR SYNC ---
		const finalRow = { ...targetRow, ...updates } as TechRow;

		if (isNew) {
			const { data: inserted, error } = await supabase
				.from('schedule_techs')
				.insert(finalRow)
				.select()
				.single();
			if (inserted && !error) {
				await syncRowToCalendar(inserted as TechRow, 'INSERT');
			}
		} else {
			const { data: updated, error } = await supabase
				.from('schedule_techs')
				.update(updates)
				.eq('id', targetRow.id)
				.select()
				.single();
			if (updated && !error) {
				await syncRowToCalendar(updated as TechRow, 'UPDATE', targetRow);
			}
		}
	}
}
