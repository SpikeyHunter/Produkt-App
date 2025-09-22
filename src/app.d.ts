// src/app.d.ts
import type { User } from '$lib/stores/auth';

declare global {
	namespace App {
		interface Locals {
			user?: {
				userId: string;
				email: string;
				firstName?: string;
				lastName?: string;
				role: string;
			};
		}
	}
}

// Declaration for the svelte-dnd-action library
declare module 'svelte-dnd-action' {
	export const dndzone: (
		node: HTMLElement,
		options: any
	) => {
		destroy: () => void;
	};
}

export {};