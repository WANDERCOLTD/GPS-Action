/**
 * Permission matrix — declarative, data-driven.
 * See docs/process/security-baseline.md for the full pattern.
 */

// Placeholder. Real permissions populated alongside User entity.
export const permissions = {} as const;

export function checkPermission(_user: unknown, _action: string, _scope?: unknown): boolean {
  // Placeholder implementation. Real check added with User entity.
  return false;
}
