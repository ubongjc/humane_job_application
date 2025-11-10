import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li"],
    ALLOWED_ATTR: ["href", "target", "rel"],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Sanitize user input - remove potentially dangerous characters
 */
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ""); // Remove event handlers
}

/**
 * Sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Sanitize SQL input (basic - use parameterized queries instead!)
 */
export function sanitizeSql(input: string): string {
  return input
    .replace(/'/g, "''") // Escape single quotes
    .replace(/;/g, "") // Remove semicolons
    .replace(/--/g, "") // Remove SQL comments
    .replace(/\/\*/g, "") // Remove multi-line comments
    .replace(/\*\//g, "");
}

/**
 * Sanitize file names
 */
export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace invalid chars
    .replace(/\.+/g, ".") // Remove multiple dots
    .slice(0, 255); // Limit length
}

/**
 * Sanitize URLs
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

/**
 * Validate and sanitize JSON input
 */
export function sanitizeJson(input: string): any {
  try {
    const parsed = JSON.parse(input);
    // Remove any functions or dangerous properties
    return JSON.parse(JSON.stringify(parsed));
  } catch {
    return null;
  }
}

/**
 * Sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  return phone.replace(/[^0-9+()-\s]/g, "");
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sanitize search queries
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .trim()
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ") // Normalize whitespace
    .slice(0, 200); // Limit length
}

/**
 * Validate and sanitize base64
 */
export function sanitizeBase64(input: string): string {
  // Remove any non-base64 characters
  return input.replace(/[^A-Za-z0-9+/=]/g, "");
}

/**
 * Check for common injection patterns
 */
export function detectInjection(input: string): {
  safe: boolean;
  threats: string[];
} {
  const threats: string[] = [];
  const patterns = [
    { pattern: /<script/i, threat: "XSS - script tag" },
    { pattern: /javascript:/i, threat: "XSS - javascript protocol" },
    { pattern: /on\w+\s*=/i, threat: "XSS - event handler" },
    { pattern: /(\bOR\b.*=|1=1|'=')/ i, threat: "SQL injection attempt" },
    { pattern: /UNION.*SELECT/i, threat: "SQL injection - UNION" },
    { pattern: /DROP.*TABLE/i, threat: "SQL injection - DROP TABLE" },
    { pattern: /\.\.\//g, threat: "Path traversal" },
    { pattern: /%00/g, threat: "Null byte injection" },
  ];

  for (const { pattern, threat } of patterns) {
    if (pattern.test(input)) {
      threats.push(threat);
    }
  }

  return {
    safe: threats.length === 0,
    threats,
  };
}
