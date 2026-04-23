/**
 * Error taxonomy — every error in GPS Action has a code here.
 * See docs/process/security-baseline.md for why this matters.
 */

export const ErrorCodes = {
  // Placeholder — real codes added per feature.
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
