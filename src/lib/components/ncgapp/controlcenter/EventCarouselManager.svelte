<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fetchUpcomingEvents, removeEventFromCarousel } from '$lib/services/controlCenterService';
	import type { UpcomingEvent } from '$lib/types/controlcenter';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	export let events: UpcomingEvent[] = [];
	export let selectedEventId: number | null = null;
	export let autoplay: boolean = false;

	let activeIndex = 0;
	let isDraggingOver = false;
	let autoPlayInterval: ReturnType<typeof setInterval>;
	let carouselStage: HTMLDivElement;
	let isDragging = false;
	let startX = 0;
	let currentX = 0;

	onMount(async () => {
		await loadEvents();
		if (autoplay && events.length > 1) {
			startAutoplay();
		}
	});

	onDestroy(() => {
		clearInterval(autoPlayInterval);
	});

	function startAutoplay() {
		clearInterval(autoPlayInterval);
		autoPlayInterval = setInterval(() => {
			next();
		}, 5000);
	}

	function stopAutoplay() {
		clearInterval(autoPlayInterval);
	}

	async function loadEvents() {
		events = await fetchUpcomingEvents();
		dispatch('eventsLoaded', events);
		if (events.length > 0) {
			selectEvent(0);
		}
	}

	function selectEvent(index: number) {
		if (events.length === 0) return;
		activeIndex = ((index % events.length) + events.length) % events.length;
		selectedEventId = events[activeIndex].event_id;
		dispatch('select', events[activeIndex]);
	}

	async function handleRemove(eventId: number) {
		const success = await removeEventFromCarousel(eventId);
		if (success) {
			events = events.filter((e) => e.event_id !== eventId);

			if (events.length === 0) {
				activeIndex = 0;
				selectedEventId = null;
				dispatch('select', null);
			} else {
				activeIndex = Math.min(activeIndex, events.length - 1);
				selectEvent(activeIndex);
			}

			dispatch('eventsLoaded', events);
		}
	}

	// ADD THIS NEW FUNCTION
	export async function refreshCurrentEvent() {
		const freshEvents = await fetchUpcomingEvents();
		const currentEventId = selectedEventId;
		events = freshEvents;

		if (currentEventId && events.length > 0) {
			const newIndex = events.findIndex((e) => e.event_id === currentEventId);
			if (newIndex !== -1) {
				activeIndex = newIndex;
				selectedEventId = events[activeIndex].event_id;
				dispatch('select', events[activeIndex]);
			} else {
				selectEvent(0);
			}
		}

		dispatch('eventsLoaded', events);
	}

	function next() {
		if (events.length > 0) {
			selectEvent(activeIndex + 1);
		}
	}

	function prev() {
		if (events.length > 0) {
			selectEvent(activeIndex - 1);
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDraggingOver = false;
		const data = e.dataTransfer?.getData('application/json');
		if (data) {
			try {
				const sourceEvent = JSON.parse(data);
				if (!events.find((ev) => ev.event_id === sourceEvent.event_id)) {
					dispatch('addFromSource', sourceEvent);
				}
			} catch (err) {
				console.error('Failed to parse dropped data:', err);
			}
		}
	}

	// Touch/Mouse drag handling
	function handlePointerDown(e: PointerEvent) {
		if (events.length <= 1) return;
		isDragging = true;
		startX = e.clientX;
		currentX = e.clientX;
		if (carouselStage) {
			carouselStage.style.cursor = 'grabbing';
		}
		if (autoplay) stopAutoplay();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!isDragging) return;
		currentX = e.clientX;
	}

	function handlePointerUp() {
		if (!isDragging) return;
		isDragging = false;

		const deltaX = currentX - startX;
		const threshold = 50;

		if (deltaX > threshold) {
			prev();
		} else if (deltaX < -threshold) {
			next();
		}

		if (carouselStage) {
			carouselStage.style.cursor = 'grab';
		}

		if (autoplay && events.length > 1) {
			startAutoplay();
		}
	}

	function getPosition(i: number, currentActive: number): number {
		const diff = i - currentActive;
		const total = events.length;
		let pos = diff;
		if (diff > total / 2) pos = diff - total;
		if (diff < -total / 2) pos = diff + total;
		return pos;
	}

	// Force reactivity by explicitly depending on activeIndex
	$: cardPositions = events.map((_, i) => getPosition(i, activeIndex));
</script>

<svelte:window on:pointerup={handlePointerUp} on:pointermove={handlePointerMove} />

