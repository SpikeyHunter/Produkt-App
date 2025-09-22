// src/lib/types/database.ts

// Import shared event interfaces
export type { EventAdvanceBase, EventAdvance, Event, Person, ApiResponse } from './events.js';

export interface UserProfile {
  id: string; // UUID from Supabase auth
  email: string;
  first_name: string;
  last_name: string;
  role: 'user' | 'admin' | 'super_admin' | 'advance' | 'booking' | 'marketing' | 'production';
  main_permission?: string | null;
  secondary_permission: string[];
  created_at: string;
  updated_at: string;
}

// For your auth store
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserProfile['role'];
  mainPermission?: string;
  secondaryPermissions: string[];
}

// Import EventAdvance type for the interface below
import type { EventAdvance } from './events.js';

// Combined interface for your UI components (re-exported from events.ts)
export interface EventAdvanceWithDetails extends EventAdvance {
  // Additional computed fields
  displayName: string;
}

// Permission checking helpers
export type Permission = 
  | 'advance' 
  | 'booking' 
  | 'marketing' 
  | 'production' 
  | 'admin' 
  | 'super_admin';

export interface PermissionConfig {
  read: Permission[];
  write: Permission[];
  delete: Permission[];
}