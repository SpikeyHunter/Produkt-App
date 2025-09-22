// src/lib/utils/roleUtils.ts

// Import shared Person interface
export type { Person } from '$lib/types/events.js';
import type { Person } from '$lib/types/events.js';

/**
 * Parse roles JSON string into Person array
 */
export function parseRoles(rolesJson: string | null | undefined): Person[] {
  if (!rolesJson) return [];
  
  try {
    const parsed = JSON.parse(rolesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((person: any) => ({
      ...person,
      id: person.id || Math.random().toString(36).substr(2, 9),
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      role: person.role || ''
    }));
  } catch (error) {
    console.error('Error parsing roles:', error);
    return [];
  }
}

/**
 * Convert Person array to JSON string for storage
 */
export function stringifyRoles(people: Person[]): string {
  try {
    const validPeople = people.filter(person => 
      person.firstName.trim() && person.lastName.trim()
    );
    return JSON.stringify(validPeople);
  } catch (error) {
    console.error('Error stringifying roles:', error);
    return '[]';
  }
}

/**
 * Get full name of a person
 */
export function getPersonFullName(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/**
 * Get display name with role
 */
export function getPersonDisplayName(person: Person): string {
  const fullName = getPersonFullName(person);
  const role = person.role.trim();
  
  if (fullName && role) {
    return `${fullName} (${role})`;
  }
  
  return fullName || 'Unnamed Person';
}

/**
 * Get people by role
 */
export function getPeopleByRole(people: Person[], role: string): Person[] {
  return people.filter(person => 
    person.role.toLowerCase() === role.toLowerCase()
  );
}

/**
 * Get all unique roles
 */
export function getUniqueRoles(people: Person[]): string[] {
  const roles = people
    .map(person => person.role.trim())
    .filter(role => role);
  
  return [...new Set(roles)].sort();
}

/**
 * Count people by role
 */
export function countPeopleByRole(people: Person[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  people.forEach(person => {
    const role = person.role.trim();
    if (role) {
      counts[role] = (counts[role] || 0) + 1;
    }
  });
  
  return counts;
}

/**
 * Format role list for display (e.g., "John Doe, Jane Smith (2 people)")
 */
export function formatRoleList(people: Person[], maxDisplay: number = 3): string {
  if (people.length === 0) return 'No team members';
  
  const names = people
    .map(person => getPersonFullName(person))
    .filter(name => name);
  
  if (names.length === 0) return 'No team members';
  
  if (names.length <= maxDisplay) {
    return names.join(', ');
  }
  
  const displayed = names.slice(0, maxDisplay).join(', ');
  const remaining = names.length - maxDisplay;
  
  return `${displayed} (+${remaining} more)`;
}