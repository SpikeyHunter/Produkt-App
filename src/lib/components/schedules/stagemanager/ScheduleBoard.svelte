<script context="module" lang="ts">
	declare global {
		namespace svelteHTML {
			interface HTMLAttributes<T> {
				'on:click_outside'?: (event: CustomEvent<HTMLElement>) => void;
			}
		}
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { supabase } from '$lib/supabase';
	import type { User } from '@supabase/supabase-js';
	import type { Staff, ScheduleWeek, Shift, StaffRow } from '$lib/types/schedule';
	import { calculateHours, getWeekRangeString } from '$lib/utils/timeUtils';
	import ShiftModal from './ShiftModal.svelte';
	import ManagerStaffModal from '../ManagerStaffModal.svelte';
	import { goto } from '$app/navigation';

	export let currentUser: User | null = null;
	// ---- PERMISSIONS LOGIC ----
	// Only Supabase users can edit. Guests (Password) are Read-Only.
	$: canEdit = currentUser !== null;

	const HEX_COLORS: Record<string, string> = {
		Bazart: '#e9e9e9',
		'Bazart Nuits': '#ffe5a0',
		'Moet City': '#f8edd3',
		'NCG Show': '#d4edbc',
		'NCG 360': '#ffcfc9',
		DSTRKT: '#bfe1f6',
		'Tour Production': '#c6dbe1',
		Corpo: '#e6cff2',
		Maintenance: '#ffc8aa',
		Other: '#fdfdfd',
		Office: 'transparent',
		OFF: '#333333',
		LD: '#555555' // Added LD color
	};

	const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
	
	let weeks: ScheduleWeek[] = [];
	let staffList: Staff[] = [];
	let isLoading = true;
	let viewMode: 'current' | 'past' = 'current';

	let activeAddWeekId: number | null = null;
	let staffSearchTerm = '';
	let confirmDeleteWeekId: number | null = null;
	let confirmDeleteRow: { weekId: number; staffId: number } | null = null;

	let isModalOpen = false;
	let isStaffModalOpen = false;
	let modalData: {
		staff: Staff;
		weekId: number;
		dayIdx: number;
		shift: Partial<Shift>;
		dayShiftCount: number;
		existingShifts: Shift[];
	} | null = null;

	// COPY / PASTE STATE
	let copiedShift: Partial<Shift> | null = null;

	// HOVER TRACKING
	let hoveredShift: Shift | null = null;
	let hoveredSlot: { weekId: number; staffId: number; dayIdx: number } | null = null;
	let realtimeChannel: any = null;

	onMount(async () => {
		await loadData();
		setupRealtime();
	});

	onDestroy(() => {
		if (realtimeChannel) supabase.removeChannel(realtimeChannel);
	});

	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
				node.dispatchEvent(new CustomEvent('click_outside', { detail: node }));
			}
		};
		document.addEventListener('click', handleClick, true);
		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	function focusInput(node: HTMLElement) {
		node.focus();
	}

	function setupRealtime() {
		if (realtimeChannel) return;
		realtimeChannel = supabase
			.channel('schedule_board_main')
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule_weeks' },
				(payload) => handleWeekChange(payload)
			)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'schedule_shifts' },
				(payload) => handleShiftChange(payload)
			)
			.on('postgres_changes', { event: '*', schema: 'public', table: 'prod_staff' }, () =>
				loadStaffOnly()
			)
			.subscribe();
	}

	function handleWeekChange(payload: any) {
		if (payload.eventType === 'INSERT') {
			if (!weeks.find((w) => w.id === payload.new.id)) {
				weeks = [...weeks, { ...payload.new, shifts: [] }];
			}
		} else if (payload.eventType === 'DELETE') {
			weeks = weeks.filter((w) => w.id !== payload.old.id);
		}
	}

	function handleShiftChange(payload: any) {
		if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
			reloadShiftsOnly();
		} else if (payload.eventType === 'DELETE') {
			const deletedId = payload.old.id;
			weeks = weeks.map((week) => ({
				...week,
				shifts: week.shifts.filter((s) => s.id !== deletedId)
			}));
		}
	}

	async function loadData() {
		isLoading = true;
		await Promise.all([loadStaffOnly(), loadWeeksAndShifts()]);
		isLoading = false;
	}

	async function loadStaffOnly() {
		const { data } = await supabase.from('prod_staff').select('*').order('name');
		if (data) staffList = data;
	}

	async function reloadShiftsOnly() {
		if (weeks.length === 0) return;
		const weekIds = weeks.map((w) => w.id);
		const { data: shiftsData } = await supabase
			.from('schedule_shifts')
			.select('*')
			.in('week_id', weekIds);
		if (shiftsData) {
			weeks = weeks.map((week) => ({
				...week,
				shifts: shiftsData.filter((s) => s.week_id === week.id)
			}));
		}
	}

	async function loadWeeksAndShifts() {
		const { data: weeksData } = await supabase
			.from('schedule_weeks')
			.select('*')
			.order('start_date', { ascending: true });
		if (weeksData) {
			const weekIds = weeksData.map((w) => w.id);
			const { data: shiftsData } = await supabase
				.from('schedule_shifts')
				.select('*')
				.in('week_id', weekIds);
			weeks = weeksData.map((week) => ({
				...week,
				shifts: shiftsData ? shiftsData.filter((s) => s.week_id === week.id) : []
			}));
		}
	}

	function formatHours(h: number): string {
		return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
	}

	function formatTimeDisplay(timeStr: string): string {
		if (!timeStr) return '';
		const [h, m] = timeStr.split(':').map(Number);
		const ampm = h >= 12 ? 'pm' : 'am';
		const h12 = h % 12 || 12;
		const mStr = m === 0 ? '' : `:${m.toString().padStart(2, '0')}`;
		return `${h12}${mStr}${ampm}`;
	}

	function getCardStyle(type: string): string {
		if (type === 'Office')
			return `background-color: transparent; color: #ffffff; border: 1px solid rgba(255,255,255,0.2);`;
		if (type === 'OFF')
			return `background-color: #333333; color: #888888; border: 1px solid #444444;`;
		if (type === 'LD')
			return `background-color: #555555; color: #ffffff; border: 1px solid #666666;`;
		const bg = HEX_COLORS[type] || '#fdfdfd';
		return `background-color: ${bg}; color: #222; border: 1px solid rgba(0,0,0,0.1);`;
	}

	// Helper to safely check types avoiding TS intersection errors
	function isNoTimeShift(type: string): boolean {
		return type === 'OFF' || type === 'LD';
	}

	function getFirstName(fullName: string): string {
		return fullName.split(' ')[0];
	}

	$: sortedWeeks = (() => {
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const current = [];
		const past = [];
		for (const w of weeks) {
			const weekEnd = new Date(w.start_date);
			weekEnd.setDate(weekEnd.getDate() + 7);
			if (weekEnd >= now) current.push(w);
			else past.push(w);
		}
		return viewMode === 'current'
			? current.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
			: past.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
	})();

	$: filteredStaffList = (weekId: number) => {
		if (!activeAddWeekId) return [];
		const week = weeks.find((w) => w.id === weekId);
		if (!week) return [];
		const existingStaffIds = new Set(week.shifts.map((s) => s.staff_id));
		return staffList.filter(
			(s) =>
				!existingStaffIds.has(s.id) && s.name.toLowerCase().includes(staffSearchTerm.toLowerCase())
		);
	};

	async function createNextWeek() {
		// Permissions Check
		if (!canEdit || viewMode === 'past') return;

		let nextStart = new Date();
		if (weeks.length > 0) {
			const latestWeek = [...weeks].sort(
				(a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
			)[0];
			const lastDate = new Date(latestWeek.start_date + 'T00:00:00');
			nextStart = new Date(lastDate);
			nextStart.setDate(lastDate.getDate() + 7);
		} else {
			nextStart.setDate(nextStart.getDate() - nextStart.getDay());
			nextStart.setHours(0, 0, 0, 0);
		}
		const dateStr = nextStart.toISOString().split('T')[0];
		await supabase.from('schedule_weeks').insert({ start_date: dateStr });
		viewMode = 'current';
	}

	async function deleteWeek(weekId: number) {
		// Permissions Check
		if (!canEdit) return;

		weeks = weeks.filter((w) => w.id !== weekId);
		confirmDeleteWeekId = null;
		await supabase.from('schedule_weeks').delete().eq('id', weekId);
	}

	async function deleteRow(weekId: number, staffId: number) {
		// Permissions Check
		if (!canEdit) return;
		const wIdx = weeks.findIndex((w) => w.id === weekId);
		if (wIdx >= 0) {
			weeks[wIdx].shifts = weeks[wIdx].shifts.filter((s) => s.staff_id !== staffId);
			weeks = [...weeks];
			await supabase.from('schedule_shifts').delete().match({ week_id: weekId, staff_id: staffId });
		}
		confirmDeleteRow = null;
	}

	async function addStaffToWeek(weekId: number, staffId: number) {
		const wIdx = weeks.findIndex((w) => w.id === weekId);
		if (wIdx >= 0 && weeks[wIdx].shifts.some((s) => s.staff_id === staffId)) {
			activeAddWeekId = null;
			return;
		}
		const placeholder = {
			week_id: weekId,
			staff_id: staffId,
			day_index: 0,
			start_time: '00:00',
			end_time: '00:00',
			shift_type: 'PLACEHOLDER' as any
		};
		const { data } = await supabase.from('schedule_shifts').insert(placeholder).select().single();
		if (data) {
			const idx = weeks.findIndex((w) => w.id === weekId);
			if (idx >= 0 && !weeks[idx].shifts.find((s) => s.id === data.id)) {
				weeks[idx].shifts.push(data);
				weeks = [...weeks];
			}
			activeAddWeekId = null;
		}
	}

	async function handleModalSave(e: CustomEvent) {
		// Permissions Check
		if (!modalData || !canEdit) return;

		const details = e.detail;
		const shiftToSave = {
			...modalData.shift,
			week_id: modalData.weekId,
			staff_id: modalData.staff.id,
			day_index: modalData.dayIdx,
			start_time: details.start_time,
			end_time: details.end_time,
			shift_type: details.shift_type,
			custom_label: details.custom_label
		};
		await supabase.from('schedule_shifts').upsert(shiftToSave).select().single();
	}

	async function handleModalDelete(e: CustomEvent) {
		// Permissions Check
		if (!canEdit) return;

		const shiftId = e.detail;
		weeks.forEach((w) => (w.shifts = w.shifts.filter((s) => s.id !== shiftId)));
		weeks = [...weeks];
		await supabase.from('schedule_shifts').delete().eq('id', shiftId);
	}

	function handleAddAnotherShift(e: CustomEvent) {
		if (!modalData) return;
		isModalOpen = true;
		modalData = { ...modalData, shift: {} };
	}

	function openModal(
		weekId: number,
		staff: Staff,
		dayIdx: number,
		shift: Shift | null,
		currentShiftsInDay: number
	) {
		// Permissions Check
		if (!canEdit) return;

		let existingShifts: Shift[] = [];
		const week = weeks.find((w) => w.id === weekId);
		if (week) {
			existingShifts = week.shifts.filter((s) => s.staff_id === staff.id && s.day_index === dayIdx);
		}

		modalData = {
			weekId,
			staff,
			dayIdx,
			shift: shift || {},
			dayShiftCount: currentShiftsInDay,
			existingShifts: existingShifts
		};
		isModalOpen = true;
	}

	function getStaffForWeek(week: ScheduleWeek, currentStaffList: Staff[]): StaffRow[] {
		let visibleStaff = currentStaffList.filter((s) => s.stage_manager);
		const activeStaffIds = new Set(week.shifts.map((s) => s.staff_id));
		currentStaffList.forEach((s) => {
			if (activeStaffIds.has(s.id) && !s.stage_manager) {
				if (!visibleStaff.find((vs) => vs.id === s.id)) visibleStaff.push(s);
			}
		});
		visibleStaff.sort((a, b) => a.name.localeCompare(b.name));
		return visibleStaff.map((staff) => {
			const staffShifts: Shift[][] = Array.from({ length: 7 }, () => []);
			let totalHours = 0;
			week.shifts
				.filter((s) => s.staff_id === staff.id)
				.forEach((shift) => {
					if ((shift.shift_type as string) !== 'PLACEHOLDER') {
						staffShifts[shift.day_index].push(shift);
						// Force cast to string to avoid TS error on 'LD'
						const sType = shift.shift_type as string;
						if (sType !== 'OFF' && sType !== 'LD') {
							totalHours += calculateHours(shift.start_time, shift.end_time);
						}
					}
				});
			staffShifts.forEach((dayShifts) =>
				dayShifts.sort((a, b) => a.start_time.localeCompare(b.start_time))
			);
			return { staff, shifts: staffShifts, totalHours };
		});
	}

	function calculateDailyTotals(rows: StaffRow[]): number[] {
		const totals = Array(7).fill(0);
		rows.forEach((row) => {
			row.shifts.forEach((dayShifts, dayIdx) => {
				dayShifts.forEach((shift) => {
					// Force cast to string to avoid TS error on 'LD'
					const sType = shift.shift_type as string;
					if (shift && sType !== 'OFF' && sType !== 'LD') {
						totals[dayIdx] += calculateHours(shift.start_time, shift.end_time);
					}
				});
			});
		});
		return totals;
	}

	// ---- GLOBAL KEYBOARD SHORTCUTS ----

	function handleGlobalKeyDown(e: KeyboardEvent) {
		// PERMISSIONS: Strict check - Must be Authenticated to use shortcuts
		if (!canEdit) return;
		const isCmd = e.ctrlKey || e.metaKey;
		const key = e.key.toLowerCase();
		// CUT: Cmd + X (Hovering Shift)
		if (isCmd && key === 'x' && hoveredShift && hoveredShift.id) {
			e.preventDefault();
			copiedShift = { ...hoveredShift };
			delete copiedShift.id;
			handleModalDelete({ detail: hoveredShift.id } as CustomEvent);
		}

		// COPY: Cmd + C (Hovering Shift)
		if (isCmd && key === 'c' && hoveredShift) {
			e.preventDefault();
			copiedShift = { ...hoveredShift };
			delete copiedShift.id;
		}

		// PASTE: Cmd + V (Hovering Slot)
		if (isCmd && key === 'v' && copiedShift && hoveredSlot) {
			e.preventDefault();
			const { weekId, staffId, dayIdx } = hoveredSlot;

			// Limit check: Max 2 shifts per slot
			const wIdx = weeks.findIndex((w) => w.id === weekId);
			if (wIdx >= 0) {
				const count = weeks[wIdx].shifts.filter(
					(s) =>
						s.staff_id === staffId &&
						s.day_index === dayIdx &&
						(s.shift_type as string) !== 'PLACEHOLDER'
				).length;
				if (count >= 2) return;
			}

			const newShift = { ...copiedShift, week_id: weekId, staff_id: staffId, day_index: dayIdx };
			supabase.from('schedule_shifts').insert(newShift).select().single();
		}
	}
</script>

<svelte:window on:keydown={handleGlobalKeyDown} />

<div class="h-full w-full p-6 text-white overflow-y-auto">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
		<div><h1 class="text-3xl font-bold mb-1">Schedule - Stage Manager</h1></div>
		<div class="flex gap-4 items-start">
			<button
				class="flex items-center gap-2 px-3 py-2.5 rounded-4xl border border-gray2/30 text-gray2 transition-all text-xs font-bold hover:text-lime hover:border-lime hover:cursor-pointer"
				on:click={() => goto('/schedules/tech')}
			>
				<span class="uppercase tracking-wider">Schedule Techs</span>
			</button>

			<div class="flex bg-gray2/20 p-1 rounded-full border border-gray2/30 h-10">
				<button
					class="px-4 rounded-full text-sm hover:cursor-pointer font-medium transition-all {viewMode === 'current'
						? 'bg-lime text-black font-bold shadow-lg'
						: 'text-gray2 hover:text-white'}"
					on:click={() => (viewMode = 'current')}>Current</button
				>
				<button
					class="px-4 rounded-full text-sm hover:cursor-pointer font-medium transition-all {viewMode === 'past'
						? 'bg-white text-black font-bold shadow-lg'
						: 'text-gray2 hover:text-white'}"
					on:click={() => (viewMode = 'past')}>Past</button
				>
			</div>

			{#if canEdit}
				<div class="flex flex-col items-end gap-2">
					<button
						class="h-10 px-5 bg-lime text-black font-bold rounded-full hover:bg-lime/90 transition-all cursor-pointer text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
						on:click={createNextWeek}
						disabled={viewMode === 'past'}
					>
						<span>+</span> <span class="hidden md:inline">Add Next Week</span>
					</button>
					<button
						class="text-xs text-gray2 hover:text-white underline transition-colors"
						on:click={() => (isStaffModalOpen = true)}>Set Default Staff</button
					>
				</div>
			{/if}
		</div>
	</div>

	<div class="flex flex-col gap-12 pb-20">
		{#each sortedWeeks as week (week.id)}
			{@const rows = getStaffForWeek(week, staffList)}
			{@const dailyTotals = calculateDailyTotals(rows)}
			<div
				class="bg-gray2/5 rounded-2xl p-6 border border-gray2/10 relative group/week transition-all hover:border-gray2/20"
			>
				<div class="flex justify-between items-start mb-6">
					<h2 class="text-2xl font-bold text-lime">
						Week of {getWeekRangeString(week.start_date)}
					</h2>
					<div class="flex items-center gap-4">
						{#if canEdit}
							<div class="flex items-center gap-3 relative">
								<button
									class="px-3 py-1.5 rounded-lg bg-gray2/20 hover:bg-gray2/40 text-sm font-medium text-white flex items-center gap-2 cursor-pointer transition-colors border border-gray2/30"
									on:click|stopPropagation={() => {
										activeAddWeekId = activeAddWeekId === week.id ? null : week.id;
										staffSearchTerm = '';
									}}
								>
									<svg
										class="w-4 h-4"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
											cx="8.5"
											cy="7"
											r="4"
										/><line x1="20" y1="8" x2="20" y2="14" /><line
											x1="23"
											y1="11"
											x2="17"
											y2="11"
										/></svg
									> Add Staff
								</button>
								{#if confirmDeleteWeekId === week.id}
									<button
										class="w-8 h-8 rounded-lg bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
										aria-label="Confirm delete week"
										on:click={() => deleteWeek(week.id)}
									>
										<svg
											class="w-5 h-5"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg
										>
									</button>
								{:else}
									<button
										class="w-8 h-8 rounded-lg bg-gray2/20 text-gray2 hover:bg-red-500/20 hover:text-red-500 border border-transparent hover:border-red-500/30 flex items-center justify-center transition-colors cursor-pointer"
										aria-label="Delete week"
										on:click={() => (confirmDeleteWeekId = week.id)}
										on:mouseleave={() =>
											setTimeout(() => {
												if (confirmDeleteWeekId === week.id) confirmDeleteWeekId = null;
											}, 2000)}
									>
										<svg
											class="w-4 h-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											><line x1="18" y1="6" x2="6" y2="18" /><line
												x1="6"
												y1="6"
												x2="18"
												y2="18"
											/></svg
										>
									</button>
								{/if}
								{#if activeAddWeekId === week.id}
									<div
										class="absolute right-0 top-full mt-2 w-64 bg-gray1 border border-gray2 rounded-xl shadow-2xl z-30 flex flex-col overflow-hidden"
										use:clickOutside
										on:click_outside={() => (activeAddWeekId = null)}
									>
										<div class="p-3 border-b border-gray2/20 bg-gray2/10">
											<input
												type="text"
												bind:value={staffSearchTerm}
												use:focusInput
												placeholder="Search name..."
												class="w-full bg-black/30 border border-gray2/20 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-lime"
											/>
										</div>
										<div class="max-h-60 overflow-y-auto">
											{#each filteredStaffList(week.id) as s}
												<button
													class="w-full text-left px-4 py-3 hover:bg-lime/10 hover:text-lime text-sm border-b border-gray2/5 last:border-0 transition-colors cursor-pointer"
													on:click={() => addStaffToWeek(week.id, s.id)}>{s.name}</button
												>
											{:else}
												<div class="p-4 text-xs text-gray2 text-center italic">No staff found</div>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>

				<div class="overflow-x-auto rounded-lg border border-gray2/10">
					<table class="w-full min-w-[900px] border-collapse bg-black/20 table-fixed">
						<thead>
							<tr class="bg-gray2/10">
								<th
									class="text-left p-3 text-xs font-bold text-gray2 uppercase tracking-wider w-32 sticky left-0 bg-[#1a1a1a] z-10 border-r border-gray2/10"
									>Staff</th
								>
								{#each DAYS_FULL as day, i}
									{@const date = new Date(week.start_date + 'T00:00:00')}
									{@const dayDate = new Date(date.setDate(date.getDate() + i))}
									{@const dateString = dayDate.toLocaleDateString('en-US', {
										day: 'numeric',
										month: 'short'
									})}
									<th
										class="text-center p-3 text-xs font-bold text-gray2 uppercase tracking-wider border-l border-gray2/10"
									>
										<span class="hidden lg:inline">{day} - {dateString}</span>
										<span class="lg:hidden">{DAYS_SHORT[i]}</span>
									</th>
								{/each}
								<th
									class="text-center p-3 text-xs font-bold text-gray2 uppercase tracking-wider border-l border-gray2/10 w-20"
									>Total</th
								>
								{#if canEdit}
									<th class="w-12 p-0 border-l border-gray2/10"></th>
								{/if}
							</tr>
						</thead>
						<tbody>
							{#each rows as row}
								<tr class="border-t border-gray2/10 hover:bg-white/5 transition-colors group/row">
									<td
										class="p-3 font-medium text-white sticky left-0 bg-[#1a1a1a] group-hover/row:bg-[#252525] z-10 border-r border-gray2/10 truncate"
										>{getFirstName(row.staff.name)}</td
									>
									{#each row.shifts as dayShifts, i}
										<td
											class="p-1 border-l border-gray2/10 h-14 relative group/cell align-top outline-none focus:bg-white/10 transition-colors"
											tabindex="0"
											on:mouseenter={() =>
												(hoveredSlot = { weekId: week.id, staffId: row.staff.id, dayIdx: i })}
											on:mouseleave={() => (hoveredSlot = null)}
											on:focus={() =>
												(hoveredSlot = { weekId: week.id, staffId: row.staff.id, dayIdx: i })}
										>
											<div class="w-full h-full flex flex-col gap-1">
												{#if dayShifts.length > 0}
													{#each dayShifts as shift}
														<button
															type="button"
															disabled={!canEdit}
															class="w-full flex-1 rounded shadow-sm flex flex-col justify-center items-center overflow-hidden px-1 focus:outline-none focus:ring-2 focus:ring-lime"
															class:pointer-events-none={!canEdit}
															class:hover:scale-[1.02]={canEdit}
															class:cursor-pointer={canEdit}
															class:transition-transform={canEdit}
															style={getCardStyle(shift.shift_type)}
															on:click|stopPropagation={() =>
																openModal(week.id, row.staff, i, shift, dayShifts.length)}
															on:mouseenter={() => (hoveredShift = shift)}
															on:mouseleave={() => (hoveredShift = null)}
															on:focus={() => {
																hoveredShift = shift;
																hoveredSlot = { weekId: week.id, staffId: row.staff.id, dayIdx: i };
															}}
														>
															{#if isNoTimeShift(shift.shift_type)}
																<span class="font-bold text-xs" class:text-gray-400={shift.shift_type === 'OFF'}>{shift.shift_type}</span>
															{:else}
																<span class="font-bold whitespace-nowrap text-xs sm:text-sm"
																	>{formatTimeDisplay(shift.start_time)} - {formatTimeDisplay(
																		shift.end_time
																	)}</span
																>
																<span
																	class="opacity-80 w-full text-center truncate text-xs font-bold leading-none mt-0.5"
																	>{shift.shift_type}</span
																>
															{/if}
														</button>
													{/each}
												{:else if canEdit}
													<button
														type="button"
														class="w-full h-full flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer border-none bg-transparent"
														on:click={() => openModal(week.id, row.staff, i, null, 0)}
													>
														<div
															class="w-6 h-6 rounded-full bg-gray2/20 flex items-center justify-center text-gray2 hover:bg-lime hover:text-black transition-colors"
														>
															+
														</div>
													</button>
												{/if}
											</div>
										</td>
									{/each}
									<td
										class="p-3 text-center border-l border-gray2/10 font-mono text-lime font-bold text-sm"
										>{formatHours(row.totalHours)}</td
									>
									{#if canEdit}
										<td class="p-0 border-l border-gray2/10 text-center">
											{#if confirmDeleteRow?.weekId === week.id && confirmDeleteRow?.staffId === row.staff.id}
												<button
													class="w-full h-14 flex items-center justify-center bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
													on:click={() => deleteRow(week.id, row.staff.id)}
													title="Confirm Remove"
													><svg
														class="w-5 h-5"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg
													></button
												>
											{:else}
												<button
													class="w-full h-14 flex items-center justify-center text-gray2 hover:text-red-500 opacity-0 group-hover/row:opacity-100 
													transition-all cursor-pointer"
													on:click={() =>
														(confirmDeleteRow = { weekId: week.id, staffId: row.staff.id })}
													title="Remove Staff"
													><svg
														class="w-4 h-4"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														stroke-width="2"
														><polyline points="3 6 5 6 21 6" /><path
															d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
														/></svg
													></button
												>
											{/if}
										</td>
									{/if}
								</tr>
							{/each}
							<tr class="bg-gray2/10 font-bold border-t-2 border-gray2/20">
								<td
									class="p-3 text-gray2 text-right sticky left-0 bg-[#1f1f1f] z-10 border-r border-gray2/10 text-xs"
									>TOTALS</td
								>
								{#each dailyTotals as total}
									<td class="p-3 text-center text-gray2 border-l border-gray2/10 text-sm"
										>{total > 0 ? formatHours(total) : '-'}</td
									>
								{/each}
								<td class="p-3 text-center text-lime border-l border-gray2/10 text-sm"
									>{formatHours(rows.reduce((acc, r) => acc + r.totalHours, 0))}</td
								>
								{#if canEdit}<td></td>{/if}
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		{:else}
			<div class="flex flex-col items-center justify-center py-20 text-gray2">
				<p>No {viewMode} schedules found.</p>
				{#if canEdit && viewMode === 'current'}
					<button class="text-lime hover:underline mt-2 font-bold" on:click={createNextWeek}
						>Create one now</button
					>
				{/if}
			</div>
		{/each}
	</div>

	<ShiftModal
		isOpen={isModalOpen}
		staff={modalData?.staff ?? null}
		dayName={modalData ? DAYS_FULL[modalData.dayIdx] : ''}
		shift={modalData?.shift ?? {}}
		dayShiftCount={modalData?.dayShiftCount || 0}
		existingShifts={modalData?.existingShifts || []}
		on:close={() => (isModalOpen = false)}
		on:save={handleModalSave}
		on:delete={handleModalDelete}
		on:addAnother={handleAddAnotherShift}
	/>

	<ManagerStaffModal isOpen={isStaffModalOpen} on:close={() => (isStaffModalOpen = false)} />
</div>