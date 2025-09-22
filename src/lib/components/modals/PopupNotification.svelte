<script lang="ts">
	import { onDestroy } from 'svelte';

	// --- PROPS ---
	export let message: string = '';
	export let show: boolean = false;
	export let duration: number = 3000;
	export let variant: 'lime' | 'white' | 'navbar' | 'gray1' = 'white';
	export let iconType: 'success' | 'error' | 'warning' | 'info' | 'question' | 'login' = 'success';

	// --- STATE ---
	let timeoutId: NodeJS.Timeout | undefined;
	let isLeaving: boolean = false;

	// --- LOGIC ---

	// By defining the full class strings in this object, we ensure Tailwind's JIT compiler
	// detects and generates them.
	const typeStyles = {
		success: { text: 'text-lime', bg: 'bg-lime', border: 'border-lime' },
		login: { text: 'text-black', bg: 'bg-lime', border: 'border-lime' },
		error: { text: 'text-problem', bg: 'bg-problem', border: 'border-problem' },
		warning: { text: 'text-tentatif', bg: 'bg-tentatif', border: 'border-tentatif' },
		info: { text: 'text-info', bg: 'bg-info', border: 'border-info' },
		question: { text: 'text-question', bg: 'bg-question', border: 'border-question' }
	};

	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return {
			destroy() {
				if (document.body.contains(node)) {
					document.body.removeChild(node);
				}
			}
		};
	}

	// Gets styling classes based on the notification variant and icon type
	function getNotificationClasses(
		variant: 'lime' | 'white' | 'navbar' | 'gray1',
		iconType: 'login' | 'success' | 'error' | 'warning' | 'info' | 'question'
	) {
		const baseBgClass = {
			navbar: 'bg-navbar',
			gray1: 'bg-gray1',
			white: 'bg-transparent',
			lime: 'bg-lime'
		}[variant];

		const styles = typeStyles[iconType];

		return {
			container: `${baseBgClass} ${styles.border}`,
			icon: styles.bg,
			text: styles.text
		};
	}

	$: notificationClasses = getNotificationClasses(variant, iconType);

	$: if (show && duration > 0) {
		if (timeoutId) clearTimeout(timeoutId);
		isLeaving = false;
		timeoutId = setTimeout(() => {
			startLeaving();
		}, duration);
	}

	function startLeaving(): void {
		isLeaving = true;
		setTimeout(() => {
			show = false;
			isLeaving = false;
		}, 300);
	}

	onDestroy(() => {
		if (timeoutId) clearTimeout(timeoutId);
	});
</script>

{#if show}
	<div use:portal class="popup-notification {isLeaving ? 'slide-out' : 'slide-in'}">
		<div
			class="{notificationClasses.container} rounded-lg px-3 py-2 shadow-lg flex items-center border"
		>
			<div class="{notificationClasses.icon} rounded p-2 mr-3 flex-shrink-0">
				{#if iconType === 'success'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="3"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
					</svg>
				{:else if iconType === 'login'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
						/>
					</svg>
				{:else if iconType === 'error'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="3"
					>
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				{:else if iconType === 'warning'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
						/>
					</svg>
				{:else if iconType === 'info'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
						/>
					</svg>
				{:else if iconType === 'question'}
					<svg
						class="w-3 h-3 text-black"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						stroke-width="2"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008Z"
						/>
					</svg>
				{/if}
			</div>
			<div class="flex-1">
				<p class="{notificationClasses.text} font-bold text-sm">{message}</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.popup-notification {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 1000;
		min-width: 300px;
		max-width: 400px;
	}

	.slide-in {
		animation: slideIn 0.3s ease-out;
	}

	.slide-out {
		animation: slideOut 0.3s ease-in;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	@keyframes slideOut {
		from {
			transform: translateX(0);
			opacity: 1;
		}
		to {
			transform: translateX(100%);
			opacity: 0;
		}
	}
</style>