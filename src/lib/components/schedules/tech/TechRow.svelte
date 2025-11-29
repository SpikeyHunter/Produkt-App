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

	export let userPermissions: {
		role: string;
		canAddYear: boolean;
		canEditAll: boolean;
		allowedColumns: string[];
	} = { role: 'viewer', canAddYear: false, canEditAll: false, allowedColumns: [] };

	let typeButtonRef: HTMLButtonElement;
	let dropdownPosition = { top: 0, left: 0, width: 0 };
	const dispatch = createEventDispatcher();

    // --- Local Input State Management ---
    // We maintain local values to prevent cursor jumps and "fighting" with props
    let dateInput = '';
    let activeField: string | null = null;
    
    // Sync local state when row ID changes (new row loaded)
    // OR when the prop updates and we are NOT focused on it (external update)
    $: if (row) {
        syncInputsIfNeeded();
    }

    function syncInputsIfNeeded() {
        if (activeField !== 'date') dateInput = dayjs(row.date).format('D MMM');
    }

	$: showTypeDropdown = activeDropdownId === row.id;
	$: if (showTypeDropdown && typeButtonRef) {
		calculatePosition();
	}

	const isWeekend = [0, 6].includes(dayjs(row.date).day());
	const canceledCSSText = 'color: #ff0000; text-decoration: line-through; font-weight: bold; font-style: italic; background-color: transparent;';
	
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
		'w-full h-full bg-transparent px-1 border-0 focus:ring-1 focus:ring-lime outline-none text-[14px] placeholder-gray-500 font-normal leading-tight disabled:cursor-default disabled:text-opacity-80';
	const stdBorder = 'border-r border-gray2/10 flex items-center';
	const rangeBorder = 'border-r-2 border-r-gray2/30 flex items-center';

	// -- Permission Check Helpers --
	function isEditable(field: string): boolean {
        if (isDeleteMode) return false; // Disable inputs in delete mode
        if (userPermissions.role === 'viewer') return false;
		if (userPermissions.canEditAll) return true;
		return userPermissions.allowedColumns.includes(field);
	}

	// --- Focus / Blur Handling ---
	function handleFocus(field: keyof TechRow) {
		if (!isEditable(field)) return;
        activeField = field;
		dispatch('focus', { id: row.id, field });
	}

    // Generic change handler
	function handleChange(field: keyof TechRow, value: any) {
		if (!isEditable(field)) return;
		if (row[field] !== value) {
			dispatch('update', { id: row.id, field, value });
		}
	}

    // Generic Blur handler for simple text inputs
    function handleGenericBlur(e: Event, field: keyof TechRow) {
        activeField = null;
        const input = e.target as HTMLInputElement | HTMLTextAreaElement;
        const value = input.value; // Send raw value, parent/logic handles cleanup if needed
        dispatch('blur'); 
        
        // Special formatting for Staff fields
        if (['ld','video','vj','sound','tech_sm','dt','artist_liaison'].includes(field)) {
             let formatted = value.trim();
             if (/^n[\/\\]?a$/i.test(formatted)) formatted = 'N/A';
             else formatted = formatted.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
             
             if (formatted !== row[field]) {
                 handleChange(field, formatted);
                 input.value = formatted; // Update visual immediately
             }
        } else {
             if (value !== row[field]) {
                 handleChange(field, value);
             }
        }
    }

	function handleDateBlur(e: Event) {
        activeField = null;
		dispatch('blur'); 
		if (!isEditable('date')) return;
		const inputVal = (e.target as HTMLInputElement).value.trim();
		
        let parsedDate = dayjs(`${inputVal} ${currentYear}`, [
			'D MMM YYYY', 'MMM D YYYY', 'D-M YYYY', 'D/M YYYY'
		]);

		if (parsedDate.isValid()) {
			const newDateStr = parsedDate.format('YYYY-MM-DD');
			if (newDateStr !== row.date) {
				handleChange('date', newDateStr);
			} else {
                // Revert to formatted version if date didn't technically change but format did
				dateInput = dayjs(row.date).format('D MMM');
			}
		} else {
			dateInput = dayjs(row.date).format('D MMM');
		}
	}

	function formatTimeRange(input: string): string {
		if (!input) return input;
		let clean = input.trim().toLowerCase()
			.replace(/\s+to\s+/g, '-').replace(/\s*>\s*/g, '-').replace(/\s*-\s*/g, '-');
		if (!clean.includes('-')) return input;
		const parts = clean.split('-');
		if (parts.length !== 2) return input;

		const parseTimePart = (str: string) => {
			const match = str.match(/^(\d{1,2})(?:[:h]?(\d{2}))?([a-z]+)?$/);
			if (!match) return null;
			let h = parseInt(match[1]);
			const m = match[2] ? parseInt(match[2]) : 0;
			const suffix = match[3];
			if (h > 23 || m > 59) return null;
			let h24 = h;
			let isExplicit = false;
			if (suffix) {
				isExplicit = true;
				if (suffix.includes('p') && h < 12) h24 += 12;
				else if (suffix.includes('a') && h === 12) h24 = 0;
			} else if (h > 12) { isExplicit = true; }
			return { h24, m, rawH: h, isExplicit };
		};

		const start = parseTimePart(parts[0]);
		const end = parseTimePart(parts[1]);
		if (!start || !end) return input;

		const resolveTime = (t: any) => {
			if (t.isExplicit) return t.h24;
			let guess = t.rawH < 12 ? t.rawH + 12 : t.rawH;
			if (t.rawH === 12) guess = 12;
			return guess;
		};

		let sH = resolveTime(start);
		let eH = resolveTime(end);
		if (!end.isExplicit && end.rawH <= 12 && sH > eH) {
			eH = end.rawH === 12 ? 0 : end.rawH;
		}

		const format = (h: number, m: number) => {
			const ampm = h >= 12 && h < 24 ? 'PM' : 'AM';
			let hh = h % 12;
			if (hh === 0) hh = 12;
			const mm = m === 0 ? '' : ':' + m.toString().padStart(2, '0');
			return `${hh}${mm}${ampm}`;
		};
		return `${format(sH, start.m)}-${format(eH, end.m)}`;
	}

	function handleTimeBlur(e: Event, field: keyof TechRow) {
        activeField = null;
		dispatch('blur'); 
		if (!isEditable(field)) return;
		const input = e.target as HTMLInputElement;
		const formatted = formatTimeRange(input.value);
		if (formatted !== row[field]) {
			handleChange(field, formatted);
			input.value = formatted;
		}
	}

	function getStaffFieldStyle(val: string, type: string): string {
		if (type === 'Canceled') return canceledCSSText;
		if (!val) return 'color: #d1d5db;';
		const v = val.toLowerCase().trim();
		if (/^n[\/\\]?a$/.test(v)) return 'color: #9ca3af; font-style: italic; background-color: transparent;';
		if (val.includes('?')) return 'background-color: #f4c7c3; color: black;';
		if (v.includes('book')) return 'background-color: #fce8b2; color: black;';
		return 'background-color: #b7e1cd; color: black;';
	}

	function handleContextMenu(e: MouseEvent, field: string | null) {
		if (userPermissions.role === 'viewer') return;
		e.preventDefault();
		dispatch('contextmenu', { e, row, field });
	}

	function autoResize(node: HTMLTextAreaElement) {
		const resize = () => {
			node.style.height = 'auto';
			node.style.height = node.scrollHeight + 'px';
		};
		node.addEventListener('input', resize);
        // Initial resize
        requestAnimationFrame(resize);
		return {
			destroy() { node.removeEventListener('input', resize); },
			update() { resize(); }
		};
	}

    // --- Event Name Special Handling ---
    function handleEventNameChange(e: Event) {
        const input = e.target as HTMLTextAreaElement;
        let val = input.value;
        // Clean up
        val = val ? val.trim() : '';
        val = val.replace(/\n\s*\n/g, '\n');
        if (val.length > 0) val = val.charAt(0).toUpperCase() + val.slice(1);
        
        if (val !== row.event_name) {
             handleChange('event_name', val);
             input.value = val;
             // Force resize
             input.style.height = 'auto';
             input.style.height = input.scrollHeight + 'px';
        }
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
		handleChange('type', type);
		dispatch('toggleDropdown', { id: row.id });
	}

	function getTypeStyle(type: string) {
		if (!type) return 'background-color: rgba(255,255,255,0.05); color: #666; border: 1px dashed #444;';
		if (type === 'Canceled') return 'background-color: rgba(255, 0, 0, 0.1); color: #ff4444; border: 1px solid #ff4444; text-decoration: line-through;';
		if (type === 'Other') return 'background-color: transparent; color: #BDBDBB; ';
        if (type === 'Bazart') return 'background-color: #BDBDBB; color: black; border: 1px solid #BDBDBB;';
		if (type === 'Hold') return 'background-color: transparent; color: #9ca3af; border: 1px dashed #666;';
		const bgColor = EVENT_COLORS[type] || '#333';
		return `background-color: ${bgColor}; color: #000000; font-weight: 700; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 1px 2px rgba(0,0,0,0.2);`;
	}

    function handleDeleteClick(e: MouseEvent) {
        if(!isDeleteMode) return;
        e.stopPropagation();
        e.preventDefault();
        dispatch('deleteRow', { id: row.id });
    }
