/**
 * Normalizes user-supplied phone numbers into strict E.164 international format.
 * Defaults to Kenya (+254) for 9/10-digit local formats.
 */
export function normalizePhoneNumber(phone: string, defaultCountryCode = '254'): string {
  if (!phone) return '';
  // Strip all non-digit characters except leading plus
  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    return cleaned;
  }

  // Handle Kenya-specific local formatting
  if (cleaned.startsWith('0')) {
    cleaned = defaultCountryCode + cleaned.substring(1);
  } else if (!cleaned.startsWith(defaultCountryCode) && cleaned.length <= 9) {
    cleaned = defaultCountryCode + cleaned;
  }

  return `+${cleaned}`;
}

/**
 * Masks phone numbers to protect resident privacy from gate attendants.
 * Formats: +254712345678 -> +254 7XX XXX 678
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  const normalized = normalizePhoneNumber(phone);
  // Match +CCC followed by 2 digits, then 4 digits to mask, then last 3 digits
  const match = normalized.match(/^(\+\d{3})(\d{2})\d{4}(\d{3})$/);
  if (match) {
    return `${match[1]} ${match[2]}XX XXX ${match[3]}`;
  }
  // Generic fallback mask: keep first 4 and last 3 characters
  if (normalized.length >= 7) {
    const start = normalized.substring(0, 4);
    const end = normalized.substring(normalized.length - 3);
    return `${start} **** ${end}`;
  }
  return '***-***-***';
}

/**
 * Generates an uppercase 4-character visit reference (e.g. V-8K4Q)
 * Excludes ambiguous characters (0, O, 1, I, L)
 */
export function generateVisitReference(): string {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let ref = '';
  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    ref += chars[randomIndex];
  }
  return `V-${ref}`;
}

/**
 * Encodes request ID and button decision into an opaque button payload.
 * Format: REQ_{requestId}_{action}
 */
export function buildButtonPayload(requestId: string, action: 'APPROVE' | 'DENY'): string {
  const suffix = action === 'APPROVE' ? 'APP' : 'DEN';
  return `REQ_${requestId}_${suffix}`;
}

/**
 * Parses and verifies incoming WhatsApp button reply payload.
 */
export function parseButtonPayload(payload: string): { requestId: string; action: 'APPROVE' | 'DENY' } | null {
  if (!payload) return null;
  const match = payload.match(/^REQ_([a-zA-Z0-9_-]+)_(APP|DEN)$/);
  if (!match) return null;
  return {
    requestId: match[1],
    action: match[2] === 'APP' ? 'APPROVE' : 'DENY',
  };
}
