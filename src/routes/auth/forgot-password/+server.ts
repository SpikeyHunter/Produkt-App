// src/routes/api/auth/forgot-password/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { supabase } from '$lib/supabase.js';

const ALLOWED_EMAIL_DOMAINS = ['@produkt.ca', '@newcitygas.com'];

function validateEmail(email: string): boolean {
  return ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain));
}

export async function POST({ request, url }: RequestEvent) {
  console.log('🔄 Forgot password API called');
  
  try {
    const body = await request.json();
    const { email } = body;
    
    if (!email || typeof email !== 'string') {
      return json({ success: false, error: 'Email is required' }, { status: 400 });
    }
    
    const trimmedEmail = email.trim().toLowerCase();
    
    // Validate email domain
    if (!validateEmail(trimmedEmail)) {
      return json({ success: false, error: "You're not allowed to use this email domain" }, { status: 400 });
    }
    
    // REMOVED THE UNNECESSARY CHECK AGAINST 'user_profiles'
    // Let Supabase handle the user existence check internally.
    
    console.log('✅ Sending reset email request to Supabase for:', trimmedEmail);
    
    // Send password reset email
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${url.origin}/login/reset-password`
    });
    
    if (resetError) {
      // Don't expose specific errors to the client, but log them for debugging.
      console.error('💥 Password reset error:', resetError);
    }
    
    // ALWAYS return a success message to prevent email enumeration.
    // This is a critical security practice.
    console.log('✅ Request processed. Returning generic success message.');
    
    return json({ 
      success: true, 
      message: 'If an account exists for this email, a password reset link has been sent. Please check your inbox.' 
    });
    
  } catch (error) {
    console.error('💥 Unexpected forgot password error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    // Return a generic error in case of a server crash
    return json({ success: false, error: 'An unexpected error occurred: ' + errorMessage }, { status: 500 });
  }
}