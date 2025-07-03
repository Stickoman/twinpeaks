/**
 * Strip HTML tags and control characters from user input.
 * Keeps only printable text + common whitespace (space, tab, newline).
 */
export function sanitizeText(input: string): string {
  return (
    input
      // Strip HTML tags
      .replace(/<[^>]*>/g, "")
      // Remove control chars except \n, \r, \t
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .trim()
  );
}
