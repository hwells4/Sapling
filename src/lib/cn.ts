import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function for merging Tailwind CSS classes.
 * Uses clsx for conditional classes and tailwind-merge for conflict resolution.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
