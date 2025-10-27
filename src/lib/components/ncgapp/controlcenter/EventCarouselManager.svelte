<script lang="ts">
	import { onMount } from 'svelte';
	// Removed unused 'updateEventOrder' import
	import { fetchUpcomingEvents, removeEventFromCarousel } from '$lib/services/controlCenterService';
	import type { UpcomingEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let events: UpcomingEvent[] = [];
	export let selectedEventId: number | null = null;

	let draggedItem: UpcomingEvent | null = null;
	let isDraggingOver = false;
	let currentIndex = 0;
	let isTransitioning = false;
	let carouselElement: HTMLDivElement;

	onMount(async () => {
		await loadEvents();
		// Add keydown listener to the carousel element when it's focused
		if (carouselElement) {
			carouselElement.focus();
		}
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
			const removedEventId = event.event_id;
			
			// Manually filter out the removed event to avoid race conditions
			const newEvents = events.filter(e => e.event_id !== removedEventId);
			const oldIndex = currentIndex;

			events = newEvents; // Update the bound events prop
			
			if (selectedEventId === removedEventId) {
				selectedEventId = null;
				if (newEvents.length > 0) {
					// Select the new item at the same index, or the last item
					const newIndex = Math.min(oldIndex, newEvents.length - 1);
					currentIndex = newIndex;
					handleSelect(newEvents[newIndex]);
				} else {
					// Carousel is empty
					currentIndex = 0;
					dispatch('select', null);
				}
			} else {
				// Resync currentIndex if the selected item's index changed
				if (selectedEventId) {
					const newIndex = newEvents.findIndex(e => e.event_id === selectedEventId);
					if (newIndex !== -1) {
						currentIndex = newIndex;
					}
				}
			}
			
			// Dispatch the updated events list to the parent
			dispatch('eventsLoaded', newEvents);
		}
	}

	function handleSelect(event: UpcomingEvent) {
		selectedEventId = event.event_id;
		dispatch('select', event);
	}

	function nextSlide() {
		if (isTransitioning || events.length < 2) return;
		isTransitioning = true;
		currentIndex = (currentIndex + 1) % events.length;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400); // Matches CSS transition time
	}

	function prevSlide() {
		if (isTransitioning || events.length < 2) return;
		isTransitioning = true;
		currentIndex = (currentIndex - 1 + events.length) % events.length;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400); // Matches CSS transition time
	}

	function goToSlide(index: number) {
		if (isTransitioning || index === currentIndex) return;
		isTransitioning = true;
		currentIndex = index;
		handleSelect(events[currentIndex]);
		setTimeout(() => { isTransitioning = false; }, 400); // Matches CSS transition time
	}

	function handleWheel(e: WheelEvent) {
		// Don't prevent default, allow vertical scroll if not in carousel
		if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
			// Horizontal scroll
			e.preventDefault();
			if (e.deltaX > 0) {
				nextSlide();
			} else if (e.deltaX < 0) {
				prevSlide();
			}
		} else {
			// Vertical scroll
			e.preventDefault(); // Prevent page scroll
			if (e.deltaY > 0) {
				nextSlide();
			} else if (e.deltaY < 0) {
				prevSlide();
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			prevSlide();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
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
				// Check if event is already in the carousel
				if (!events.find(ev => ev.event_id === sourceEvent.event_id)) {
					dispatch('addFromSource', sourceEvent);
				}
			} catch (err) {
				console.error('Failed to parse dropped data:', err);
			}
		}
	}

	/**
	 * [REVISED] Calculates the CSS class for a slide's position.
	 * This new logic correctly handles any number of events by calculating
	 * the slide's position relative to the center (0) and assigning
	 * 'hidden' classes to items that are too far left or right.
	 */
	function getSlidePosition(index: number): string {
		const total = events.length;
		if (total <= 1) return 'center';

		// Calculate the relative position from the current index
		let pos = (index - currentIndex + total) % total;
		
		const half = Math.floor(total / 2);

		// Re-map positions to be centered around 0
		// Example (total=6, half=3):
		// pos 0 -> 0 (center)
		// pos 1 -> 1 (right)
		// pos 2 -> 2 (far-right)
		// pos 3 -> 3 (hidden-right) ... but 3 > half, so pos = 3 - 6 = -3 (hidden-left)
		// pos 4 -> 4 (far-left) ... but 4 > half, so pos = 4 - 6 = -2 (far-left)
		// pos 5 -> 5 (left) ... but 5 > half, so pos = 5 - 6 = -1 (left)
		if (pos > half) {
			pos -= total;
		}

		// Handle small carousels (2-4 items) gracefully
		if (total === 2) {
			if (pos === 0) return 'center';
			if (pos === 1 || pos === -1) return 'right'; // pos 1 -> 1-2 = -1
		}

		if (total === 3) {
			if (pos === 0) return 'center';
			if (pos === 1) return 'right';
			if (pos === -1) return 'left'; // pos 2 -> 2-3 = -1
		}
		
		if (total === 4) {
			if (pos === 0) return 'center';
			if (pos === 1) return 'right';
			if (pos === -1) return 'left';
			if (pos === 2 || pos === -2) return 'far-right'; // pos 2 -> 2. pos 3 -> 3-4 = -1 (left).
		}

		// Standard 5-card display logic
		switch(pos) {
			case 0: return 'center';
			case 1: return 'right';
			case -1: return 'left';
			case 2: return 'far-right';
			case -2: return 'far-left';
			default:
				// All other cards are hidden
				return pos > 2 ? 'hidden-right' : 'hidden-left';
		}
	}

	// This reactive declaration ensures that if the parent `events` array
	// changes (e.g., an item is added), we check if the
	// currentIndex needs to be updated (e.g., if it was pointing to null).
	$: if (events.length > 0 && selectedEventId) {
		const index = events.findIndex(e => e.event_id === selectedEventId);
		if (index !== -1 && index !== currentIndex) {
			// Sync current index if selected ID changes from outside
			currentIndex = index;
		}
	} else if (events.length > 0 && !selectedEventId) {
		// If no event is selected, select the one at the current index
		handleSelect(events[currentIndex]);
	}
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between">
			<h3 class="text-white text-sm font-bold">Event Carousel</h3>
			<span class="text-xs text-gray2">{events.length} event{events.length !== 1 ? 's' : ''}</span>
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
			<!-- Drop Zone for Empty Carousel -->
			<div 
				class="absolute inset-m-4 border-2 border-dashed rounded-xl m-4 flex flex-col items-center justify-center h-full text-center transition-colors 
				{isDraggingOver ? 'border-lime bg-lime/5' : 'border-gray1'}"
			>
				<svg class="w-16 h-16 mb-3 transition-colors {isDraggingOver ? 'text-lime' : 'text-gray2'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<rect x="3" y="3" width="18" height="18" rx="2"></rect>
					<path d="M12 8v8m-4-4h8"></path>
				</svg>
				<p class="text-gray2 text-sm font-bold">{isDraggingOver ? 'Drop here to add' : 'No events in carousel'}</p>
				<p class="text-gray3 text-xs mt-1">{isDraggingOver ? 'Release to add event' : 'Click or drag events from the list'}</p>
			</div>
		{:else}
			<!-- Carousel Container -->
			<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
			<!-- svelte-ignore a11y-no-noninteractive-tabindex -->
			<div 
				class="carousel-container" 
				bind:this={carouselElement}
				on:wheel={handleWheel} 
				on:keydown={handleKeydown} 
				role="region" 
				aria-label="Event carousel navigation" 
				tabindex="0"
			>
				{#each events as event, index (event.event_id)}
					{@const position = getSlidePosition(index)}
					<div class="card-holder {position}">
						<button
							type="button"
							class="carousel-card"
							class:is-center={position === 'center'}
							draggable="true"
							on:dragstart={(e) => handleDragStart(e, event)}
							on:click|preventDefault={() => {
								if (position === 'center') {
									// If it's already center, do nothing (it's already selected)
									// Or you could open a modal, etc.
								} else {
									goToSlide(index);
								}
							}}
							aria-label="Event {index + 1}: {event.event_name}"
							aria-current={position === 'center'}
							tabindex={position === 'center' ? 0 : -1}
						>
							<div class="order-badge">{index + 1}</div>

							{#if event.event_flyer}
								<img 
									src={event.event_flyer} 
									alt={event.event_name} 
									class="card-image" 
									draggable="false" 
									on:error={(e) => {
										const img = e.currentTarget as HTMLImageElement;
										img.style.display = 'none';
										const placeholder = img.nextElementSibling as HTMLElement;
										if (placeholder) {
											placeholder.style.display = 'flex';
										}
									}}
								/>
								<!-- Fallback for broken image -->
								<div class="card-placeholder" style="display: none;">
									<svg class="w-12 h-12 text-lime" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
									</svg>
								</div>
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

			<!-- Navigation Arrows -->
			{#if events.length > 2}
				<button 
					type="button"
					class="nav-arrow left" 
					on:click={prevSlide}
					aria-label="Previous event"
					tabindex="-1"
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
					tabindex="-1"
				>
					<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			{/if}

			<!-- Dots Navigation -->
			{#if events.length > 1 && events.length < 20} <!-- Hide dots if too many -->
				<div class="dots-container">
					{#each events as _, index}
						<button
							type="button"
							class="dot"
							class:active={index === currentIndex}
							on:click={() => goToSlide(index)}
							aria-label="Go to event {index + 1}"
							tabindex="-1"
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

	/* Show focus ring only when keyboard-navigating */
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
		-webkit-transform-style: preserve-3d;
        transform-style: preserve-3d;
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
		-webkit-transform: translateZ(0); /* Promotes to hardware layer */
    	transform: translateZ(0);
	}

	.card-holder.center {
		transform: translateX(0) translateZ(50px) scale(1.1) rotateY(0deg);
		z-index: 10;
		opacity: 1;
		filter: brightness(1);
	}
	
	.card-holder:hover .carousel-card.is-center {
		transform: scale(1.05);
	}

	.card-holder.left {
		transform: translateX(-200px) translateZ(0) scale(0.85) rotateY(15deg);
		z-index: 5;
		opacity: 0.6;
		filter: brightness(0.7);
	}

	.card-holder.right {
		transform: translateX(200px) translateZ(0) scale(0.85) rotateY(-15deg);
		z-index: 5;
		opacity: 0.6;
		filter: brightness(0.7);
	}

	.card-holder.far-left {
		transform: translateX(-350px) translateZ(-50px) scale(0.7) rotateY(25deg);
		z-index: 1;
		opacity: 0.3;
		filter: brightness(0.5);
	}

	.card-holder.far-right {
		transform: translateX(350px) translateZ(-50px) scale(0.7) rotateY(-25deg);
		z-index: 1;
		opacity: 0.3;
		filter: brightness(0.5);
	}
	
	/* [NEW] Added hidden states for items off-screen */
	.card-holder.hidden-left {
		transform: translateX(-500px) translateZ(-100px) scale(0.5) rotateY(35deg);
		z-index: 0;
		opacity: 0;
		filter: brightness(0);
		pointer-events: none;
	}

	.card-holder.hidden-right {
		transform: translateX(500px) translateZ(-100px) scale(0.5) rotateY(-35deg);
		z-index: 0;
		opacity: 0;
		filter: brightness(0);
		pointer-events: none;
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
		background-color: #1a1a1a; /* Background color for images */
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

