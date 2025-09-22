<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	
	export let variant: 'default' | 'icon' | 'text' = 'default';
	export let copyText: string = '';
	export let copyHtml: string = '';
	export let label: string = 'Copy to clipboard';
	export let successMessage: string = 'Copied!';
	
	const dispatch = createEventDispatcher();
	
	let copied = false;
	let copyTimeout: ReturnType<typeof setTimeout>;
	
	async function handleCopy() {
		try {
			// If HTML is provided, copy both HTML and plain text
			if (copyHtml) {
				const clipboardItem = new ClipboardItem({
					'text/html': new Blob([copyHtml], { type: 'text/html' }),
					'text/plain': new Blob([copyText], { type: 'text/plain' })
				});
				await navigator.clipboard.write([clipboardItem]);
			} else {
				// Fallback to plain text only
				await navigator.clipboard.writeText(copyText);
			}
			
			copied = true;
			dispatch('copy', { text: copyText, html: copyHtml });
			
			// Reset after 2 seconds
			clearTimeout(copyTimeout);
			copyTimeout = setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (err) {
			console.error('Failed to copy:', err);
			// Fallback to plain text if HTML copy fails
			try {
				await navigator.clipboard.writeText(copyText);
				copied = true;
				dispatch('copy', { text: copyText });
				
				clearTimeout(copyTimeout);
				copyTimeout = setTimeout(() => {
					copied = false;
				}, 2000);
			} catch (fallbackErr) {
				console.error('Fallback copy also failed:', fallbackErr);
				dispatch('error', { error: fallbackErr });
			}
		}
	}
</script>

<button
	on:click={handleCopy}
	class="clipboard-button {variant} {copied ? 'copied' : ''}"
	aria-label={label}
	title={copied ? successMessage : label}
>
	{#if variant === 'icon' || variant === 'default'}
		<svg
			class="icon"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			{#if copied}
				<path d="M20 6L9 17l-5-5" />
			{:else}
				<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
				<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
			{/if}
		</svg>
	{/if}
	
	{#if variant === 'default' || variant === 'text'}
		<span class="label">{copied ? successMessage : label}</span>
	{/if}
</button>

<style>
	.clipboard-button {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		background: transparent;
		color: var(--color-lime);
		border: 1px solid var(--color-lime);
		border-radius: 24px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.clipboard-button:hover:not(.copied) {
		background: var(--color-lime);
		color: var(--color-black);
		transform: translateY(-1px);
	}
	
	.clipboard-button.copied {
		background: var(--color-gray2);
		color: var(--color-black);
		border-color: var(--color-gray2);
	}
	
	.clipboard-button.icon {
		padding: 8px;
	}
	
	.clipboard-button.text {
		padding: 8px 12px;
	}
	
	.icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	
	.label {
		white-space: nowrap;
	}
	
	.clipboard-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.clipboard-button:disabled:hover {
		background: var(--color-gray2);
		transform: none;
	}
</style>