/**
 * Safely decodes a URI component. Falls back to raw string if malformed.
 */
export function tryDecode(str: string): string {
  try {
    return decodeURIComponent(str);
  } catch {
    return str;
  }
}

/**
 * Validates a path for forbidden characters and control codes.
 * Ensures NFC normalization for consistent matching.
 */
export function isValidPath(path: string): boolean {
  const normalized = path.normalize("NFC");

  // Block Null Bytes and Control Characters (0-31, 127, 128-159)
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code <= 31 || code === 127 || (code >= 128 && code <= 159)) {
      return false;
    }
  }

  // Whitelist of strictly forbidden characters
  const forbidden = "<>\"'`\\^|[]{}";
  for (let i = 0; i < normalized.length; i++) {
    if (forbidden.indexOf(normalized[i]) !== -1) {
      return false;
    }
  }

  return true;
}

/**
 * Splits a path into segments. Handles leading slash and enforces a depth limit.
 */
export function splitPath(path: string, maxDepth = 32): string[] {
  const normalized = path.normalize("NFC");
  const segments = normalized.split("/");

  if (segments[0] === "") segments.shift();

  if (segments.length > maxDepth) {
    throw new Error(`Path depth exceeded limit (${maxDepth}).`);
  }

  return segments;
}
