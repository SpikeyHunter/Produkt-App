<script lang="ts">
	import { createEventDispatcher, tick } from 'svelte';
	import { portal } from '$lib/utils/portalUtils';

	export let show: boolean = false;
	/** Venue-derived default, e.g. "Main Room - Adventure Club" */
	export let suggestedTitle: string = '';
	export let eventName: string = '';
	export let eventDate: string = '';
	export let isGenerating: boolean = false;

	const dispatch = createEventDispatcher();

	let value = '';
	let inputEl: HTMLInputElement;
	let wasOpen = false;

	// Re-seed the field with the suggestion every time the modal opens
	$: if (show && !wasOpen) {
		wasOpen = true;
		value = suggestedTitle;
		tick().then(() => {
			inputEl?.focus();
			inputEl?.select();
		});
	} else if (!show && wasOpen) {
		wasOpen = false;
	}

	$: isCustom = value.trim() !== suggestedTitle.trim();
	$: canConfirm = value.trim().length > 0 && !isGenerating;

	function confirm() {
		if (!canConfirm) return;
		dispatch('confirm', { title: value.trim() });
	}

	function cancel() {
		if (isGenerating) return;
		dispatch('cancel');
	}

	function resetToSuggested() {
		value = suggestedTitle;
		inputEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			cancel();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			confirm();
		}
	}

	function formatDate(dateString: string): string {
		if (!dateString) return '';
		try {
			const d = new Date(dateString);
			d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
			return d.toLocaleDateString('en-US', {
				weekday: 'long',
				month: 'long',
				day: 'numeric'
			});
		} catch (e) {
			return dateString;
		}
	}
</script>

<svelte:window on:keydown={show ? handleKeydown : undefined} />

{#if show}
	<!-- Backdrop — portalled to <body> so it always centers on the viewport -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
		role="presentation"
		on:click|self={cancel}
	>
		<div
			class="w-full max-w-md bg-navbar rounded-2xl shadow-2xl border border-white/10 overflow-hidden"
			role="dialog"
			aria-modal="true"
			aria-label="Set Times PDF title"
		>
			<!-- Header -->
			<div class="px-5 pt-5 pb-4 border-b border-white/10">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<h2 class="text-white text-base font-bold leading-tight">Set Times title</h2>
						<p class="text-gray2 text-xs mt-1 truncate">
							{eventName}{eventDate ? ` — ${formatDate(eventDate)}` : ''}
						</p>
					</div>
					<button
						on:click={cancel}
						class="p-1.5 rounded-lg text-gray2 hover:text-black hover:bg-lime transition-all duration-200 flex-shrink-0"
						aria-label="Close"
						disabled={isGenerating}
					>
						<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Body -->
			<div class="px-5 py-5 space-y-4">
				<div>
					<div class="flex items-center justify-between mb-2">
						<span class="text-gray2 text-[11px] font-bold uppercase tracking-wider">Suggested</span>
						{#if isCustom}
							<button
								on:click={resetToSuggested}
								class="text-[11px] font-bold text-lime hover:underline"
							>
								Reset
							</button>
						{/if}
					</div>
					<div class="bg-gray1 rounded-lg px-3 py-2 text-sm text-white/70 truncate">
						{suggestedTitle || '—'}
					</div>
				</div>

				<div>
					<label
						for="set-times-title-input"
						class="block text-gray2 text-[11px] font-bold uppercase tracking-wider mb-2"
					>
						Title on the PDF
					</label>
					<input
						id="set-times-title-input"
						bind:this={inputEl}
						bind:value
						type="text"
						placeholder="Main Room - Artist"
						disabled={isGenerating}
						class="w-full bg-gray1 text-white text-sm rounded-lg px-3 py-2.5 border border-white/10 focus:border-lime focus:outline-none transition-colors duration-200 placeholder:text-gray2/60"
					/>
					<p class="text-gray2 text-[11px] mt-2">
						{isCustom
							? 'Custom title — this will be printed above the set times.'
							: 'Hit Download to use the suggested title, or edit it above.'}
					</p>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-5 pb-5 flex items-center justify-end gap-2">
				<button
					on:click={cancel}
					disabled={isGenerating}
					class="px-4 py-2 rounded-lg text-sm font-bold text-gray2 hover:text-white transition-colors duration-200 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					on:click={confirm}
					disabled={!canConfirm}
					class="px-4 py-2 rounded-lg text-sm font-bold bg-lime text-black hover:opacity-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
				>
					{#if isGenerating}
						<svg class="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Generating…
					{:else}
						Download
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}