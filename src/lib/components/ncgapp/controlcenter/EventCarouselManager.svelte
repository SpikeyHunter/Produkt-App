<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchUpcomingEvents, removeEventFromCarousel, updateEventOrder } from '$lib/services/controlCenterService';
	import type { UpcomingEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let events: UpcomingEvent[] = [];
	export let selectedEventId: number | null = null;

	let draggedItem: UpcomingEvent | null = null;
	let isDraggingOver = false;
	let currentIndex = 0;
	let isTransitioning = false;

	onMount(async () => {
		await loadEvents();
	});

	async function loadEvents() {
		events = await fetchUpcomingEvents();
		dispatch('eventsLoaded', events);
		if (events.length > 0 && !selectedEventId) {
			handleSelect(events[0]);
		}
	}

	async function handleRemove(event: UpcomingEvent) {
		const success = await removeEventFromCarousel(event.event_id);
		if (success) {
			if (selectedEventId === event.event_id) {
				selectedEventId = null;
				dispatch('select', null);
			}
			await loadEvents();
			if (currentIndex >= events.length) {
				currentIndex = Math.max(0, events.length - 1);
			}
		}
	}

	function handleSelect(event: UpcomingEvent) {
		selectedEventId = event.event_id;
		dispatch('select', event);
	}

	function nextSlide() {
		if (isTransitioning || events.length === 0) return;
		isTransitioning = true;
		currentIndex = (currentIndex + 1) % events.length;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400);
	}

	function prevSlide() {
		if (isTransitioning || events.length === 0) return;
		isTransitioning = true;
		currentIndex = (currentIndex - 1 + events.length) % events.length;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400);
	}

	function goToSlide(index: number) {
		if (isTransitioning || index === currentIndex) return;
		isTransitioning = true;
		currentIndex = index;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400);
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (e.deltaY > 0) {
			nextSlide();
		} else if (e.deltaY < 0) {
			prevSlide();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			prevSlide();
		} else if (e.key === 'ArrowRight') {
			nextSlide();
		}
	}

	function handleDragStart(e: DragEvent, item: UpcomingEvent) {
		draggedItem = item;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
		}
	}

	function handleDropZoneDragOver(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = true;
		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy';
		}
	}

	function handleDropZoneDragLeave() {
		isDraggingOver = false;
	}

	async function handleDropZoneDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;

		const data = e.dataTransfer?.getData('application/json');
		if (data) {
			try {
				const sourceEvent = JSON.parse(data);
				dispatch('addFromSource', sourceEvent);
			} catch (err) {
				console.error('Failed to parse dropped data:', err);
			}
		}
	}

	function getSlidePosition(index: number): string {
		const diff = index - currentIndex;
		const total = events.length;
		
		let position = diff;
		if (position > total / 2) position -= total;
		if (position < -total / 2) position += total;
		
		if (position === 0) return 'center';
		if (position === 1) return 'right';
		if (position === -1) return 'left';
		if (position > 1) return 'far-right';
		return 'far-left';
	}

	$: visibleEvents = events.length > 0 ? events : [];
	$: if (selectedEventId && events.length > 0) {
		const index = events.findIndex(e => e.event_id === selectedEventId);
		if (index !== -1 && index !== currentIndex) {
			currentIndex = index;
		}
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between">
			<h3 class="text-white text-sm font-bold">Event Carousel</h3>
			<span class="text-xs text-gray2">{events.length} events</span>
		</div>
	</div>

	<div 
		class="flex-1 relative overflow-hidden carousel-wrapper" 
		on:dragover={handleDropZoneDragOver}
		on:dragleave={handleDropZoneDragLeave}
		on:drop={handleDropZoneDrop}
		role="application"
		aria-label="Event carousel"
	>
		{#if events.length === 0}
			<div class="flex flex-col items-center justify-center h-full text-center border-2 border-dashed rounded-xl m-4 transition-colors {isDraggingOver ? 'border-lime bg-lime/5' : 'border-gray1'}">
				<svg class="w-16 h-16 mb-3 transition-colors {isDraggingOver ? 'text-lime' : 'text-gray2'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2"></rect>
					<path d="M12 8v8m-4-4h8"></path>
				</svg>
				<p class="text-gray2 text-sm font-bold">{isDraggingOver ? 'Drop here to add' : 'No events in carousel'}</p>
				<p class="text-gray3 text-xs mt-1">{isDraggingOver ? 'Release to add event' : 'Click or drag events from the list'}</p>
			</div>
		{:else}
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
			<div class="carousel-container" on:wheel={handleWheel} on:keydown={handleKeydown} role="region" aria-label="Event carousel navigation" tabindex="0">
				{#each visibleEvents as event, index (event.event_id)}
					{@const position = getSlidePosition(index)}
					<div class="card-holder {position}">
						<button
							type="button"
							class="carousel-card"
							class:is-center={position === 'center'}
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, event)}
							on:click={() => {
								if (position === 'center') {
									handleSelect(event);
								} else {
									goToSlide(index);
								}
							}}
							aria-label="Event {index + 1}: {event.event_name}"
						>
							<div class="order-badge">{index + 1}</div>

							{#if event.event_flyer}
								<img src={event.event_flyer} alt={event.event_name} class="card-image" draggable="false" />
							{:else}
								<div class="card-placeholder">
									<svg class="w-12 h-12 text-lime" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
									</svg>
								</div>
							{/if}

							{#if position === 'center' && selectedEventId === event.event_id}
								<div class="selection-overlay"></div>
							{/if}
						</button>

						{#if position === 'center'}
							<button 
								type="button" 
								on:click|stopPropagation={() => handleRemove(event)} 
								class="remove-btn"
								aria-label="Remove {event.event_name} from carousel"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<button 
				type="button"
				class="nav-arrow left" 
				on:click={prevSlide}
				aria-label="Previous event"
			>
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			</button>
			
			<button 
				type="button"
				class="nav-arrow right" 
				on:click={nextSlide}
				aria-label="Next event"
			>
				<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>

			{#if events.length > 1}
				<div class="dots-container">
					{#each events as _, index}
						<button
							type="button"
							class="dot"
							class:active={index === currentIndex}
							on:click={() => goToSlide(index)}
							aria-label="Go to event {index + 1}"
						></button>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.carousel-wrapper {
		position: relative;
	}

	.carousel-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		perspective: 1000px;
	}

	.carousel-container:focus {
		outline: none;
	}

	.carousel-container:focus-visible {
		outline: 2px solid #e1ff00;
		outline-offset: -2px;
		border-radius: 8px;
	}

	.card-holder {
		position: absolute;
		width: 180px;
		height: 240px;
		transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.card-holder.center {
		transform: translateX(0) scale(1.1) rotateY(0deg);
		z-index: 10;
		opacity: 1;
		filter: brightness(1);
	}

	.card-holder.left {
		transform: translateX(-200px) scale(0.85) rotateY(15deg);
		z-index: 5;
		opacity: 0.6;
		filter: brightness(0.7);
	}

	.card-holder.right {
		transform: translateX(200px) scale(0.85) rotateY(-15deg);
		z-index: 5;
		opacity: 0.6;
		filter: brightness(0.7);
	}

	.card-holder.far-left {
		transform: translateX(-350px) scale(0.7) rotateY(25deg);
		z-index: 1;
		opacity: 0.3;
		filter: brightness(0.5);
	}

	.card-holder.far-right {
		transform: translateX(350px) scale(0.7) rotateY(-25deg);
		z-index: 1;
		opacity: 0.3;
		filter: brightness(0.5);
	}

	.carousel-card {
		position: relative;
		width: 100%;
		height: 100%;
		border-radius: 12px;
		overflow: hidden;
		cursor: pointer;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
		border: none;
		background: transparent;
		padding: 0;
	}

	.card-holder:hover .carousel-card.is-center {
		transform: scale(1.05);
	}

	.order-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		width: 28px;
		height: 28px;
		background: #e1ff00;
		color: #000;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: bold;
		z-index: 20;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.card-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card-placeholder {
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(225, 255, 0, 0.2), rgba(225, 255, 0, 0.1));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.remove-btn {
		position: absolute;
		top: 0;
		right: 0;
		width: 32px;
		height: 32px;
		background: #FCA5A5;
		color: white;
		border: none;
		border-bottom-left-radius: 8px;
		border-top-right-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s, background 0.2s;
		z-index: 30;
		cursor: pointer;
	}

	.card-holder:hover .remove-btn {
		opacity: 1;
	}

	.remove-btn:hover {
		background: #dc2626;
	}

	.selection-overlay {
		position: absolute;
		inset: 0;
		background: rgba(225, 255, 0, 0.2);
		pointer-events: none;
		border: 2px solid #e1ff00;
		border-radius: 12px;
	}

	.nav-arrow {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 40px;
		height: 40px;
		background: rgba(33, 33, 33, 0.8);
		border: 2px solid #e1ff00;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #e1ff00;
		cursor: pointer;
		transition: all 0.2s;
		z-index: 15;
		backdrop-filter: blur(4px);
	}

	.nav-arrow:hover {
		background: #e1ff00;
		color: #000;
		transform: translateY(-50%) scale(1.1);
	}

	.nav-arrow.left {
		left: 20px;
	}

	.nav-arrow.right {
		right: 20px;
	}

	.dots-container {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		z-index: 15;
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		cursor: pointer;
		transition: all 0.2s;
		padding: 0;
	}

	.dot:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	.dot.active {
		background: #e1ff00;
		width: 24px;
		border-radius: 4px;
	}
</style>