<script lang="ts">
	// $lib/components/booking/talentpayments/TalentPaymentSearch.svelte
	//
	// ⌘K / Ctrl+K spotlight for talent payments — ARTIST NAME ONLY.
	// Typing filters the grid behind it live (the parent owns `query`), and the
	// palette itself lists every match across ALL events so you can jump straight
	// to an artist even while the page is scoped to a single event.

	import { createEventDispatcher, tick } from 'svelte';
	import {
		normalizeStatus,
		statusPillClass,
		statusDotClass,
		formatCompactDate,
		formatMoney,
		highlightSegments,
		shortcutSymbol
	} from '$lib/components/booking/talentpayments/paymentStatus';

	export let open = false;
	/** Bound to the parent so the grid behind the overlay filters as you type. */
	export let query = '';
	/** Already ranked + filtered by the parent. */
	export let results: any[] = [];
	/** Total rows in the dataset, shown as a hint when the query is empty. */
	export let totalCount = 0;

	const MAX_VISIBLE = 60;
	const dispatch = createEventDispatcher();

	let inputEl: HTMLInputElement;
	let itemEls: HTMLButtonElement[] = [];
	let activeIndex = 0;

	$: visible = results.slice(0, MAX_VISIBLE);
	$: trimmed = query.trim();
	$: shortcut = shortcutSymbol();

	// Reset the cursor whenever the query or the result set changes.
	$: resetCursor(query, results);

	function resetCursor(_query: string, _results: any[]) {
		activeIndex = 0;
	}

	// Focus + select on open so a second ⌘K instantly retypes over the old query.
	$: if (open) focusInput();

	async function focusInput() {
		await tick();
		inputEl?.focus();
		inputEl?.select();
	}

	function close() {
		dispatch('close');
	}

	function selectAt(index: number) {
		const artist = visible[index];
		if (!artist) return;
		dispatch('select', artist);
	}

	async function move(delta: number) {
		if (visible.length === 0) return;
		activeIndex = (activeIndex + delta + visible.length) % visible.length;
		await tick();
		itemEls[activeIndex]?.scrollIntoView({ block: 'nearest' });
	}

	function handleKeydown(e: KeyboardEvent) {
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				e.preventDefault();
				move(-1);
				break;
			case 'Home':
				if (visible.length) {
					e.preventDefault();
					activeIndex = 0;
					tick().then(() => itemEls[0]?.scrollIntoView({ block: 'nearest' }));
				}
				break;
			case 'End':
				if (visible.length) {
					e.preventDefault();
					activeIndex = visible.length - 1;
					tick().then(() => itemEls[activeIndex]?.scrollIntoView({ block: 'nearest' }));
				}
				break;
			case 'Enter':
				e.preventDefault();
				selectAt(activeIndex);
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
		}
	}
</script>

