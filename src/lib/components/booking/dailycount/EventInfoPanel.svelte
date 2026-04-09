<script lang="ts">
	import type { EventData, DailyCount } from '$lib/types/dailycount';
	import { createEventDispatcher, onDestroy } from 'svelte';
	import { slide, fly } from 'svelte/transition';

	export let selectedEventForInfo: EventData | null = null;
	export let latestCountForSelected: DailyCount | null = null;

	const dispatch = createEventDispatcher();

	let isPickingColor = false;
	let showCustomPicker = false;
	let magX = 0,
		magY = 0,
		clientX = 0,
		clientY = 0;
	let imgWidth = 0,
		imgHeight = 0;
	let showMag = false;

	let pickerHue = 0,
		pickerSat = 100,
		pickerVal = 100;
	let colorWheel: HTMLButtonElement;
	let isDraggingWheel = false;

	// Stage Dropdown Logic
	let showStageDropdown = false;
	const stageOptions = [
		{ name: 'None', color: 'var(--color-gray2)', ga: 0, vip: 0 },
		{ name: 'Nuits Bazart', color: '#ffe089', ga: 300, vip: 0 },
		{ name: 'NCG Show', color: '#c4ef9b', ga: 2000, vip: 250 },
		{ name: 'NCG 360', color: '#fa7a90', ga: 1850, vip: 400 },
		{ name: 'DSTRKT', color: '#afd3e9', ga: 2000, vip: 250 }
	];

	let localStageType: {
		name: string;
		capacity: { GA: number; VIP: number };
		eventId: number | null;
	} = {
		name: 'None',
		capacity: { GA: 0, VIP: 0 },
		eventId: null
	};

	$: if (selectedEventForInfo) {
		if (localStageType.eventId !== selectedEventForInfo.event_id) {
			const st = selectedEventForInfo.stage_type as any;

			localStageType = {
				name: st?.name || 'None',
				capacity: {
					GA: st?.capacity?.GA ?? 0,
					VIP: st?.capacity?.VIP ?? 0
				},
				eventId: selectedEventForInfo.event_id
			};
		}
	}

	$: wheelRad = (pickerHue - 90) * (Math.PI / 180);
	$: wheelR = (pickerSat / 100) * 50;

	function formatToEasternTime(utcDateStr: string | undefined): string {
		if (!utcDateStr) return 'N/A';
		const date = new Date(utcDateStr);
		const dayFormatter = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			day: 'numeric'
		});
		const dayNum = parseInt(dayFormatter.format(date));
		const suffix =
			['th', 'st', 'nd', 'rd'][
				(dayNum % 10 > 3 ? 0 : dayNum % 10) * ((dayNum % 100) - (dayNum % 10) != 10 ? 1 : 0)
			] || 'th';
		const month = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			month: 'long'
		}).format(date);
		const year = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			year: 'numeric'
		}).format(date);
		let time = new Intl.DateTimeFormat('en-US', {
			timeZone: 'America/New_York',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		}).format(date);
		return `${month} ${dayNum}${suffix} ${year} at ${time.replace(' AM', 'AM').replace(' PM', 'PM')}`;
	}

	function hsvToHex(h: number, s: number, v: number) {
		s /= 100;
		v /= 100;
		let c = v * s;
		let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		let m = v - c;
		let r = 0,
			g = 0,
			b = 0;
		if (h < 60) {
			r = c;
			g = x;
			b = 0;
		} else if (h < 120) {
			r = x;
			g = c;
			b = 0;
		} else if (h < 180) {
			r = 0;
			g = c;
			b = x;
		} else if (h < 240) {
			r = 0;
			g = x;
			b = c;
		} else if (h < 300) {
			r = x;
			g = 0;
			b = c;
		} else {
			r = c;
			g = 0;
			b = x;
		}
		const toHex = (n: number) =>
			Math.round((n + m) * 255)
				.toString(16)
				.padStart(2, '0')
				.toUpperCase();
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
		const dist = Math.min(Math.sqrt(dx * dx + dy * dy), cx);
		pickerHue = angle;
		pickerSat = (dist / cx) * 100;
		updateCustomColor();
	}

	let onMove = (e: MouseEvent) => {
		if (isDraggingWheel) handleWheelInteract(e);
	};
	let onUp = () => {
		isDraggingWheel = false;
	};

	function setupDragListeners() {
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}
	});

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
			canvas.width = rect.width;
			canvas.height = rect.height;
			ctx.drawImage(img, 0, 0, rect.width, rect.height);
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const data = ctx.getImageData(x, y, 1, 1).data;
			if (data[3] > 0) {
				const hex =
					'#' +
					((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2])
						.toString(16)
						.slice(1)
						.toUpperCase();
				dispatch('colorChanged', { id: selectedEventForInfo.event_id, color: hex });
			}
			isPickingColor = false;
			showMag = false;
		} catch (err) {
			alert('CORS security settings prevent picking from this image directly.');
			isPickingColor = false;
			showMag = false;
		}
	}

	function selectStageOption(opt: any) {
		if (!selectedEventForInfo) return;
		localStageType = {
			name: opt.name,
			capacity: { GA: opt.ga, VIP: opt.vip },
			eventId: selectedEventForInfo.event_id
		};
		showStageDropdown = false;
		saveStageType();
	}

	function saveStageType() {
		if (!selectedEventForInfo) return;
		dispatch('stageTypeChanged', {
			id: selectedEventForInfo.event_id,
			stage_type: { name: localStageType.name, capacity: localStageType.capacity }
		});
	}

	function getStageColor(name: string) {
		const opt = stageOptions.find((o) => o.name === name);
		return opt ? opt.color : 'var(--color-gray2)';
	}
