// src/lib/stores/themeStore.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark';

interface ThemeStore {
	current: Theme;
	isInitialized: boolean;
}

function createThemeStore() {
	const { subscribe, set, update } = writable<ThemeStore>({
		current: 'dark',
		isInitialized: false
	});

	return {
		subscribe,
		
		/**
		 * Initialize theme from user settings
		 */
		initialize: (userSettings?: { theme?: Theme }) => {
			if (!browser) return;
			
			const theme = userSettings?.theme || 'dark';
			document.documentElement.setAttribute('data-theme', theme);
			
			update(state => ({
				current: theme,
				isInitialized: true
			}));
		},
		
		/**
		 * Toggle between light and dark theme
		 */
		toggle: () => {
			if (!browser) return;
			
			update(state => {
				const newTheme: Theme = state.current === 'dark' ? 'light' : 'dark';
				document.documentElement.setAttribute('data-theme', newTheme);
				return {
					...state,
					current: newTheme
				};
			});
		},
		
		/**
		 * Set a specific theme
		 */
		setTheme: (theme: Theme) => {
			if (!browser) return;
			
			document.documentElement.setAttribute('data-theme', theme);
			update(state => ({
				...state,
				current: theme
			}));
		}
	};
}

export const themeStore = createThemeStore();