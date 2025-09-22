// src/lib/utils/uploadUtils.ts
import { updateEventAdvance } from '$lib/services/eventsService';
import type { EventAdvance } from '$lib/services/eventsService';

/**
 * Upload status management utilities
 */
export interface UploadResult {
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  error?: string;
}

/**
 * Validates file before upload
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File is too large. Maximum size is 10MB.' };
  }

  // Check file type
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only PDF and image files are allowed.' };
  }

  return { valid: true };
}

/**
 * Clean filename for storage (remove special characters)
 */
export function cleanFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*]/g, '_');
}

/**
 * Extract filename from URL for display
 */
export function extractFileNameFromUrl(url: string): string {
  if (!url) return '';
  
  try {
    const parts = url.split('/');
    const fileName = parts[parts.length - 1];
    const decodedFileName = decodeURIComponent(fileName);
    
    // Remove file extension for display
    const cleanName = decodedFileName.replace(/\.[^.]+$/, '');
    
    return cleanName || decodedFileName;
  } catch (error) {
    console.error('Error extracting filename:', error);
    return 'Unknown File';
  }
}

/**
 * Update event advance status after successful upload
 */
export async function updateUploadStatus(
  event: EventAdvance,
  fileUrl: string,
  urlColumn: string = 'contract_url',
  statusColumn: string = 'contract'
): Promise<EventAdvance> {
  try {
    console.log('📝 Updating upload status in database...');
    
    const updates = {
      [urlColumn]: fileUrl,
      [statusColumn]: true
    };

    await updateEventAdvance(event.event_id, event.artist_name, updates);

    // Update local event object
    const updatedEvent = {
      ...event,
      [urlColumn]: fileUrl,
      [statusColumn]: true
    };

    console.log('✅ Upload status updated successfully');
    return updatedEvent;
  } catch (error) {
    console.error('❌ Error updating upload status:', error);
    throw error;
  }
}

/**
 * Update event advance status after successful deletion
 */
export async function updateDeleteStatus(
  event: EventAdvance,
  urlColumn: string = 'contract_url',
  statusColumn: string = 'contract'
): Promise<EventAdvance> {
  try {
    console.log('📝 Updating delete status in database...');
    
    const updates = {
      [urlColumn]: null,
      [statusColumn]: false
    };

    await updateEventAdvance(event.event_id, event.artist_name, updates);

    // Update local event object
    const updatedEvent = {
      ...event,
      [urlColumn]: null,
      [statusColumn]: false
    };

    console.log('✅ Delete status updated successfully');
    return updatedEvent;
  } catch (error) {
    console.error('❌ Error updating delete status:', error);
    throw error;
  }
}

/**
 * Handle API errors with user-friendly messages
 */
export function handleApiError(error: any): string {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('401') || message.includes('unauthorized')) {
      return 'Authentication failed. Please refresh and try again.';
    } else if (message.includes('403') || message.includes('forbidden')) {
      return 'Permission denied. Please contact support.';
    } else if (message.includes('413') || message.includes('too large')) {
      return 'File is too large. Please choose a smaller file.';
    } else if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    } else if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Generate file path for storage
 */
export function generateStoragePath(
  fileName: string,
  storageFolder: string = 'contracts'
): string {
  const cleanName = cleanFileName(fileName);
  return `${storageFolder}/${cleanName}`;
}

/**
 * Check if file URL is valid and accessible
 */
export async function validateFileUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}