{#if open}
	<div class="tp-search-layer">
		<!-- A real <button> rather than a div so there are no a11y warnings. -->
		<button class="tp-search-backdrop" aria-label="Close search" on:click={close}></button>

		<div class="tp-search-panel bg-navbar" role="dialog" aria-modal="true" aria-label="Search talent payments">
			<!-- Input -->
			<div class="tp-search-inputrow">
				<svg
					class="h-4 w-4 flex-shrink-0 text-lime"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					viewBox="0 0 24 24"
				>
					<circle cx="11" cy="11" r="7" />
					<path stroke-linecap="round" d="M20 20l-3.5-3.5" />
				</svg>

				<input
					bind:this={inputEl}
					bind:value={query}
					on:keydown={handleKeydown}
					class="tp-search-input"
					type="text"
					placeholder="Search artist…"
					autocomplete="off"
					spellcheck="false"
				/>

				{#if trimmed}
					<button
						class="tp-search-clear"
						title="Clear search"
						on:click={() => {
							query = '';
							inputEl?.focus();
						}}
					>
						Clear
					</button>
				{/if}

				<kbd class="tp-kbd">esc</kbd>
			</div>

			<!-- Results -->
			<div class="tp-search-results">
				{#if visible.length === 0}
					<div class="tp-search-empty">
						{#if trimmed}
							<p class="text-xs font-bold text-gray2">No artist named “{trimmed}”</p>
						{:else}
							<p class="text-xs font-bold text-gray2">
								Start typing an artist name — {totalCount} payments
							</p>
						{/if}
					</div>
				{:else}
					{#each visible as artist, i (artist.ui_id)}
						{@const status = normalizeStatus(artist?.paymentData?.status)}
						<button
							bind:this={itemEls[i]}
							class="tp-search-item {i === activeIndex ? 'is-active' : ''}"
							on:click={() => selectAt(i)}
							on:mouseenter={() => (activeIndex = i)}
						>
							<span class="tp-search-thumb">
								{#if artist.event_flyer}
									<img src={artist.event_flyer} alt="" loading="lazy" decoding="async" />
								{/if}
							</span>

							<span class="tp-search-main">
								<span class="tp-search-name">
									{#each highlightSegments(artist.artist_name, query) as seg}
										{#if seg.hit}<mark class="tp-hl">{seg.text}</mark>{:else}{seg.text}{/if}
									{/each}
								</span>
								<span class="tp-search-sub">{artist.eventNameDisplay || '—'}</span>
							</span>

							<span class="tp-search-date">{formatCompactDate(artist.eventDateDisplay)}</span>

							<span class={statusPillClass(status)}>
								<span class={statusDotClass(status)}></span>
								{status}
							</span>

							<span class="tp-search-amount text-lime">
								{formatMoney(artist?.paymentData?.amount ?? 150)}
							</span>
						</button>
					{/each}

					{#if results.length > MAX_VISIBLE}
						<p class="tp-search-more">
							Showing {MAX_VISIBLE} of {results.length} — keep typing to narrow it down
						</p>
					{/if}
				{/if}
			</div>

			<!-- Footer -->
			<div class="tp-search-footer">
				<span class="flex items-center gap-1.5">
					<kbd class="tp-kbd">↑</kbd><kbd class="tp-kbd">↓</kbd> navigate
				</span>
				<span class="flex items-center gap-1.5">
					<kbd class="tp-kbd">↵</kbd> open
				</span>
				<span class="flex items-center gap-1.5">
					<kbd class="tp-kbd">{shortcut}</kbd><kbd class="tp-kbd">K</kbd> toggle
				</span>
				<span class="ml-auto font-bold text-lime">
					{results.length}
					{results.length === 1 ? 'match' : 'matches'}
				</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.tp-search-layer {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: flex;
		justify-content: center;
		align-items: flex-start;
		padding: 12vh 16px 24px;
	}

	.tp-search-backdrop {
		position: absolute;
		inset: 0;
		border: 0;
		padding: 0;
		background: rgb(0 0 0 / 0.62);
		backdrop-filter: blur(3px);
		cursor: default;
		animation: tpFade 0.12s ease-out both;
	}

	.tp-search-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(680px, 100%);
		max-height: 62vh;
		overflow: hidden;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 16px;
		box-shadow: 0 24px 70px rgb(0 0 0 / 0.6);
		animation: tpPop 0.14s ease-out both;
	}

	@keyframes tpFade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes tpPop {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* -------------------------------------------------------------- input -- */

	.tp-search-inputrow {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-shrink: 0;
		padding: 12px 14px;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	.tp-search-input {
		flex: 1;
		min-width: 0;
		border: 0;
		background: transparent;
		color: #fff;
		font-size: 15px;
		font-weight: 600;
		letter-spacing: -0.01em;
		outline: none;
	}

	.tp-search-input::placeholder {
		color: rgb(255 255 255 / 0.32);
		font-weight: 500;
	}

	.tp-search-clear {
		flex-shrink: 0;
		border: 0;
		background: transparent;
		color: rgb(255 255 255 / 0.45);
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		cursor: pointer;
	}

	.tp-search-clear:hover {
		color: #fff;
	}

	.tp-kbd {
		flex-shrink: 0;
		padding: 2px 6px;
		border: 1px solid rgb(255 255 255 / 0.14);
		border-radius: 6px;
		background: rgb(255 255 255 / 0.05);
		color: rgb(255 255 255 / 0.5);
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		line-height: 1.4;
	}

	/* ------------------------------------------------------------ results -- */

	.tp-search-results {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 6px;
	}

	.tp-search-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 34px 12px;
		opacity: 0.65;
		text-align: center;
	}

	.tp-search-item {
		display: grid;
		grid-template-columns: 30px minmax(0, 1fr) 92px 138px 78px;
		align-items: center;
		gap: 10px;
		width: 100%;
		height: 48px;
		padding: 0 10px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		text-align: left;
		cursor: pointer;
		contain: layout paint;
	}

	.tp-search-item.is-active {
		border-color: rgb(198 255 0 / 0.55); /* lime */
		background: rgb(198 255 0 / 0.08);
	}

	.tp-search-thumb {
		position: relative;
		display: block;
		width: 30px;
		height: 30px;
		overflow: hidden;
		border-radius: 8px;
		background: rgb(255 255 255 / 0.06);
	}

	.tp-search-thumb img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.tp-search-main {
		display: flex;
		flex-direction: column;
		min-width: 0;
		gap: 1px;
	}

	.tp-search-name {
		overflow: hidden;
		color: #fff;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tp-search-sub {
		overflow: hidden;
		color: rgb(255 255 255 / 0.5);
		font-size: 11px;
		font-weight: 500;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tp-search-date {
		color: rgb(255 255 255 / 0.65);
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
	}

	.tp-search-amount {
		font-size: 13px;
		font-weight: 700;
		text-align: right;
		white-space: nowrap;
	}

	.tp-search-more {
		padding: 8px 12px 4px;
		color: rgb(255 255 255 / 0.35);
		font-size: 10px;
		font-weight: 700;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	/* Highlight token — lime, never the browser's yellow. */
	.tp-hl {
		border-radius: 3px;
		padding: 0 1px;
		background: rgb(198 255 0 / 0.26);
		color: inherit;
	}

	/* ------------------------------------------------------------- footer -- */

	.tp-search-footer {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-shrink: 0;
		padding: 8px 14px;
		border-top: 1px solid rgb(255 255 255 / 0.08);
		color: rgb(255 255 255 / 0.4);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	@media (max-width: 900px) {
		.tp-search-item {
			grid-template-columns: 30px minmax(0, 1fr) 78px 118px 70px;
			gap: 8px;
		}
	}
</style>