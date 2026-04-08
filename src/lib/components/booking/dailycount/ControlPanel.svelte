<script lang="ts">
	import type { EventData, DailyCount } from '$lib/types/dailycount';
	import { createEventDispatcher } from 'svelte';
	import { fly } from 'svelte/transition';

	export let events: EventData[] = [];
	export let mode: 'LIVE' | 'CUSTOM' = 'LIVE';
	export let selectedCustomIds: number[] = [];
	
	export let selectedEventForInfo: EventData | null = null;
	export let latestCountForSelected: DailyCount | null = null;

	const dispatch = createEventDispatcher();
	let currentFilter: 'LIVE' | 'PAST' = 'LIVE';
	let searchQuery = '';
	
	let isPickingColor = false;
	let showCustomPicker = false;

	// Magnifier State
	let magX = 0; let magY = 0;
	let clientX = 0; let clientY = 0;
	let imgWidth = 0; let imgHeight = 0;
	let showMag = false;

	// Custom Color Wheel State
	let pickerHue = 0;
	let pickerSat = 100;
	let pickerVal = 100;
	let colorWheel: HTMLButtonElement;
	let isDraggingWheel = false;

	$: wheelRad = (pickerHue - 90) * (Math.PI / 180);
	$: wheelR = (pickerSat / 100) * 50;

	$: filteredEvents = events.filter((e) => {
		if (e.event_status !== currentFilter) return false;
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			return e.event_name.toLowerCase().includes(query) || e.event_id.toString().includes(query);
		}
		return true;
	});

	function toggleEvent(id: number) {
		if (selectedCustomIds.includes(id)) selectedCustomIds = selectedCustomIds.filter((x) => x !== id);
		else selectedCustomIds = [...selectedCustomIds, id];
		dispatch('selectionChanged', selectedCustomIds);
	}

	function formatToEasternTime(utcDateStr: string | undefined): string {
		if (!utcDateStr) return 'N/A';
		const date = new Date(utcDateStr);
		const dayFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', day: 'numeric' });
		const dayNum = parseInt(dayFormatter.format(date));
		const suffix = ['th', 'st', 'nd', 'rd'][(dayNum % 10 > 3 ? 0 : dayNum % 10) * (dayNum % 100 - dayNum % 10 != 10 ? 1 : 0)] || 'th';
		const month = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long' }).format(date);
		const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(date);
		let time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(date);
		return `${month} ${dayNum}${suffix} ${year} at ${time.replace(' AM', 'AM').replace(' PM', 'PM')}`;
	}

	function hsvToHex(h: number, s: number, v: number) {
		s /= 100; v /= 100;
		let c = v * s;
		let x = c * (1 - Math.abs((h / 60) % 2 - 1));
		let m = v - c;
		let r = 0, g = 0, b = 0;
		if (h < 60) {r=c; g=x; b=0;}
		else if (h < 120) {r=x; g=c; b=0;}
		else if (h < 180) {r=0; g=c; b=x;}
		else if (h < 240) {r=0; g=x; b=c;}
		else if (h < 300) {r=x; g=0; b=c;}
		else {r=c; g=0; b=x;}
		const toHex = (n: number) => Math.round((n+m)*255).toString(16).padStart(2,'0').toUpperCase();
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	function updateCustomColor() {
		if (selectedEventForInfo) {
			const hex = hsvToHex(pickerHue, pickerSat, pickerVal);
			dispatch('colorChanged', { id: selectedEventForInfo.event_id, color: hex });
		}
	}

	function handleWheelInteract(e: MouseEvent) {
		if (!colorWheel) return;
		const rect = colorWheel.getBoundingClientRect();
		const cx = rect.width / 2;
		const cy = rect.height / 2;
		
		const dx = e.clientX - rect.left - cx;
		const dy = e.clientY - rect.top - cy;
		
		let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
		if (angle < 0) angle += 360;
		
		const dist = Math.min(Math.sqrt(dx*dx + dy*dy), cx);
		
		pickerHue = angle;
		pickerSat = (dist / cx) * 100;
		updateCustomColor();
	}

	function setupDragListeners() {
		const onMove = (e: MouseEvent) => { if(isDraggingWheel) handleWheelInteract(e); };
		const onUp = () => { isDraggingWheel = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function handleImageMouseMove(e: MouseEvent) {
		if (!isPickingColor) return;
		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		
		clientX = e.clientX;
		clientY = e.clientY;
		
		magX = e.clientX - rect.left;
		magY = e.clientY - rect.top;
		imgWidth = rect.width;
		imgHeight = rect.height;
		showMag = true;
	}

	function handleImageClick(e: MouseEvent) {
		if (!isPickingColor || !selectedEventForInfo?.event_flyer) return;
		const targetButton = e.currentTarget as HTMLButtonElement;
		const img = targetButton.querySelector('img');
		if (!img) return;
		
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d', { willReadFrequently: true });
		if (!ctx) return;

		try {
			const rect = img.getBoundingClientRect();
			canvas.width = rect.width; canvas.height = rect.height;
			ctx.drawImage(img, 0, 0, rect.width, rect.height);
			
			const x = e.clientX - rect.left; 
			const y = e.clientY - rect.top;
			const data = ctx.getImageData(x, y, 1, 1).data;
			
			if (data[3] > 0) {
				const hex = "#" + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1).toUpperCase();
				dispatch('colorChanged', { id: selectedEventForInfo.event_id, color: hex });
			}
			isPickingColor = false;
			showMag = false;
		} catch (err) {
			alert("CORS security settings prevent picking from this image directly. Please use the color wheel.");
			isPickingColor = false;
			showMag = false;
		}
	}
</script>

<aside class="w-[340px] bg-navbar rounded-3xl p-5 flex flex-col h-[760px] shadow-lg border border-gray1 shrink-0 relative overflow-hidden">
	
	{#if selectedEventForInfo}
		<div class="absolute inset-0 p-5 flex flex-col bg-navbar z-20 h-full overflow-y-auto" in:fly={{ x: 340, duration: 300 }} out:fly={{ x: 340, duration: 300 }}>
			
			<button 
				class="rounded-3xl bg-[var(--color-gray3)] text-black hover:bg-lime px-3 py-1.5 flex items-center gap-1.5 cursor-pointer text-xs font-bold transition-colors w-max mb-6" 
				on:click={() => { dispatch('closeInfoPanel'); isPickingColor = false; showCustomPicker = false; showMag = false; }}
			>
				&larr; Go Back
			</button>

			<div class="mb-5 mt-4">
				<h2 class="text-xl font-bold text-lime leading-tight mb-1">{selectedEventForInfo.event_name}</h2>
				<p class="text-xs text-gray2">{selectedEventForInfo.event_date} | {selectedEventForInfo.event_venue} | ID: {selectedEventForInfo.event_id}</p>
			</div>

			<div class="flex gap-4 mb-6 relative">
				<div class="w-32 h-auto shrink-0 relative">
					{#if selectedEventForInfo.event_flyer}
						<button 
							type="button"
							class="relative w-full h-full border-2 shadow-lg rounded-lg overflow-hidden p-0 bg-transparent transition-all outline-none focus:ring-2 focus:ring-lime {isPickingColor ? 'ring-2 ring-lime ring-offset-2 ring-offset-navbar cursor-crosshair' : 'cursor-default'}" 
							style="border-color: {selectedEventForInfo.color}"
							on:click={handleImageClick}
							on:mousemove={handleImageMouseMove} 
							on:mouseleave={() => showMag = false}
							aria-label="Pick color from event flyer"
						>
							<img 
								src={selectedEventForInfo.event_flyer} 
								alt="Flyer" 
								class="w-full h-full object-cover block pointer-events-none" 
								crossorigin="anonymous"
								draggable="false"
							/>
							
							{#if isPickingColor && showMag}
								<div class="fixed pointer-events-none rounded-full border-[3px] border-white shadow-2xl z-50 overflow-hidden bg-navbar" style="width: 80px; height: 80px; left: {clientX}px; top: {clientY - 60}px; transform: translate(-50%, -50%);">
									<div class="w-full h-full" style="background-image: url({selectedEventForInfo.event_flyer}); background-size: {imgWidth * 4}px {imgHeight * 4}px; background-position: -{magX * 4 - 40}px -{magY * 4 - 40}px;"></div>
									<div class="absolute inset-0 flex items-center justify-center text-lime font-bold text-2xl drop-shadow-md">+</div>
								</div>
							{/if}
						</button>
					{:else}
						<div class="w-full h-32 bg-gray1 border-2 rounded-lg flex items-center justify-center text-xs text-gray2" style="border-color: {selectedEventForInfo.color}">No Flyer</div>
					{/if}
				</div>

				<div class="flex flex-col flex-1 gap-3">
					<span class="text-sm font-bold text-white">Theme Color:</span>
					
					<div class="relative flex items-center gap-2">
						<button 
							aria-label="Toggle custom color picker" 
							title="Open color picker"
							class="w-8 h-8 shrink-0 rounded-md shadow-inner border-2 border-white/20 cursor-pointer transition-transform hover:scale-105" 
							style="background-color: {selectedEventForInfo.color || '#000000'}" 
							on:click={() => showCustomPicker = !showCustomPicker}
						></button>
						
						<input type="text" value={selectedEventForInfo.color} on:change={(e) => dispatch('colorChanged', { id: selectedEventForInfo?.event_id, color: e.currentTarget.value })} class="w-full bg-gray1 border border-gray2/30 text-white rounded-md px-2 py-1.5 text-xs outline-none focus:border-lime uppercase font-mono" placeholder="#HEX" />
					</div>
					
					<button class="w-full h-10 shrink-0 border text-xs font-bold rounded-lg transition-colors flex items-center justify-center {isPickingColor ? 'bg-lime text-black border-lime hover:bg-lime/90' : 'bg-gray1 hover:bg-gray2/20 border-gray2/30 text-white'}" on:click={() => { isPickingColor = !isPickingColor; showCustomPicker = false; }}>
						{isPickingColor ? 'Select on Image' : 'Pick from Flyer'}
					</button>
				</div>
			</div>

			<div class="bg-gray1/40 rounded-xl p-4 border border-gray2/20 mb-4">
				<h3 class="text-sm font-bold text-white mb-3">Ticket Count Summary</h3>
				<div class="space-y-2 text-sm">
					<div class="flex justify-between border-b border-gray2/10 pb-1"><span class="text-gray2">Total:</span><span class="font-bold text-white">{latestCountForSelected?.total || 0}</span></div>
					<div class="flex justify-between pl-2"><span class="text-gray2">GA:</span><span class="font-bold text-white">{latestCountForSelected?.ga || 0}</span></div>
					<div class="flex justify-between pl-2"><span class="text-gray2">VIP:</span><span class="font-bold text-white">{latestCountForSelected?.vip || 0}</span></div>
				</div>
			</div>

			<div class="text-[13px] font-bold text-gray2 text-center w-full">
				Last update at: <span class="text-white ml-1">{formatToEasternTime(latestCountForSelected?.report_generated_at)}</span>
			</div>

			{#if showCustomPicker}
				<button 
					type="button"
					class="absolute inset-0 z-40 bg-black/40 rounded-3xl w-full h-full border-none cursor-default" 
					on:click={() => showCustomPicker = false}
					aria-label="Close color picker"
				></button>
				
				<div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-navbar p-5 rounded-2xl border border-gray2/30 shadow-[0_10px_50px_rgba(0,0,0,0.8)] z-50 flex flex-col items-center gap-4 w-[240px]" transition:fly={{y: 10, duration: 200}}>
					<button
						type="button" 
						class="w-44 h-44 rounded-full cursor-crosshair relative border-2 border-gray2/50 outline-none focus:ring-2 focus:ring-lime p-0 shadow-lg"
						style="background: radial-gradient(circle at 50% 50%, white 0%, transparent 100%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red);"
						on:mousedown={(e) => { isDraggingWheel = true; handleWheelInteract(e); setupDragListeners(); }}
						bind:this={colorWheel}
						aria-label="Color Hue and Saturation Wheel"
					>
						<div 
							class="w-3.5 h-3.5 border-2 border-black rounded-full absolute shadow-sm pointer-events-none" 
							style="left: calc(50% + {wheelR * Math.cos(wheelRad)}% - 7px); top: calc(50% + {wheelR * Math.sin(wheelRad)}% - 7px); background-color: {hsvToHex(pickerHue, pickerSat, 100)};"
						></div>
					</button>

					<div class="w-full">
						<div class="flex justify-between text-[11px] font-bold text-gray2 mb-1.5">
							<span>Dark</span>
							<span>Light</span>
						</div>
						<input type="range" min="0" max="100" bind:value={pickerVal} on:input={updateCustomColor} aria-label="Brightness selector" class="w-full h-3 rounded-full appearance-none outline-none cursor-pointer" style="background: linear-gradient(to right, #000, hsl({pickerHue}, {pickerSat}%, 50%));" />
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="flex flex-col h-full z-10 w-full" in:fly={{ x: -340, duration: 300 }} out:fly={{ x: -340, duration: 300 }}>
			<div class="flex items-center justify-between mb-4">
				<span class="text-xl font-bold text-white tracking-tight">Data Source</span>
			</div>

			<div class="relative flex w-full bg-gray1 p-1 rounded-xl cursor-pointer select-none mb-6">
				<div class="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-lime rounded-lg transition-transform duration-300 ease-in-out shadow-sm" style="transform: translateX({mode === 'LIVE' ? '0' : '100%'})"></div>
				<div class="flex-1 text-center py-2 relative z-10 text-sm font-bold {mode === 'LIVE' ? 'text-black' : 'text-gray2'}" on:click={() => mode = 'LIVE'} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && (mode = 'LIVE')}>Live Events</div>
				<div class="flex-1 text-center py-2 relative z-10 text-sm font-bold {mode === 'CUSTOM' ? 'text-black' : 'text-gray2'}" on:click={() => mode = 'CUSTOM'} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && (mode = 'CUSTOM')}>Custom</div>
			</div>

			{#if mode === 'CUSTOM'}
				<div class="flex items-center justify-between mb-4">
					<span class="text-sm font-bold text-gray2">Select Events</span>
					<div class="flex bg-gray1 rounded-2xl p-1 border border-gray2/20">
						<button class="px-3 py-1 text-xs rounded-xl font-bold transition-colors {currentFilter === 'LIVE' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => (currentFilter = 'LIVE')}>Live</button>
						<button class="px-3 py-1 text-xs rounded-xl font-bold transition-colors {currentFilter === 'PAST' ? 'bg-lime text-black' : 'text-gray2 hover:text-white'}" on:click={() => (currentFilter = 'PAST')}>Past</button>
					</div>
				</div>

				<input type="text" placeholder="Search events..." bind:value={searchQuery} class="w-full bg-gray1 border border-gray2/30 text-white rounded-xl px-4 py-2 text-sm mb-4 outline-none focus:border-lime transition-colors" />

				<div class="flex-1 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
					{#each filteredEvents as event (event.event_id)}
						{@const isSelected = selectedCustomIds.includes(event.event_id)}
						<div class="flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer border {isSelected ? 'border-lime bg-lime/10' : 'border-transparent hover:bg-gray1'}" on:click={() => toggleEvent(event.event_id)} role="button" tabindex="0" on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleEvent(event.event_id); }}>
							<div class="w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-gray1">
								{#if event.event_flyer}
									<img class="w-full h-full object-cover" src={event.event_flyer} alt={event.event_name} />
								{/if}
							</div>
							<div class="flex flex-col min-w-0 flex-1">
								<div class="text-white font-bold text-xs truncate">{event.event_name}</div>
								<div class="text-gray2 text-[10px]">{event.event_id}</div>
							</div>
							{#if isSelected}
								<div class="w-4 h-4 rounded-full bg-lime border-2 border-black flex items-center justify-center"></div>
							{/if}
						</div>
					{/each}
					{#if filteredEvents.length === 0}
						<div class="text-center text-gray2 text-sm py-4">No data found.</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.custom-scrollbar::-webkit-scrollbar { width: 4px; }
	.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-gray2); opacity: 0.3; border-radius: 4px; }
	
	input[type=range]::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 2px solid #333;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0,0,0,0.5);
	}
	input[type=range]::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 2px solid #333;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0,0,0,0.5);
	}
</style>