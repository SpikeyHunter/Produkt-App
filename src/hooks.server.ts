// src/hooks.server.ts
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

// DEVELOPMENT: Set to true to disable all authentication checks
const DISABLE_AUTH_IN_DEV = false;

// Pages that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
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
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route));
  
  // For protected routes, let the client-side handle the detailed permission checks
  // This server hook is just for basic authentication, not authorization

  return resolve(event);
};