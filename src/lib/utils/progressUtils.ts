// src/lib/utils/progressUtils.ts
import type { EventAdvance } from '$lib/services/eventsService';
import { fetchEventById } from '$lib/services/eventsService';

// Only these 5 fields count towards progress - shared constant
export const PROGRESS_FIELDS = [
  'contract',
  'immigration_sent',
  'letter_received',
  'letter_sent',
  'role_list'
] as const;

/**
 * Calculate progress percentage based on 5 specific fields only
 * NULL = excluded from calculation
 * true = completed task
 * false = pending task
 */
export function calculateDynamicProgress(eventData: EventAdvance | any): number {
  if (!eventData) return 0;
  
  // Filter out NULL values - only count fields that are either true or false
  const activeFields = PROGRESS_FIELDS.filter(field => eventData[field] !== null);
  const totalFields = activeFields.length;
  
  // If no active fields, return 0
  if (totalFields === 0) return 0;
  
  // Count only the true values among active fields
  const completedFields = activeFields.filter(field => eventData[field] === true).length;
  
  const percentage = Math.round((completedFields / totalFields) * 100);
  
  console.log('📊 Progress calculation:', {
    activeFields: activeFields.map(field => ({ field, value: eventData[field] })),
    completed: completedFields,
    total: totalFields,
    percentage
  });
  
  return percentage;
}

/**
 * Check if specific columns have changed in the database
 */
export async function checkColumnStateChanges(
  eventId: string, 
  artistName: string, 
  columns: string[]
): Promise<{ [key: string]: boolean | null }> {
  try {
    console.log('🔍 Checking DB state for columns:', columns);
    
    // Fetch fresh data from database using existing service
    const freshEventData = await fetchEventById(`${eventId}-${artistName}`);
    
    if (!freshEventData) {
      throw new Error('Event not found');
    }
    
    // Extract only the requested columns with proper typing
    const columnStates: { [key: string]: boolean | null } = {};
    columns.forEach(column => {
      columnStates[column] = (freshEventData as any)[column];
    });
    
    console.log('✅ Fresh column states:', columnStates);
    return columnStates;
    
  } catch (error) {
    console.error('❌ Error checking column states:', error);
    throw error;
  }
}

/**
 * Refresh event data from database and return updated event
 */
export async function refreshEventData(
  eventId: string, 
  artistName: string
): Promise<EventAdvance> {
  try {
    console.log('🔄 Refreshing event data from database...');
    
    // Use existing service to fetch fresh data
    const freshEventData = await fetchEventById(`${eventId}-${artistName}`);
    
    if (!freshEventData) {
      throw new Error('Event not found');
    }
    
    console.log('✅ Event data refreshed successfully');
    return freshEventData;
    
  } catch (error) {
    console.error('❌ Error refreshing event data:', error);
    throw error;
  }
}

/**
 * Get progress details for debugging/display
 */
export function getProgressDetails(eventData: EventAdvance | any): {
  completed: number;
  total: number;
  percentage: number;
  activeFields: string[];
  excludedFields: string[];
} {
  const activeFields = PROGRESS_FIELDS.filter(field => eventData[field] !== null);
  const excludedFields = PROGRESS_FIELDS.filter(field => eventData[field] === null);
  const completedFields = activeFields.filter(field => eventData[field] === true);
  
  return {
    completed: completedFields.length,
    total: activeFields.length,
    percentage: activeFields.length > 0 ? Math.round((completedFields.length / activeFields.length) * 100) : 0,
    activeFields,
    excludedFields
  };
}