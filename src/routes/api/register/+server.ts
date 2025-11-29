// src/routes/api/register/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase.js';
import { ADMIN_REGISTRATION_CODE, USER_REGISTRATION_CODE, SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';

// Create admin client with service role key for bypassing RLS
const supabaseAdmin = createClient(
  PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const REGISTRATION_CODES = {
  [ADMIN_REGISTRATION_CODE]: 'Admin',
  [USER_REGISTRATION_CODE]: 'User'
};

const ALLOWED_EMAIL_DOMAINS = ['@produkt.ca', '@newcitygas.com', '@hqaudio.ca', '@onedot.ca', '@icloud.com'];

function validateName(name: string): boolean {
  if (name.length < 2) return false;
  if (/\d/.test(name)) return false;
  return true;
}

function validateEmail(email: string): boolean {
  return ALLOWED_EMAIL_DOMAINS.some(domain => email.endsWith(domain));
}

function validatePassword(password: string): boolean {
  return password.length >= 8;
}

function validateRegistrationCode(code: string): boolean {
  return REGISTRATION_CODES.hasOwnProperty(code);
}

interface RegistrationRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  registrationCode: string;
}

export async function POST({ request, url }: RequestEvent) {
  console.log('🚀 Registration API called');
  
  try {
    const body: RegistrationRequest = await request.json();
    console.log('📝 Registration attempt for:', body.email);
    
    const { firstName, lastName, email, password, confirmPassword, registrationCode } = body;
    const errors: string[] = [];
    
    // Validate all fields
    if (!validateName(firstName)) {
      errors.push("First name must be at least 2 characters and contain no digits");
    }
    
    if (!validateName(lastName)) {
      errors.push("Last name must be at least 2 characters and contain no digits");
    }
    
    if (!validateEmail(email)) {
      errors.push("You're not allowed to register using this email");
    }
    
    if (!validatePassword(password)) {
      errors.push("Password must contain at least 8 characters");
    }
    
    if (password !== confirmPassword) {
      errors.push("Password not matching");
    }
    
    if (!validateRegistrationCode(registrationCode)) {
      errors.push("Invalid registration code");
    }
    
    // If there are validation errors, return them
    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return json({ success: false, errors }, { status: 400 });
    }
    
    // Get the role for the registration code
    const userRole = REGISTRATION_CODES[registrationCode];
    console.log('✅ User role determined:', userRole);
    
    // Check if user already exists in our profiles table
    console.log('🔍 Checking if user already exists...');
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();
    
    if (existingProfile) {
      console.log('❌ User profile already exists:', existingProfile.email);
      return json({ 
        success: false, 
        errors: ["An account with this email already exists"] 
      }, { status: 400 });
    }
    
    // Create user with Supabase Auth
    console.log('👤 Creating user with Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password: password,
      options: {
        emailRedirectTo: `${url.origin}/auth/verify`,
        data: {
          first_name: firstName,
          last_name: lastName,
          role: userRole
        }
      }
    });
    
    if (authError) {
      console.error('💥 Supabase Auth error:', authError);
      
      // Handle specific Supabase Auth errors
      if (authError.message.includes('User already registered')) {
        return json({ 
          success: false, 
          errors: ["An account with this email already exists"] 
        }, { status: 400 });
      }
      
      // Check if it's an email configuration error
      if (authError.message.includes('confirmation email') || 
          authError.message.includes('email') || 
          authError.message.includes('SMTP')) {
        console.warn('⚠️ Email sending failed, but continuing with registration');
        // Don't fail the registration - continue to create the profile
      } else {
        return json({ 
          success: false, 
          errors: [`Registration failed: ${authError.message}`] 
        }, { status: 500 });
      }
    }
    
    if (!authData.user) {
      return json({ 
        success: false, 
        errors: ["Failed to create user account"] 
      }, { status: 500 });
    }
    
    console.log('✅ Supabase Auth user created:', authData.user.id);
    
    // Insert user profile data into user_profiles table
    console.log('💾 Inserting user profile data...');
    const { error: insertError } = await supabaseAdmin
      .from('user_profiles')
      .insert([
        {
          id: authData.user.id,
          email: email.toLowerCase(),
          first_name: firstName,
          last_name: lastName,
          role: userRole
        }
      ]);
    
    if (insertError) {
      console.error('💥 Profile insert error:', insertError);
      
      // If profile creation fails, try to clean up the auth user
      try {
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError);
      }
      
      return json({ 
        success: false, 
        errors: [`Profile creation failed: ${insertError.message}`] 
      }, { status: 500 });
    }
    
    console.log('✅ User profile created successfully');
    
    // Check email confirmation requirement
    const requiresEmailConfirmation = !authData.session;
    
    if (requiresEmailConfirmation) {
      console.log('📧 Email confirmation required');
      return json({ 
        success: true, 
        message: "Registration successful! Please check your email to verify your account. If you don't receive an email within a few minutes, contact an administrator.",
        requiresEmailConfirmation: true
      });
    } else {
      console.log('✅ Auto-confirmed - no email verification needed');
      return json({ 
        success: true, 
        message: "Registration successful! You can now log in.",
        requiresEmailConfirmation: false
      });
    }
    
  } catch (error: unknown) {
    console.error('💥 Unexpected registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return json({ 
      success: false, 
      errors: ["An unexpected error occurred: " + errorMessage] 
    }, { status: 500 });
  }
}