</script>

<div
	role="row"
	tabindex="0"
	style="{gridStyle}; font-family: Arial, Helvetica, sans-serif;"
	class="border-b border-gray2/10 hover:bg-white/5 transition-colors min-h-[24px] items-stretch relative {isSelected
		? 'bg-lime/10' : ''}"
	on:keydown
>
    <div 
        class="absolute inset-0 z-50 hover:bg-red-500/20 transition-colors items-center justify-center group cursor-not-allowed"
        style="display: {isDeleteMode ? 'flex' : 'none'};"
        on:click={handleDeleteClick}
        role="button"
        tabindex="0"
        on:keydown={(e) => e.key === 'Enter' && handleDeleteClick(e as any)}
        title="Click to delete this row"
    >
    </div>

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

	<div class="{rangeBorder} h-full {isWeekend ? 'bg-black/20' : ''}">
		<input
			type="text"
			value={dateInput}
			readonly={!isEditable('date')}
			on:focus={() => handleFocus('date')}
			on:blur={handleDateBlur}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
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
			class="text-[12px] h-[20px] px-3 rounded-full uppercase tracking-wide truncate transition-transform hover:scale-105 active:scale-95 flex items-center justify-center min-w-[110px] disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-not-allowed {isEditable('type') ? 'hover:cursor-pointer' : ''}"
			style={getTypeStyle(row.type)}
		>
			{row.type || 'Select'}
		</button>
	</div>

	<div class="{rangeBorder} h-full p-[2px]">
		<textarea
			use:autoResize
			rows="1"
			readonly={!isEditable('event_name')}
			value={row.event_name}
			on:focus={() => handleFocus('event_name')}
			on:blur={(e) => { dispatch('blur'); handleEventNameChange(e); }}
			on:contextmenu={(e) => handleContextMenu(e, 'event_name')}
			class="w-full h-full bg-transparent border-0 outline-none text-[13px] font-normal leading-tight resize-none overflow-hidden block rounded-full px-3 py-0.5 disabled:cursor-default"
			style="{bgStyle} {textColorStyle}"
			placeholder=""
		></textarea>
	</div>

	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.op_hours}
			readonly={!isEditable('op_hours')}
			style={row.type === 'Canceled' ? canceledCSSText : 'color: #d1d5db;'}
			on:focus={() => handleFocus('op_hours')}
			on:blur={(e) => handleTimeBlur(e, 'op_hours')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'op_hours')}
		/>
	</div>
	<div class={rangeBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.crew_call}
			readonly={!isEditable('crew_call')}
			style={row.type === 'Canceled' ? canceledCSSText : 'color: #d1d5db;'}
			on:focus={() => handleFocus('crew_call')}
			on:blur={(e) => handleTimeBlur(e, 'crew_call')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'crew_call')}
		/>
	</div>

	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.ld}
			readonly={!isEditable('ld')}
			style={getStaffFieldStyle(row.ld, row.type)}
			on:focus={() => handleFocus('ld')}
			on:blur={(e) => handleGenericBlur(e, 'ld')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'ld')}
		/>
	</div>
	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.video}
			readonly={!isEditable('video')}
			style={getStaffFieldStyle(row.video, row.type)}
			on:focus={() => handleFocus('video')}
			on:blur={(e) => handleGenericBlur(e, 'video')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'video')}
		/>
	</div>
	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.vj}
			readonly={!isEditable('vj')}
			style={getStaffFieldStyle(row.vj, row.type)}
			on:focus={() => handleFocus('vj')}
			on:blur={(e) => handleGenericBlur(e, 'vj')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'vj')}
		/>
	</div>
	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.sound}
			readonly={!isEditable('sound')}
			style={getStaffFieldStyle(row.sound, row.type)}
			on:focus={() => handleFocus('sound')}
			on:blur={(e) => handleGenericBlur(e, 'sound')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'sound')}
		/>
	</div>
	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.tech_sm}
			readonly={!isEditable('tech_sm')}
			style={getStaffFieldStyle(row.tech_sm, row.type)}
			on:focus={() => handleFocus('tech_sm')}
			on:blur={(e) => handleGenericBlur(e, 'tech_sm')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'tech_sm')}
		/>
	</div>
	<div class={rangeBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.dt}
			readonly={!isEditable('dt')}
			style={getStaffFieldStyle(row.dt, row.type)}
			on:focus={() => handleFocus('dt')}
			on:blur={(e) => handleGenericBlur(e, 'dt')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'dt')}
		/>
	</div>
	<div class={rangeBorder}>
		<input
			class="{cellBaseClass} text-center"
			value={row.artist_liaison}
			readonly={!isEditable('artist_liaison')}
			style={getStaffFieldStyle(row.artist_liaison, row.type)}
			on:focus={() => handleFocus('artist_liaison')}
			on:blur={(e) => handleGenericBlur(e, 'artist_liaison')}
			on:keydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
			on:contextmenu={(e) => handleContextMenu(e, 'artist_liaison')}
		/>
	</div>

	<div class={stdBorder}>
		<input
			class="{cellBaseClass} text-gray-300"
			value={row.notes}
			readonly={!isEditable('notes')}
			on:focus={() => handleFocus('notes')}
			on:blur={(e) => handleGenericBlur(e, 'notes')}
			on:contextmenu={(e) => handleContextMenu(e, 'notes')}
		/>
	</div>
</div>

{#if showTypeDropdown}
	<div
		class="fixed z-[9999] bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl py-1 max-h-[300px] overflow-y-auto flex flex-col min-w-[160px]"
		style="top: {dropdownPosition.top}px;
		left: {dropdownPosition.left}px;"
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
						: ''}"
				>
					{type}
				</span>
			</button>
		{/each}
		<div class="h-px bg-gray-700 my-1 mx-2"></div>
		<button
			class="px-3 py-1.5 text-[12px] text-left text-problem hover:cursor-pointer hover:text-red-300 hover:bg-red-500/10 transition-colors w-full"
			on:click={() => selectType('')}
		>
			Clear Selection
		</button>
	</div>
{/if}