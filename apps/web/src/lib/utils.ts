import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges component class names using the same helper shape as shadcn/ui.
 *
 * @param inputs Class names and conditional class values.
 * @returns A stable class name string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
