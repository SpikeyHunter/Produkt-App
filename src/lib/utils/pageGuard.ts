// src/lib/utils/pageGuard.ts
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/authStore';

/**
 * Protects a page by checking if the user has the required permission.
 * Redirects to login if not authenticated, or to dashboard if no permission.
 * 
 * @param requiredPermission - The permission required to access the page
 * @returns Empty object if access is granted
 * @throws Redirect to /login or /dashboard if access is denied
 */
export async function requirePagePermission(requiredPermission: string) {
	if (!browser) return {};

	// Wait for auth to initialize
	let attempts = 0;
	while (!get(authStore).isInitialized && attempts < 10) {
		await new Promise(resolve => setTimeout(resolve, 100));
		attempts++;
	}
	
	const auth = get(authStore);
	const profile = auth.profile;
	
	// Not logged in -> redirect to login
	if (!profile) {
		throw redirect(303, '/login');
	}
	
	// Admins always have access
	if (profile.role === 'Admin') {
		return {};
	}
	
	// Check all permissions (main, secondary, and page permissions)
	const allPermissions = [
		profile.main_permission,
		...(Array.isArray(profile.secondary_permission) ? profile.secondary_permission : []),
		...(Array.isArray(profile.page_permissions) ? profile.page_permissions : [])
	].filter(Boolean);
	
	// No permission -> redirect to dashboard
	if (!allPermissions.includes(requiredPermission)) {
		throw redirect(303, '/dashboard');
	}
	
	return {};
}

/**
 * Protects a page by checking if the user has ANY of the required permissions.
 * Useful for pages that can be accessed by multiple permission types.
 * 
 * @param requiredPermissions - Array of permissions, user needs at least one
 * @returns Empty object if access is granted
 * @throws Redirect to /login or /dashboard if access is denied
 */
export async function requireAnyPermission(requiredPermissions: string[]) {
	if (!browser) return {};

	// Wait for auth to initialize
	let attempts = 0;
	while (!get(authStore).isInitialized && attempts < 10) {
		await new Promise(resolve => setTimeout(resolve, 100));
		attempts++;
	}
	
	const auth = get(authStore);
	const profile = auth.profile;
	
	// Not logged in -> redirect to login
	if (!profile) {
		throw redirect(303, '/login');
	}
	
	// Admins always have access
	if (profile.role === 'Admin') {
		return {};
	}
	
	// Check all permissions
	const allPermissions = [
		profile.main_permission,
		...(Array.isArray(profile.secondary_permission) ? profile.secondary_permission : []),
		...(Array.isArray(profile.page_permissions) ? profile.page_permissions : [])
	].filter(Boolean);
	
	// Check if user has at least one required permission
	const hasAccess = requiredPermissions.some(perm => allPermissions.includes(perm));
	
	if (!hasAccess) {
		throw redirect(303, '/dashboard');
	}
	
	return {};
}