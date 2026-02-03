<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { TechEmailForm } from '$lib/types/emailtech';
	import SectionCard from './SectionCard.svelte';

	export let formData: TechEmailForm;
	export let readOnly = false;
	export let stretch = false;
	const dispatch = createEventDispatcher();

	function handleChange() {
		dispatch('change');
	}
	function handleToggle(e: CustomEvent) {
		dispatch('toggle', e.detail);
	}

	const COLORS = [
		{ label: 'Bazart Colors', value: 'Bazart Colors', hex: '#FCD34D' },
		{ label: 'Green', value: 'Green', hex: '#86EFAC' },
		{ label: 'Gold', value: 'Gold', hex: '#FCD34D' },
		{ label: 'Orange', value: 'Orange', hex: '#FDBA74' },
		{ label: 'Red', value: 'Red', hex: '#FCA5A5' },
		{ label: 'Blue', value: 'Blue', hex: '#c4b5fd' },
		{ label: 'Cyan', value: 'Cyan', hex: '#22d3ee' },
		{ label: 'Purple', value: 'Purple', hex: '#93c5fd' },
		{ label: 'Yellow', value: 'Yellow', hex: '#fef08a' },
		{ label: 'Pink', value: 'Pink', hex: '#f9a8d4' }
	];
    
	const ROWS = [
		{
			label: 'Niveau 1/Terrace',
			timeOptions: ['N/A', '5PM-3AM'],
			mode: 'single',
			allowBazart: true
		},
		{ label: 'Lounge', timeOptions: ['5PM-3AM', '5PM & 10PM'], mode: 'dynamic', allowBazart: true },
		{ label: 'Facade', timeOptions: ['7PM & 9PM', '5PM & 10PM'], mode: 'dual', allowBazart: true },
		{ label: 'Main Room', timeOptions: [], mode: 'fixed_single', allowBazart: false },
		{ label: 'Laser GA', timeOptions: ['10PM', '9PM'], mode: 'single', allowBazart: false }
	];

	let timeSelections: string[] = [];

	onMount(() => {
		initData();
	});

	function initData() {
		if (!formData.lights || formData.lights.length !== ROWS.length) {
			formData.lights = ROWS.map((r) => ({ area: r.label, color: '' }));
			dispatch('change');
		}
		timeSelections = formData.lights.map((l, i) => {
			const match = l.area.match(/\((.*?)\)/);
			if (match) return match[1];
			return ROWS[i].timeOptions[0] || '';
		});
	}

	function handleReset() {
		if (readOnly) return;
		formData.lights = ROWS.map((r) => ({ area: r.label, color: '' }));
		timeSelections = ROWS.map((r) => r.timeOptions[0] || '');
		formData.lights.forEach((l, i) => {
			const baseLabel = ROWS[i].label;
			const time = timeSelections[i];
			l.area = time && time !== 'N/A' ? `${baseLabel} (${time})` : baseLabel;
		});
		dispatch('change');
	}

	let activeDropdown: { row: number; type: 'time' | 'color'; sub: number | null } | null = null;
	function toggleDropdown(row: number, type: 'time' | 'color', sub: number | null = null) {
		if (
			activeDropdown &&
			activeDropdown.row === row &&
			activeDropdown.type === type &&
			activeDropdown.sub === sub
		) {
			activeDropdown = null;
		} else {
			activeDropdown = { row, type, sub };
		}
	}

	function handleTimeSelect(index: number, newTime: string) {
		timeSelections[index] = newTime;
		const baseLabel = ROWS[index].label;
		formData.lights[index].area =
			newTime && newTime !== 'N/A' ? `${baseLabel} (${newTime})` : baseLabel;
		if (ROWS[index].mode === 'dynamic') formData.lights[index].color = '';
		activeDropdown = null;
		handleChange();
	}

	function selectColor(rowIdx: number, subIdx: number | null, colorObj: any) {
		const current = formData.lights[rowIdx].color || '';
		const isDual =
			ROWS[rowIdx].mode === 'dual' ||
			(ROWS[rowIdx].mode === 'dynamic' && timeSelections[rowIdx].includes('&'));

		// Handle "None" selection (empty value) [cite: 412]
		const newValue = colorObj.value === '' ? '' : colorObj.value;

		if (isDual) {
			const parts = current.includes('/') ? current.split(' / ') : ['', ''];
			if (subIdx === 0) parts[0] = newValue;
			if (subIdx === 1) parts[1] = newValue;
			
			// Clean up dual string logic: 
			// If both empty -> empty string
			// If one empty -> "Color / " or " / Color" (or keep formatting consistent)
			formData.lights[rowIdx].color = parts.join(' / ');
		} else {
			formData.lights[rowIdx].color = newValue;
		}
		activeDropdown = null;
		handleChange();
	}

	function getColorHex(name: string) {
		if (!name) return 'transparent';
		return COLORS.find((c) => c.value === name)?.hex || 'transparent';
	}

	function getAvailableColors(rowIdx: number) {
		// Add a "None" option at the start
		const noneOption = { label: 'None', value: '', hex: 'transparent' };
		
		let list = [noneOption, ...COLORS];
		if (!ROWS[rowIdx].allowBazart) {
			list = list.filter((c) => c.value !== 'Bazart Colors');
		}
		return list;
	}
</script>

<svelte:window
	on:click={(e) => {
		const target = e.target as HTMLElement;
		if (target && !target.closest('.dropdown-container')) {
			activeDropdown = null;
		}
	}}
/>

