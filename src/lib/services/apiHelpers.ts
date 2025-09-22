// src/lib/services/apiHelpers.ts
import { supabase } from '$lib/supabase.js';
import { browser } from '$app/environment';

/**
 * Get current authenticated user from Supabase
 */
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Get user profile with role information
 */
export async function getUserProfile(userId: string) {
  try {
    const { data: userProfile, error } = await supabase
      .from('user_profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', userId)
      .single();

    if (error || !userProfile) {
      throw new Error('User profile not found');
    }

    return {
      id: userProfile.id,
      email: userProfile.email,
      firstName: userProfile.first_name || '',
      lastName: userProfile.last_name || '',
      role: userProfile.role
    };
  } catch (error) {
    console.error('Error getting user profile:', error);
    throw error;
  }
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  return requiredRoles.includes(userRole);
}

/**
 * Make authenticated API request to your custom endpoints
 */
export async function makeAuthenticatedRequest(
  url: string, 
  options: RequestInit = {}
): Promise<Response> {
  if (!browser) {
    throw new Error('This function can only be used in the browser');
  }

  // Get current session
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session?.access_token) {
    throw new Error('Not authenticated');
  }

  // Add authorization header
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Content-Type', 'application/json');

  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Upload file with authentication
 */
export async function uploadFile(
  file: File,
  filePath: string,
  eventId: string,
  artistName: string,
  bucket: string = 'documents'
): Promise<{ success: boolean; publicUrl?: string; error?: string }> {
  try {
    if (!browser) {
      throw new Error('File upload only available in browser');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.access_token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('filePath', filePath);
    formData.append('bucket', bucket);
    formData.append('eventId', eventId);
    formData.append('artistName', artistName);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Upload failed');
    }

    return {
      success: true,
      publicUrl: result.publicUrl
    };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}