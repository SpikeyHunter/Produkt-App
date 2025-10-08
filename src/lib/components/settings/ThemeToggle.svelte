<script lang="ts">
	import { themeStore } from '$lib/stores/themeStore';
	import { authStore } from '$lib/stores/authStore';

	export let isNavExpanded = true;

	$: isDark = $themeStore.current === 'dark';

	async function toggleTheme() {
		// Toggle the theme in the store
		themeStore.toggle();

		// Update the database if user is logged in
		if ($authStore.profile) {
			const newTheme = isDark ? 'light' : 'dark';
			
			// Use the authStore's updateSettings method
			await authStore.updateSettings({
				...($authStore.profile.user_settings || {}),
				theme: newTheme
			});
		}
	}
</script>

<button
	type="button"
	class="theme-toggle-btn"
	class:collapsed={!isNavExpanded}
	on:click={toggleTheme}
	aria-label="Toggle theme"
	title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
>
	<span class="icon">
		{#if isDark}
			<!-- Moon icon (Dark mode) -->
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
				<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
			</svg>
		{:else}
			<!-- Sun icon (Light mode) -->
			<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="5" />
				<line x1="12" y1="1" x2="12" y2="3" />
				<line x1="12" y1="21" x2="12" y2="23" />
				<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
				<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
				<line x1="1" y1="12" x2="3" y2="12" />
				<line x1="21" y1="12" x2="23" y2="12" />
				<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
				<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
			</svg>
		{/if}
	</span>
	<span class="label">{isDark ? 'Dark Mode' : 'Light Mode'}</span>
</button>

<style>
	.theme-toggle-btn {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.75rem 1rem;
		border-radius: 0.75rem;
		text-align: left;
		font-weight: 700;
		font-size: 1rem;
		color: var(--text-secondary);
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		cursor: pointer;
	}

	.theme-toggle-btn.collapsed {
		justify-content: center;
	}

	.theme-toggle-btn:hover {
		background-color: var(--hover-bg);
		color: var(--text-primary);
	}

	.icon {
		flex-shrink: 0;
		margin-right: 1rem;
		transition: margin-right var(--transition-duration) var(--transition-easing);
	}

	.theme-toggle-btn.collapsed .icon {
		margin-right: 0;
	}

	.label {
		white-space: nowrap;
		opacity: 1;
		transition: opacity var(--transition-duration) var(--transition-easing);
		width: auto;
	}

	.theme-toggle-btn.collapsed .label {
		opacity: 0;
		width: 0;
		pointer-events: none;
	}
</style>