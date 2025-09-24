<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { supabase } from '$lib/supabase';
	import { user } from '$lib/stores/userStore';
	import '../app.css';

	const PROTECTED_ROUTES = [
		'/dashboard',
		'/advancing',
		'/booking',
		'/production',
		'/marketing',
		'/settings'
	];
	const PUBLIC_ONLY_ROUTES = ['/', '/login', '/login/register', '/login/forgot-password'];

	onMount(() => {
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((event, session) => {
			// Set the user in our store
			user.set(session?.user ?? null);

			console.log(`Supabase auth event: ${event}`);

			const currentPath = $page.url.pathname;
			const userIsLoggedIn = !!session?.user;

			if (!userIsLoggedIn && PROTECTED_ROUTES.some((route) => currentPath.startsWith(route))) {
				goto('/');
				return;
			}

			if (userIsLoggedIn && PUBLIC_ONLY_ROUTES.includes(currentPath)) {
				goto('/dashboard');
				return;
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<!-- Favicons for Safari / Browsers -->
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-transparent.png" />
	<link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />

	<!-- Apple Touch Icon (for iOS home screen) -->
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

	<!-- Pinned tab (Safari) -->
	<link rel="mask-icon" href="/favicon.svg" color="#E1FF00" />

	<!-- Manifest for PWA -->
	<link rel="manifest" href="/site.webmanifest" />
</svelte:head>

<slot />