<SectionCard
	title="Lighting Colors"
	id="lights"
	isVisible={formData.visible_sections?.['lights']}
	on:toggle={handleToggle}
	on:reset={handleReset}
	{stretch}
>
	<div class="flex flex-col gap-1.5 h-full">
		{#each ROWS as row, i}
			{@const isDual =
				row.mode === 'dual' ||
				(row.mode === 'dynamic' && timeSelections[i]?.includes('&'))}
			{@const colorParts = formData.lights[i]?.color
				? formData.lights[i].color.split(' / ')
				: ['', '']}

			<div
				class="flex flex-col gap-1 border-b border-gray1/20 pb-1.5 last:border-0 relative"
				style="z-index: {activeDropdown?.row === i ? 50 : 10 - i};"
			>
				<div class="flex items-center justify-between gap-2">
					<span class="text-xs text-gray2 font-bold uppercase whitespace-nowrap">{row.label}</span>
					{#if row.timeOptions.length > 0}
						<div class="relative dropdown-container">
							<button
								type="button"
								disabled={readOnly}
								on:click={() => toggleDropdown(i, 'time')}
								class="bg-navbar border border-gray1 rounded-2xl px-2 py-1 text-xs text-white flex items-center gap-2 hover:bg-gray1/50 transition-colors min-w-[70px] justify-between"
							>
								<span class="truncate">{timeSelections[i] || 'Select'}</span>
								<svg
									class="w-3 h-3 text-gray2"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									></path></svg
								>
							</button>
							{#if activeDropdown?.row === i && activeDropdown?.type === 'time' && !readOnly}
								<div
									transition:fly={{ y: 5, duration: 200 }}
									class="absolute right-0 top-full mt-1 bg-navbar border border-gray1 rounded-lg shadow-xl overflow-hidden w-max z-50"
								>
									{#each row.timeOptions as opt}
										<button
											type="button"
											on:click={() => handleTimeSelect(i, opt)}
											class="w-full text-left px-3 py-1.5 text-xs text-white hover:bg-gray1/50 transition-colors block border-b border-gray1/30 last:border-0 cursor-pointer"
										>
											{opt}
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
				<div class="flex gap-2">
					<div class="relative flex-1 dropdown-container">
						<button
							type="button"
							disabled={readOnly}
							on:click={() => toggleDropdown(i, 'color', 0)}
							class="w-full bg-navbar border border-gray1 rounded-2xl p-2 flex items-center justify-between hover:bg-gray1/50 transition-colors h-[36px]"
						>
							<span class="text-xs text-white truncate pl-1 font-bold"
								>{colorParts[0] || 'Select Color'}</span
							>
							<div
								class="w-4 h-4 rounded-full border border-gray1/30"
								style="background-color: {getColorHex(colorParts[0])}"
							></div>
						</button>
						{#if activeDropdown?.row === i && activeDropdown?.type === 'color' && activeDropdown?.sub === 0}
							<div
								transition:fly={{ y: 5, duration: 200 }}
								class="absolute top-full left-0 w-full mt-1 bg-navbar border border-gray1 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar z-50"
							>
								{#each getAvailableColors(i) as c}
									<button
										on:click={() => selectColor(i, 0, c)}
										class="w-full flex items-center gap-3 p-2 hover:bg-gray1/50 text-left border-b border-gray1/10 last:border-0 cursor-pointer"
									>
                                        {#if c.value}
										    <div class="w-3 h-3 rounded-full shrink-0" style="background-color: {c.hex}"></div>
                                        {:else}
                                            <div class="w-3 h-3 rounded-full shrink-0 border border-gray2 flex items-center justify-center">
                                                <div class="w-2 h-[1px] bg-gray2 rotate-45"></div>
                                            </div>
                                        {/if}
										<span class="text-xs text-white">{c.label}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					{#if isDual}
						<div class="relative flex-1 dropdown-container">
							<button
								type="button"
								disabled={readOnly}
								on:click={() => toggleDropdown(i, 'color', 1)}
								class="w-full bg-navbar border border-gray1 rounded-2xl p-2 flex items-center justify-between hover:bg-gray1/50 transition-colors h-[36px]"
							>
								<span class="text-xs text-white truncate pl-1 font-bold"
									>{colorParts[1] || 'Select Color'}</span
								>
								<div
									class="w-4 h-4 rounded-full border border-gray1/30"
									style="background-color: {getColorHex(colorParts[1])}"
								></div>
							</button>
							{#if activeDropdown?.row === i && activeDropdown?.type === 'color' && activeDropdown?.sub === 1}
								<div
									transition:fly={{ y: 5, duration: 200 }}
									class="absolute top-full left-0 w-full mt-1 bg-navbar border border-gray1 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto custom-scrollbar z-50"
								>
									{#each getAvailableColors(i) as c}
										<button
											on:click={() => selectColor(i, 1, c)}
											class="w-full flex items-center gap-3 p-2 hover:bg-gray1/50 text-left border-b border-gray1/10 last:border-0 cursor-pointer"
										>
                                            {#if c.value}
											    <div class="w-3 h-3 rounded-full shrink-0" style="background-color: {c.hex}"></div>
                                            {:else}
                                                <div class="w-3 h-3 rounded-full shrink-0 border border-gray2 flex items-center justify-center">
                                                    <div class="w-2 h-[1px] bg-gray2 rotate-45"></div>
                                                </div>
                                            {/if}
											<span class="text-xs text-white">{c.label}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/each}
		<div class="flex-grow"></div>
	</div>
</SectionCard>