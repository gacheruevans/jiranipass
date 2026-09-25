import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Re-export all Prisma types
export * from '@prisma/client';

// Global singleton pattern to prevent multiple instances in development hot-reloading
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Creates a deterministic SHA-256 hash of a normalized phone number.
 * Used for fast indexed lookups without exposing raw PII in index trees.
 */
export function createPhoneLookupHash(normalizedPhone: string): string {
  return crypto.createHash('sha256').update(normalizedPhone.trim()).digest('hex');
}
