<script lang="ts">
	import dayjs from 'dayjs';
	import customParseFormat from 'dayjs/plugin/customParseFormat';
	import { EVENT_COLORS, EVENT_TYPES, type TechRow } from '$lib/types/tech-schedule';
	import { createEventDispatcher, tick } from 'svelte';

	dayjs.extend(customParseFormat);

	export let row: TechRow;
	export let index: number;
	export let isSelected: boolean = false;
	export let gridStyle: string;
	export let currentYear: number;
	export let activeDropdownId: string | null = null;
	export let isDeleteMode = false;
	export let remotePresences: Record<
		string,
		{ user: string; color: string; field: string; rowId: string }
	> = {};
	export let userPermissions: {
		role: string;
		canAddYear: boolean;
		canEditAll: boolean;
		allowedColumns: string[];
	} = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };

	const dispatch = createEventDispatcher();
	const staffCols: (keyof TechRow)[] = ['ld', 'video', 'vj', 'sound', 'tech_sm'];

	let typeButtonRef: HTMLButtonElement;
	let dropdownPosition = { top: 0, left: 0, width: 0 };
	let dateInput = '';

	// LOCAL EDIT STATE
	let editBuffer: string = '';
	let activeField: string | null = null;

	$: if (row) syncInputsIfNeeded();

	function syncInputsIfNeeded() {
		if (activeField !== 'date') dateInput = dayjs(row.date).format('D MMM');
	}

	$: showTypeDropdown = activeDropdownId === row.id;
	$: if (showTypeDropdown && typeButtonRef) calculatePosition();

	const isWeekend = [0, 6].includes(dayjs(row.date).day());
	const canceledCSSText =
		'color: #ff0000; text-decoration: line-through; font-weight: bold; font-style: italic; background-color: transparent;';

	$: hasBackground =
		row.type &&
		row.type !== 'Hold' &&
		row.type !== 'Canceled' &&
		EVENT_COLORS[row.type] &&
		EVENT_COLORS[row.type] !== 'transparent';
	$: bgStyle =
		row.type === 'Canceled'
			? 'background-color: transparent;'
			: `background-color: ${EVENT_COLORS[row.type] || 'transparent'};`;
	$: textColorStyle = (() => {
		if (row.type === 'Canceled') return canceledCSSText;
		if (row.type === 'Other') return 'color: #7a7a7aff;';
		if (row.type === 'Bazart') return 'color: #BDBDBB;';
		if (row.type === 'Hold') return 'color: #9ca3af; font-style: italic;';
		return hasBackground ? 'color: rgba(0,0,0,0.95);' : 'color: white;';
	})();

	const cellBaseClass =
		'w-full h-full bg-transparent px-1 border-0 outline-none text-[14px] placeholder-gray-500 font-normal leading-tight disabled:cursor-default disabled:text-opacity-80 transition-shadow duration-200';
	const stdBorder = 'border-r border-gray2/10 flex items-center relative';
	const rangeBorder = 'border-r-2 border-r-gray2/30 flex items-center relative';

	function isEditable(field: string): boolean {
		if (isDeleteMode) return false;
		if (userPermissions.role === 'viewer') return false;
		if (userPermissions.canEditAll) return true;
		return userPermissions.allowedColumns.includes(field);
	}

	// --- INPUT HANDLING ---

	function handleFocus(field: keyof TechRow) {
		if (!isEditable(field)) return;
		activeField = field;
		editBuffer = (row[field] || '') as string;
		dispatch('focus', { id: row.id, field });
	}

	function formatTimeRange(val: string): string {
		if (!val || !val.includes('-')) return val; // Return original if not a range

		const parts = val.split('-').map((p) => p.trim());
		if (parts.length !== 2) return val;

		const start = parseTime(parts[0]);
		const end = parseTime(parts[1]);

		return `${start}-${end}`;
	}

	function parseTime(t: string): string {
		let clean = t.toLowerCase().replace(/\s+/g, ''); // clean spaces/case
		if (!clean) return '';

		// Case 1: Already has AM/PM (e.g., "1pm", "3am")
		if (clean.includes('am') || clean.includes('pm')) {
			return clean.toUpperCase();
		}

		// Case 2: 24h format with 'h' (e.g., "18h", "21h")
		if (clean.endsWith('h')) {
			clean = clean.slice(0, -1); // remove 'h'
		}

		// Case 3: Bare Number (e.g. "11", "16") -> Treat as 24h
		// (This also handles the stripped '18h' from Case 2)
		const match = clean.match(/^(\d+)(?::(\d+))?$/);
		if (match) {
			let h = parseInt(match[1]);
			const m = match[2]; // capture minutes if they exist (optional)

			if (!isNaN(h)) {
				const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
				h = h % 12;
				if (h === 0) h = 12;
				return `${h}${m ? ':' + m : ''}${ampm}`;
			}
		}

		return t; // Return original if we can't figure it out
	}

	function handleBlur(field: keyof TechRow) {
		if (activeField === field) {
			if (field === 'op_hours' || field === 'crew_call') {
				editBuffer = formatTimeRange(editBuffer);
			}

			if (editBuffer !== row[field]) {
				dispatch('update', { id: row.id, field, value: editBuffer });
			}
			activeField = null;
			dispatch('blur');
		}
	}

	function handleKeydown(e: KeyboardEvent, field: keyof TechRow) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLElement).blur();
		}
	}

	function handleDateBlur(e: Event) {
		activeField = null;
		dispatch('blur');
		if (!isEditable('date')) return;
		let inputVal = (e.target as HTMLInputElement).value.trim();
		inputVal = inputVal.replace(/\b([a-z])\w+/g, (s) => s.charAt(0).toUpperCase() + s.slice(1));
		let parsedDate = dayjs(`${inputVal} ${currentYear}`, [
			'D MMM YYYY',
			'MMM D YYYY',
			'D-M YYYY',
			'D/M YYYY'
		]);
		if (parsedDate.isValid()) {
			const newDateStr = parsedDate.format('YYYY-MM-DD');
			if (newDateStr !== row.date) {
				dispatch('update', { id: row.id, field: 'date', value: newDateStr });
			} else {
				dateInput = parsedDate.format('D MMM');
			}
		} else {
			dateInput = dayjs(row.date).format('D MMM');
		}
	}

	function getPresenceStyle(field: string) {
		const key = `${row.id}_${field}`;
		const presence = remotePresences[key];
		if (presence) return `box-shadow: inset 0 0 0 2px ${presence.color};`;
		if (activeField === field) return `box-shadow: inset 0 0 0 1px #84cc16;`;
		return '';
	}

	function getPresenceTooltip(field: string) {
		const key = `${row.id}_${field}`;
		return remotePresences[key] ? `${remotePresences[key].user} is editing...` : '';
	}

	function getStaffFieldStyle(val: any, type: string): string {
		if (type === 'Canceled') return canceledCSSText;
		if (!val) return 'color: #d1d5db;';
		const v = String(val).toLowerCase().trim();
		if (/^n[\/\\]?a$/.test(v))
			return 'color: #9ca3af; font-style: italic; background-color: transparent;';
		if (String(val).includes('?')) return 'background-color: #f4c7c3; color: black;';
		if (v.includes('book')) return 'background-color: #fce8b2; color: black;';
		return 'background-color: #b7e1cd; color: black;';
	}

	function handleContextMenu(e: MouseEvent, field: string | null) {
		if (userPermissions.role === 'viewer') return;
		e.preventDefault();
		dispatch('contextmenu', { e, row, field });
	}

	function toggleTypeDropdown(e: MouseEvent) {
		if (!isEditable('type')) return;
		e.stopPropagation();
		dispatch('toggleDropdown', { id: row.id });
	}

	async function calculatePosition() {
		await tick();
		if (!typeButtonRef) return;
		const rect = typeButtonRef.getBoundingClientRect();
		let top = rect.bottom + 4;
		if (top + 300 > window.innerHeight) top = rect.top - 200;
		dropdownPosition = { top: top, left: rect.left, width: 160 };
	}

	function selectType(type: string) {
		dispatch('update', { id: row.id, field: 'type', value: type });
		dispatch('toggleDropdown', { id: row.id });
	}

	function getTypeStyle(type: string) {
		if (!type)
			return 'background-color: rgba(255,255,255,0.05); color: #666; border: 1px dashed #444;';
		if (type === 'Canceled')
			return 'background-color: rgba(255, 0, 0, 0.1); color: #ff4444; border: 1px solid #ff4444; text-decoration: line-through;';
		if (type === 'Other' || type === 'Bazart')
			return `background-color: ${type === 'Bazart' ? '#BDBDBB' : 'transparent'}; color: ${type === 'Bazart' ? 'black' : '#BDBDBB'}; border: ${type === 'Bazart' ? '1px solid #BDBDBB' : 'none'};`;
		if (type === 'Hold')
			return 'background-color: transparent; color: #9ca3af; border: 1px dashed #666;';
		return `background-color: ${EVENT_COLORS[type] || '#333'}; color: #000000; font-weight: 700; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
	}

	function handleDeleteClick(e: MouseEvent) {
		if (!isDeleteMode) return;
		e.stopPropagation();
		e.preventDefault();
		dispatch('deleteRow', { id: row.id });
	}

	function autoResize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		};
		node.addEventListener('input', resize);
		resize();
		return {
			destroy() {
				node.removeEventListener('input', resize);
			}
		};
	}
</script>

<div
	role="row"
	tabindex="0"
	style="{gridStyle}; font-family: Arial, Helvetica, sans-serif;"
	class="border-b border-gray2/10 hover:bg-white/5 transition-colors min-h-[24px] items-stretch relative {isSelected
		? 'bg-lime/10'
		: ''}"
	on:keydown
>
	<button
		type="button"
		class="absolute inset-0 z-50 hover:bg-red-500/20 transition-colors flex items-center justify-center group cursor-pointer border-none bg-transparent"
		style="display: {isDeleteMode ? 'flex' : 'none'};"
		on:click={handleDeleteClick}
		on:keydown={(e) => e.key === 'Enter' && handleDeleteClick(e as any)}
		title="Click to delete this row"
		aria-label="Delete Row"
	></button>

	<button
		type="button"
		class="w-full h-full text-center text-gray2 select-none {stdBorder} justify-center cursor-context-menu hover:text-white focus:text-white focus:outline-none bg-transparent text-[14px]"
		on:click={(e) => dispatch('contextmenu', { e, row, field: '__ROW__' })}
		on:contextmenu={(e) => handleContextMenu(e, '__ROW__')}
		disabled={userPermissions.role === 'viewer'}
	>
		{index + 1}
	</button>

	<div
		class="px-2 select-none {stdBorder} justify-center text-[14px] {isWeekend
			? 'bg-black/20 text-gray3 !font-medium'
			: 'text-gray3 !font-medium'}"
		on:contextmenu={(e) => handleContextMenu(e, 'date')}
		role="gridcell"
		tabindex="0"
	>
		{dayjs(row.date).format('dddd')}
	</div>

	<div
		class="{rangeBorder} h-full {isWeekend ? 'bg-black/20' : ''}"
		style={getPresenceStyle('date')}
		title={getPresenceTooltip('date')}
	>
		<input
			type="text"
			value={dateInput}
			readonly={!isEditable('date')}
			on:focus={() => handleFocus('date')}
			on:blur={handleDateBlur}
			on:contextmenu={(e) => handleContextMenu(e, 'date')}
			class="{cellBaseClass} text-center cursor-text text-gray3 !font-medium"
		/>
	</div>

	<div
		class="{stdBorder} h-full justify-center px-1 relative"
		on:contextmenu={(e) => handleContextMenu(e, 'type')}
		role="gridcell"
		tabindex="-1"
	>
		<button
			bind:this={typeButtonRef}
			type="button"
			disabled={!isEditable('type')}
			on:click={toggleTypeDropdown}
			on:contextmenu={(e) => handleContextMenu(e, 'type')}
			class="text-[12px] h-[20px] px-3 rounded-full uppercase tracking-wide truncate transition-transform hover:scale-105 active:scale-95 flex items-center justify-center min-w-[110px] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed {isEditable(
				'type'
			)
				? 'hover:cursor-pointer'
				: ''}"
			style={getTypeStyle(row.type)}
		>
			{row.type || 'Select'}
		</button>
	</div>

	<div
		class="{rangeBorder} h-full p-[2px]"
		style={getPresenceStyle('event_name')}
		title={getPresenceTooltip('event_name')}
	>
		<textarea
			use:autoResize
			rows="1"
			readonly={!isEditable('event_name')}
			value={activeField === 'event_name' ? editBuffer : row.event_name}
			on:focus={() => handleFocus('event_name')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('event_name')}
			on:contextmenu={(e) => handleContextMenu(e, 'event_name')}
			class="w-full h-full bg-transparent border-0 outline-none text-[13px] font-normal leading-tight resize-none overflow-hidden block rounded-full px-3 py-0.5 disabled:cursor-default"
			style="{bgStyle} {textColorStyle}"
			placeholder=""
		></textarea>
	</div>

	<div
		class={stdBorder}
		style={getPresenceStyle('op_hours')}
		title={getPresenceTooltip('op_hours')}
	>
		<input
			class="{cellBaseClass} text-center"
			value={activeField === 'op_hours' ? editBuffer : row.op_hours || ''}
			readonly={!isEditable('op_hours')}
			style={row.type === 'Canceled' ? canceledCSSText : 'color: #d1d5db;'}
			on:focus={() => handleFocus('op_hours')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('op_hours')}
			on:keydown={(e) => handleKeydown(e, 'op_hours')}
			on:contextmenu={(e) => handleContextMenu(e, 'op_hours')}
		/>
	</div>

	<div
		class={rangeBorder}
		style={getPresenceStyle('crew_call')}
		title={getPresenceTooltip('crew_call')}
	>
		<input
			class="{cellBaseClass} text-center"
			value={activeField === 'crew_call' ? editBuffer : row.crew_call || ''}
			readonly={!isEditable('crew_call')}
			style={row.type === 'Canceled' ? canceledCSSText : 'color: #d1d5db;'}
			on:focus={() => handleFocus('crew_call')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('crew_call')}
			on:keydown={(e) => handleKeydown(e, 'crew_call')}
			on:contextmenu={(e) => handleContextMenu(e, 'crew_call')}
		/>
	</div>

	{#each staffCols as f}
		<div class={stdBorder} style={getPresenceStyle(f)} title={getPresenceTooltip(f)}>
			<input
				class="{cellBaseClass} text-center"
				value={activeField === f ? editBuffer : row[f] || ''}
				readonly={!isEditable(f)}
				style={getStaffFieldStyle(activeField === f ? editBuffer : row[f], row.type)}
				on:focus={() => handleFocus(f)}
				on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
				on:blur={() => handleBlur(f)}
				on:keydown={(e) => handleKeydown(e, f)}
				on:contextmenu={(e) => handleContextMenu(e, f)}
			/>
		</div>
	{/each}

	<div class={rangeBorder} style={getPresenceStyle('dt')} title={getPresenceTooltip('dt')}>
		<input
			class="{cellBaseClass} text-center"
			value={activeField === 'dt' ? editBuffer : row.dt || ''}
			readonly={!isEditable('dt')}
			style={getStaffFieldStyle(activeField === 'dt' ? editBuffer : row.dt, row.type)}
			on:focus={() => handleFocus('dt')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('dt')}
			on:keydown={(e) => handleKeydown(e, 'dt')}
			on:contextmenu={(e) => handleContextMenu(e, 'dt')}
		/>
	</div>

	<div
		class={rangeBorder}
		style={getPresenceStyle('artist_liaison')}
		title={getPresenceTooltip('artist_liaison')}
	>
		<input
			class="{cellBaseClass} text-center"
			value={activeField === 'artist_liaison' ? editBuffer : row.artist_liaison || ''}
			readonly={!isEditable('artist_liaison')}
			style={getStaffFieldStyle(
				activeField === 'artist_liaison' ? editBuffer : row.artist_liaison,
				row.type
			)}
			on:focus={() => handleFocus('artist_liaison')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('artist_liaison')}
			on:keydown={(e) => handleKeydown(e, 'artist_liaison')}
			on:contextmenu={(e) => handleContextMenu(e, 'artist_liaison')}
		/>
	</div>

	<div class={stdBorder} style={getPresenceStyle('notes')} title={getPresenceTooltip('notes')}>
		<input
			class="{cellBaseClass} text-gray-300"
			value={activeField === 'notes' ? editBuffer : row.notes || ''}
			readonly={!isEditable('notes')}
			on:focus={() => handleFocus('notes')}
			on:input={(e) => (editBuffer = (e.target as HTMLInputElement).value)}
			on:blur={() => handleBlur('notes')}
			on:keydown={(e) => handleKeydown(e, 'notes')}
			on:contextmenu={(e) => handleContextMenu(e, 'notes')}
		/>
	</div>
</div>

{#if showTypeDropdown}
	<div
		class="fixed z-[9999] bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl py-1 max-h-[300px] overflow-y-auto flex flex-col min-w-[160px]"
		style="top: {dropdownPosition.top}px; left: {dropdownPosition.left}px;"
		role="menu"
		tabindex="-1"
		on:click|stopPropagation
		on:keydown
	>
		<div class="px-2 py-1 text-[10px] text-gray3 font-bold uppercase tracking-wider mb-1">
			Select Event Type
		</div>
		{#each EVENT_TYPES as type}
			<button
				class="px-3 py-1.5 text-[13px] text-left hover:bg-white/10 hover:cursor-pointer flex items-center gap-2 transition-colors w-full group"
				on:click={() => selectType(type)}
			>
				<div
					class="w-3 h-3 rounded-full border border-white/10 shadow-sm"
					style="background-color: {EVENT_COLORS[type] === 'transparent'
						? '#333'
						: EVENT_COLORS[type]}; {type === 'Hold' ? 'border:1px dashed #888' : ''}"
				></div>
				<span
					class="text-gray-300 font-medium group-hover:text-white transition-colors {type ===
					'Canceled'
						? 'text-red-400 line-through'
						: ''}">{type}</span
				>
			</button>
		{/each}
		<div class="h-px bg-gray-700 my-1 mx-2"></div>
		<button
			class="px-3 py-1.5 text-[12px] text-left text-problem hover:cursor-pointer hover:text-red-300 hover:bg-red-500/10 transition-colors w-full"
			on:click={() => selectType('')}>Clear Selection</button
		>
	</div>
{/if}
