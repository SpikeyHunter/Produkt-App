// src/hooks.server.ts
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

// DEVELOPMENT: Set to true to disable all authentication checks
const DISABLE_AUTH_IN_DEV = false;

// Pages that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login/register',
  '/login/forgot-password',
  '/auth/verify',
  '/auth/callback'
];

export const handle: Handle = async ({ event, resolve }) => {
  const { url } = event;
  const pathname = url.pathname;

  // DEVELOPMENT: Skip all authentication if disabled
  if (dev && DISABLE_AUTH_IN_DEV) {
    console.log('🔧 DEV MODE: Authentication checks disabled');
    return resolve(event);
  }

  // Allow all API routes to pass through - auth will be handled per-route
  if (pathname.startsWith('/api/')) {
    return resolve(event);
  }

  // For pure client-side auth, we only need basic route protection
  // The real auth checking happens on the client with Supabase
  
  // Check if route requires authentication
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  
  // For protected routes, redirect to login if needed
  // The client will handle the actual auth check
  if (!isPublicRoute && pathname !== '/') {
    // Let the client-side auth handle this
    // We'll redirect in the layout if not authenticated
  }

  return resolve(event);
};