</script>

{#if selectedEventForInfo}
	<div
		class="flex flex-col z-20 h-full overflow-y-auto custom-scrollbar pr-1 absolute inset-0 bg-navbar p-5"
		transition:fly={{ x: 340, duration: 300, opacity: 1 }}
	>
		<button
			class="rounded-3xl bg-[var(--color-gray3)] text-black hover:bg-lime px-3 py-1.5 flex items-center gap-1.5 cursor-pointer text-xs font-bold transition-colors w-max mb-6 outline-none"
			on:click={() => dispatch('closeInfoPanel')}
		>
			&larr; Go Back
		</button>

		<div class="mb-5 mt-2">
			<h2 class="text-xl font-bold text-lime leading-tight mb-1">
				{selectedEventForInfo.event_name}
			</h2>
			<p class="text-[11px] text-gray2 mb-0.5">
				ID: {selectedEventForInfo.event_id}{#if selectedEventForInfo.event_venue}
					- {selectedEventForInfo.event_venue}{/if}
			</p>
			<p class="text-[11px] text-white">{selectedEventForInfo.event_date}</p>
		</div>

		<div class="flex gap-4 mb-4 relative">
			<div class="w-32 h-auto shrink-0 relative">
				{#if selectedEventForInfo.event_flyer}
					<button
						type="button"
						class="relative w-full h-full border-2 shadow-lg rounded-lg overflow-hidden p-0 bg-transparent transition-all outline-none focus:ring-2 focus:ring-lime {isPickingColor
							? ' ring-offset-navbar cursor-crosshair'
							: 'cursor-default'}"
						style="border-color: {selectedEventForInfo.color}"
						on:click={handleImageClick}
						on:mousemove={handleImageMouseMove}
						on:mouseleave={() => (showMag = false)}
					>
						<img
							src={selectedEventForInfo.event_flyer}
							alt="Flyer"
							class="w-full h-full object-cover block pointer-events-none"
							crossorigin="anonymous"
							draggable="false"
						/>
						{#if isPickingColor && showMag}
							<div
								class="fixed pointer-events-none rounded-full border-[3px] border-white shadow-2xl z-50 overflow-hidden bg-navbar"
								style="width: 80px; height: 80px; left: {clientX}px; top: {clientY -
									60}px; transform: translate(-50%, -50%);"
							>
								<div
									class="w-full h-full"
									style="background-image: url({selectedEventForInfo.event_flyer}); background-size: {imgWidth *
										4}px {imgHeight * 4}px; background-position: -{magX * 4 - 40}px -{magY * 4 -
										40}px;"
								></div>
								<div
									class="absolute inset-0 flex items-center justify-center text-lime font-bold text-2xl drop-shadow-md"
								>
									+
								</div>
							</div>
						{/if}
					</button>
				{:else}
					<div
						class="w-full h-32 bg-gray1 border-2 rounded-lg flex items-center justify-center text-xs text-gray2"
						style="border-color: {selectedEventForInfo.color}"
					>
						No Flyer
					</div>
				{/if}
			</div>

			<div class="flex flex-col flex-1 gap-3">
				<div class="flex flex-col gap-2 relative">
					<span class="text-xs font-bold text-white">Theme Color</span>
					<div class="relative flex items-center gap-2">
						<button
							aria-label="Toggle custom color picker"
							class="w-8 h-8 shrink-0 rounded-md shadow-inner border-2 border-white/20 cursor-pointer transition-transform hover:scale-105 outline-none"
							style="background-color: {selectedEventForInfo.color || '#000000'}"
							on:click={() => (showCustomPicker = !showCustomPicker)}
						></button>
						<input
							type="text"
							value={selectedEventForInfo.color}
							on:change={(e) =>
								dispatch('colorChanged', {
									id: selectedEventForInfo?.event_id,
									color: e.currentTarget.value
								})}
							class="w-full bg-gray1 text-white rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-lime uppercase font-mono"
							placeholder="#HEX"
						/>
					</div>

					{#if showCustomPicker}
						<button
							type="button"
							class="fixed inset-0 z-40 bg-transparent w-full h-full border-none cursor-default outline-none"
							on:click={() => (showCustomPicker = false)}
							aria-label="Close color picker"
						></button>
						<div
							class="absolute top-full right-6 mt-2 bg-gray1 p-5 rounded-2xl shadow-5xl shadow-black z-50 flex flex-col items-center gap-4 w-[240px]"
							transition:fly={{ y: 10, duration: 200 }}
						>
							<button
								type="button"
								class="w-44 h-44 rounded-full cursor-crosshair relative border-2 border-gray2/50 outline-none focus:ring-2 focus:ring-lime p-0 shadow-lg"
								aria-label="Interactive color wheel"
								style="background: radial-gradient(circle at 50% 50%, white 0%, transparent 100%), conic-gradient(red, yellow, lime, cyan, blue, magenta, red);"
								on:mousedown={(e) => {
									isDraggingWheel = true;
									handleWheelInteract(e);
									setupDragListeners();
								}}
								bind:this={colorWheel}
							>
								<div
									class="w-3.5 h-3.5 border-2 border-black rounded-full absolute shadow-sm pointer-events-none"
									style="left: calc(50% + {wheelR *
										Math.cos(wheelRad)}% - 7px); top: calc(50% + {wheelR *
										Math.sin(wheelRad)}% - 7px); background-color: {hsvToHex(
										pickerHue,
										pickerSat,
										100
									)};"
								></div>
							</button>
							<div class="w-full">
								<div class="flex justify-between text-[11px] font-bold text-gray2 mb-1.5">
									<span>Dark</span><span>Light</span>
								</div>
								<input
									type="range"
									min="0"
									max="100"
									bind:value={pickerVal}
									on:input={updateCustomColor}
									class="w-full h-3 rounded-full appearance-none outline-none cursor-pointer"
									aria-label="Brightness selector"
									style="background: linear-gradient(to right, #000, hsl({pickerHue}, {pickerSat}%, 50%));"
								/>
							</div>
						</div>
					{/if}
				</div>

				<button
					class="w-full h-8 shrink-0 border text-[11px] font-bold rounded-3xl transition-colors flex items-center justify-center gap-2 outline-none {isPickingColor
						? 'bg-lime text-black border-lime hover:bg-lime/90'
						: 'bg-gray1 hover:bg-gray2/20 border-transparent text-white'}"
					on:click={() => {
						isPickingColor = !isPickingColor;
						showCustomPicker = false;
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						><path d="m2 22 1-1h3l9-9" /><path d="M3 21v-3l9-9" /><path d="m15 6 3 3" /><path
							d="M19.3 9.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0l-2.8 2.8 8.6 8.6z"
						/></svg
					>
					{isPickingColor ? 'Select on Image' : 'Pick from Flyer'}
				</button>

				<div class="flex flex-col gap-2 mt-1 relative z-30">
					<span class="text-xs font-bold text-white">Venue Config</span>
					<button
						class="w-full bg-gray1 text-white rounded-xl px-3 py-1.5 text-[11px] font-bold flex justify-between items-center outline-none focus:border-lime transition-colors cursor-pointer"
						on:click={() => (showStageDropdown = !showStageDropdown)}
					>
						<div class="flex items-center gap-2">
							<div
								class="w-3 h-3 rounded-full border border-black/50"
								style="background-color: {getStageColor(localStageType.name)}"
							></div>
							<span>{localStageType.name}</span>
						</div>
						<svg
							class="w-3 h-3 transition-transform duration-200 {showStageDropdown
								? 'rotate-180'
								: ''}"
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

					{#if showStageDropdown}
						<button
							type="button"
							class="fixed inset-0 w-full h-full z-40 cursor-default outline-none appearance-none border-none bg-transparent"
							on:click={() => (showStageDropdown = false)}
							aria-label="Close stage dropdown"
						></button>
						<div
							class="absolute top-full left-0 w-full mt-1 bg-navbar rounded-xl shadow-xl z-50 overflow-hidden py-1"
						>
							{#each stageOptions as opt}
								<button
									class="w-full text-left px-3 py-2 text-[11px] text-white hover:bg-gray1 transition-colors flex items-center gap-2 outline-none border-none cursor-pointer bg-transparent"
									on:click={() => selectStageOption(opt)}
								>
									<div
										class="w-3 h-3 rounded-full border border-black/50 shrink-0"
										style="background-color: {opt.color}"
									></div>
									{opt.name}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		</div>

		{#if localStageType.name !== 'None'}
			<div class="bg-gray1/40 rounded-xl p-3 mb-4 flex gap-3" transition:slide={{ duration: 200 }}>
				<div class="flex-1 flex flex-col gap-1.5">
					<span class="text-[11px] font-bold text-gray2 uppercase tracking-wide">GA Capacity</span>
					<input
						type="number"
						bind:value={localStageType.capacity.GA}
						on:blur={saveStageType}
						class="w-full bg-gray1 text-white rounded-md px-2 py-1 text-xs outline-none focus:border-lime no-spinners"
					/>
				</div>
				<div class="flex-1 flex flex-col gap-1.5">
					<span class="text-[11px] font-bold text-gray2 uppercase tracking-wide">VIP Capacity</span>
					<input
						type="number"
						bind:value={localStageType.capacity.VIP}
						on:blur={saveStageType}
						class="w-full bg-gray1 text-white rounded-md px-2 py-1 text-xs outline-none focus:border-lime no-spinners"
					/>
				</div>
			</div>
		{/if}

		<div class="bg-gray1/40 rounded-xl p-4 mb-4">
			<h3 class="text-sm font-bold uppercase text-gray3 mb-3">Ticket Count Summary</h3>
			<div class="space-y-2 text-sm">
				<div class="flex justify-between border-b border-gray2/10 pb-2">
					<span class="text-lime">TOTAL</span><span class="font-bold text-lime"
						>{latestCountForSelected?.total || 0}</span
					>
				</div>
				<div class="flex justify-between pl-2">
					<span class="text-gray2">GA</span><span class="font-bold text-white"
						>{latestCountForSelected?.ga || 0}</span
					>
				</div>
				<div class="flex justify-between pl-2">
					<span class="text-gray2">VIP</span><span class="font-bold text-white"
						>{latestCountForSelected?.vip || 0}</span
					>
				</div>
			</div>
		</div>

		<div class="text-[13px] font-bold text-gray2 text-center w-full mb-4">
			Last update -<span class="text-lime ml-1"
				>{formatToEasternTime(latestCountForSelected?.report_generated_at)}</span
			>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray2);
		opacity: 0.3;
		border-radius: 4px;
	}

	/* Fix for hiding number input spinners */
	input[type='number'].no-spinners::-webkit-inner-spin-button,
	input[type='number'].no-spinners::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	input[type='number'].no-spinners {
		-moz-appearance: textfield;
		appearance: none;
	}

	input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 2px solid #333;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}
	input[type='range']::-moz-range-thumb {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: white;
		border: 2px solid #333;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
	}
</style>
