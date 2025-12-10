// Input sanitization utilities

/**
 * Sanitize a display name (username, participant name, etc.)
 * - Removes control characters and zero-width chars
 * - Trims whitespace
 * - Limits length
 * - Returns fallback if empty
 */
export function sanitizeDisplayName(
  input: string | undefined | null, 
  fallback = 'Anonymous',
  maxLength = 50
): string {
  if (!input || typeof input !== 'string') {
    return fallback;
  }
  
  // Remove control characters, zero-width chars, and other problematic Unicode
  const cleaned = input
    .replace(/[\x00-\x1F\x7F]/g, '') // Control characters
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '') // Zero-width and special
    .replace(/[\uD800-\uDFFF]/g, '') // Surrogate pairs (orphaned)
    .trim();
  
  if (!cleaned) {
    return fallback;
  }
  
  // Limit length
  return cleaned.slice(0, maxLength);
}

/**
 * Sanitize a session/playlist name
 */
export function sanitizeSessionName(
  input: string | undefined | null,
  fallback = 'Untitled Session',
  maxLength = 100
): string {
  return sanitizeDisplayName(input, fallback, maxLength);
}

/**
 * Sanitize user-provided description text
 */
export function sanitizeDescription(
  input: string | undefined | null,
  maxLength = 300
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove control characters but allow newlines
  const cleaned = input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Control chars except \t \n \r
    .replace(/[\u200B-\u200F\u2028-\u202F\u2060-\u206F\uFEFF]/g, '') // Zero-width
    .trim();
  
  return cleaned.slice(0, maxLength);
}