<div class="carousel-wrapper">
	<!-- Header -->
	<div class="header">
		<h3 class="title">Event Carousel</h3>
		<span class="count">{events.length} event{events.length !== 1 ? 's' : ''}</span>
	</div>

	<!-- Main Content -->
	<div
		class="content"
		on:dragover={(e) => {
			e.preventDefault();
			isDraggingOver = true;
		}}
		on:dragleave={() => {
			isDraggingOver = false;
		}}
		on:drop={handleDrop}
		role="region"
		aria-label="Event carousel"
	>
		{#if events.length === 0}
			<!-- Empty State -->
			<div class="empty-state" class:dragging={isDraggingOver}>
				<svg
					class="empty-icon"
					class:active={isDraggingOver}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<rect x="3" y="3" width="18" height="18" rx="2"></rect>
					<path d="M12 8v8m-4-4h8"></path>
				</svg>
				<p class="empty-title">{isDraggingOver ? 'Drop here to add' : 'No events'}</p>
				<p class="empty-subtitle">
					{isDraggingOver ? 'Release to add event' : 'Drag events from the list'}
				</p>
			</div>
		{:else}
			<!-- Carousel -->
			<div
				class="carousel-stage"
				class:grabbing={isDragging}
				bind:this={carouselStage}
				on:pointerdown={handlePointerDown}
				role="group"
				aria-roledescription="carousel"
			>
				{#each events as event, i (event.event_id)}
					{@const pos = getPosition(i, activeIndex)}
					{@const isVisible = Math.abs(pos) <= 2}
					{@const x = pos * 240}
					{@const scale = pos === 0 ? 1.0 : Math.max(0.65, 0.85 - Math.abs(pos) * 0.15)}
					{@const rotateY = pos * -12}
					{@const z = pos === 0 ? 30 : -Math.abs(pos) * 40}
					{@const opacity = pos === 0 ? 1 : Math.max(0.4, 1 - Math.abs(pos) * 0.3)}
					{@const brightness = pos === 0 ? 1 : Math.max(0.6, 1 - Math.abs(pos) * 0.2)}
					{@const zIndex = 100 - Math.abs(pos)}

					<div
						class="card"
						class:hidden={!isVisible}
						style:transform="translateX({x}px) translateZ({z}px) scale({scale}) rotateY({rotateY}deg)"
						style:opacity
						style:filter="brightness({brightness})"
						style:z-index={zIndex}
						style:pointer-events={isVisible ? 'auto' : 'none'}
					>
						<button
							class="card-button"
							class:active={i === activeIndex}
							on:click={() => {
								if (i !== activeIndex) {
									selectEvent(i);
									if (autoplay) {
										stopAutoplay();
										startAutoplay();
									}
								}
							}}
							aria-label={event.event_name}
						>
							<!-- Badge -->
							<div class="badge">{i + 1}</div>
							{#if event.event_badge}
								{@const parsedBadge = (() => {
									try {
										return JSON.parse(event.event_badge);
									} catch {
										return { text: event.event_badge, color: '#e1ff00' };
									}
								})()}
								<div class="status-badge" style:background-color={parsedBadge.color}>
									{parsedBadge.text}
								</div>
							{/if}
							<!-- Flyer -->
							{#if event.event_flyer}
								<img
									src={event.event_flyer}
									alt={event.event_name}
									class="flyer"
									draggable="false"
								/>
							{:else}
								<div class="placeholder">
									<svg class="placeholder-icon" viewBox="0 0 24 24" fill="currentColor">
										<path
											d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
										></path>
									</svg>
								</div>
							{/if}

							<!-- Active Ring -->
							{#if i === activeIndex}
								<div class="ring"></div>
							{/if}
						</button>

						<!-- Remove Button -->
						{#if i === activeIndex}
							<button
								class="remove"
								on:click|stopPropagation={() => handleRemove(event.event_id)}
								aria-label="Remove event"
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							</button>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Navigation Controls -->
			{#if events.length > 1}
				<button
					class="nav prev"
					on:click={() => {
						prev();
						if (autoplay) {
							stopAutoplay();
							startAutoplay();
						}
					}}
					aria-label="Previous"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
				</button>

				<button
					class="nav next"
					on:click={() => {
						next();
						if (autoplay) {
							stopAutoplay();
							startAutoplay();
						}
					}}
					aria-label="Next"
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>

				<!-- Dots -->
				{#if events.length <= 15}
					<div class="dots">
						{#each events as _, i}
							<button
								class="dot"
								class:active={i === activeIndex}
								on:click={() => {
									selectEvent(i);
									if (autoplay) {
										stopAutoplay();
										startAutoplay();
									}
								}}
								aria-label="Event {i + 1}"
							></button>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<style>
	.carousel-wrapper {
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #212121;
		border: 2px solid #2a2a2a;
		border-radius: 12px;
		overflow: hidden;
	}

	.header {
		padding: 12px 16px;
		border-bottom: 1px solid #2a2a2a;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex-shrink: 0;
	}

	.title {
		color: white;
		font-size: 14px;
		font-weight: 700;
		margin: 0;
	}

	.count {
		color: #808080;
		font-size: 12px;
	}

	.content {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	/* Empty State */
	.empty-state {
		position: absolute;
		inset: 16px;
		border: 2px dashed #2a2a2a;
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.empty-state.dragging {
		border-color: #e1ff00;
		background: rgba(225, 255, 0, 0.05);
	}

	.empty-icon {
		width: 64px;
		height: 64px;
		color: #808080;
		margin-bottom: 12px;
		transition: color 0.2s;
	}

	.empty-icon.active {
		color: #e1ff00;
	}

	.empty-title {
		color: #808080;
		font-size: 14px;
		font-weight: 700;
		margin: 0 0 4px 0;
	}

	.empty-subtitle {
		color: #666;
		font-size: 12px;
		margin: 0;
	}

	/* Carousel Stage */
	.carousel-stage {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		perspective: 1400px;
		position: relative;
		cursor: grab;
		touch-action: pan-y;
		user-select: none;
		padding-top: 20px;
	}

	.carousel-stage.grabbing {
		cursor: grabbing;
	}

	.card {
		position: absolute;
		width: 200px;
		height: 280px;
		transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		transform-style: preserve-3d;
		will-change: transform, opacity;
	}

	.card.hidden {
		opacity: 0 !important;
		pointer-events: none;
		transform: translateX(-1000px) !important;
	}

	.card-button {
		width: 100%;
		height: 100%;
		position: relative;
		border: none;
		border-radius: 16px;
		overflow: hidden;
		cursor: pointer;
		background: #1a1a1a;
		padding: 0;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
		transition: all 0.3s ease;
	}

	.card-button:hover {
		box-shadow: 0 12px 48px rgba(0, 0, 0, 0.7);
	}

	.card-button.active:hover {
		transform: scale(1.02);
	}

	.badge {
		position: absolute;
		top: 12px;
		left: 12px;
		width: 36px;
		height: 36px;
		background: #e1ff00;
		color: #000;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		font-weight: 900;
		z-index: 10;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.flyer {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		pointer-events: none;
	}

	.placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(225, 255, 0, 0.15), rgba(225, 255, 0, 0.05));
	}

	.placeholder-icon {
		width: 72px;
		height: 72px;
		color: #e1ff00;
	}

	.ring {
		position: absolute;
		inset: 0;
		border: 3px solid #e1ff00;
		border-radius: 16px;
		pointer-events: none;
		background: rgba(225, 255, 0, 0.05);
		animation: pulse 2s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			box-shadow: 0 0 0 0 rgba(225, 255, 0, 0.4);
		}
		50% {
			box-shadow: 0 0 0 6px rgba(225, 255, 0, 0);
		}
	}

	.remove {
		position: absolute;
		top: 0;
		right: 0;
		width: 40px;
		height: 40px;
		background: #ef4444;
		border: none;
		border-bottom-left-radius: 12px;
		border-top-right-radius: 16px;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition:
			opacity 0.2s ease,
			background 0.2s ease;
		z-index: 20;
	}

	.remove svg {
		width: 20px;
		height: 20px;
	}

	.card:hover .remove {
		opacity: 1;
	}

	.remove:hover {
		background: #dc2626;
	}

	/* Navigation */
	.nav {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		width: 48px;
		height: 48px;
		background: rgba(33, 33, 33, 0.95);
		border: 2px solid #e1ff00;
		border-radius: 50%;
		color: #e1ff00;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		z-index: 200;
		backdrop-filter: blur(8px);
	}

	.nav svg {
		width: 24px;
		height: 24px;
	}

	.nav:hover {
		background: #e1ff00;
		color: #000;
		transform: translateY(-50%) scale(1.15);
		box-shadow: 0 0 20px rgba(225, 255, 0, 0.5);
	}

	.nav.prev {
		left: 20px;
	}

	.nav.next {
		right: 20px;
	}

	/* Dots */
	.dots {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 10px;
		background: rgba(33, 33, 33, 0.95);
		padding: 8px 16px;
		border-radius: 24px;
		backdrop-filter: blur(10px);
		z-index: 250;
		border: 1px solid rgba(225, 255, 0, 0.2);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		padding: 0;
		cursor: pointer;
		transition: all 0.3s;
	}

	.dot:hover {
		background: rgba(255, 255, 255, 0.6);
		transform: scale(1.2);
	}

	.dot.active {
		background: #e1ff00;
		width: 24px;
		border-radius: 4px;
	}

	.badge {
	position: absolute;
	top: 12px;
	left: 12px;
	width: 36px;
	height: 36px;
	background: #e1ff00;
	color: #000;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	font-weight: 900;
	z-index: 10;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* ADD THIS: Status Badge */
.status-badge {
	position: absolute;
	top: 12px;
	right: 12px;
	padding: 6px 12px;
	border-radius: 8px;
	color: #000;
	font-size: 10px;
	font-weight: 900;
	text-transform: uppercase;
	letter-spacing: 0.5px;
	z-index: 10;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	line-height: 1;
}

</style>
