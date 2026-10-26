import {
  normalizePhoneNumber,
  maskPhoneNumber,
  generateVisitReference,
  buildButtonPayload,
  parseButtonPayload,
} from '@jiranipass/shared';

describe('Shared Utilities', () => {
  describe('normalizePhoneNumber', () => {
    it('should format 07xx Kenyan numbers to E.164 (+254...) format', () => {
      expect(normalizePhoneNumber('0712345678')).toBe('+254712345678');
      expect(normalizePhoneNumber('0110123456')).toBe('+254110123456');
    });

    it('should format 9-digit Kenyan numbers without leading zero', () => {
      expect(normalizePhoneNumber('712345678')).toBe('+254712345678');
    });

    it('should preserve already formatted E.164 numbers', () => {
      expect(normalizePhoneNumber('+254712345678')).toBe('+254712345678');
      expect(normalizePhoneNumber('+14155552671')).toBe('+14155552671');
    });

    it('should strip spaces, dashes, and parentheses', () => {
      expect(normalizePhoneNumber(' +254 (712) 345-678 ')).toBe('+254712345678');
    });

    it('should return empty string for empty input', () => {
      expect(normalizePhoneNumber('')).toBe('');
    });
  });

  describe('maskPhoneNumber', () => {
    it('should mask the middle digits while preserving country code and last 3 digits', () => {
      expect(maskPhoneNumber('+254712345678')).toBe('+254 71XX XXX 678');
      expect(maskPhoneNumber('0799000001')).toBe('+254 79XX XXX 001');
    });

    it('should fallback cleanly on non-standard lengths', () => {
      expect(maskPhoneNumber('+14155552671')).toBe('+141 **** 671');
    });

    it('should return placeholder for empty or very short strings', () => {
      expect(maskPhoneNumber('')).toBe('');
      expect(maskPhoneNumber('1')).toBe('***-***-***');
    });
  });

  describe('generateVisitReference', () => {
    it('should generate 4-character alphanumeric code prefixed with V-', () => {
      const ref = generateVisitReference();
      expect(ref).toMatch(/^V-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
    });

    it('should exclude ambiguous characters (0, O, 1, I, L)', () => {
      for (let i = 0; i < 50; i++) {
        const ref = generateVisitReference();
        expect(ref).not.toMatch(/[0O1IL]/);
      }
    });
  });

  describe('buildButtonPayload & parseButtonPayload', () => {
    it('should encode and decode APPROVE payload accurately', () => {
      const reqId = 'req123';
      const encoded = buildButtonPayload(reqId, 'APPROVE');
      expect(encoded).toBe('REQ_req123_APP');

      const decoded = parseButtonPayload(encoded);
      expect(decoded).toEqual({
        requestId: 'req123',
        action: 'APPROVE',
      });
    });

    it('should encode and decode DENY payload accurately', () => {
      const reqId = 'req456';
      const encoded = buildButtonPayload(reqId, 'DENY');
      expect(encoded).toBe('REQ_req456_DEN');

      const decoded = parseButtonPayload(encoded);
      expect(decoded).toEqual({
        requestId: 'req456',
        action: 'DENY',
      });
    });

    it('should return null for malformed payloads', () => {
      expect(parseButtonPayload('MALFORMED_STRING')).toBeNull();
      expect(parseButtonPayload('REQ_123_UNKNOWN')).toBeNull();
      expect(parseButtonPayload('')).toBeNull();
    });
  });
});
