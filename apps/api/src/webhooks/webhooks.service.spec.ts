import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';
import { SseStreamService } from '../events/sse-stream.service';
import * as crypto from 'crypto';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prismaMock: any;
  let sseMock: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };

    prismaMock = {
      webhookEvent: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      visitRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
      },
    };

    sseMock = {
      broadcastVisitUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: SseStreamService, useValue: sseMock },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('verifySignature (HMAC-SHA256)', () => {
    const secret = 'super_secret_webhook_key_123';
    const body = Buffer.from(JSON.stringify({ test: 'payload_data' }));

    beforeEach(() => {
      process.env.META_APP_SECRET = secret;
      process.env.NODE_ENV = 'production';
    });

    it('should return true for valid HMAC signature', () => {
      const validHmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
      const header = `sha256=${validHmac}`;

      expect(service.verifySignature(body, header)).toBe(true);
    });

    it('should return false for incorrect signature hash', () => {
      const fakeHmac = crypto.createHmac('sha256', 'wrong_secret').update(body).digest('hex');
      const header = `sha256=${fakeHmac}`;

      expect(service.verifySignature(body, header)).toBe(false);
    });

    it('should return false when signature header is missing or malformed', () => {
      expect(service.verifySignature(body, undefined)).toBe(false);
      expect(service.verifySignature(body, '')).toBe(false);
      expect(service.verifySignature(body, 'invalid_header_without_sha_prefix')).toBe(false);
    });

    it('should safely return false without throwing RangeError on length mismatch', () => {
      // Signature length differs from 64-char hex
      const shortHeader = 'sha256=1234abcd';
      expect(() => service.verifySignature(body, shortHeader)).not.toThrow();
      expect(service.verifySignature(body, shortHeader)).toBe(false);

      const longHeader = `sha256=${'a'.repeat(128)}`;
      expect(service.verifySignature(body, longHeader)).toBe(false);
    });

    it('should fail closed in production if META_APP_SECRET is unset or placeholder', () => {
      process.env.NODE_ENV = 'production';
      process.env.META_APP_SECRET = 'your_meta_app_secret_for_webhook_signature_verification';

      const validHmac = crypto.createHmac('sha256', 'any').update(body).digest('hex');
      expect(service.verifySignature(body, `sha256=${validHmac}`)).toBe(false);

      delete process.env.META_APP_SECRET;
      expect(service.verifySignature(body, `sha256=${validHmac}`)).toBe(false);
    });

    it('should bypass signature verification in development mode with placeholder secret', () => {
      process.env.NODE_ENV = 'development';
      process.env.META_APP_SECRET = 'your_meta_app_secret';

      expect(service.verifySignature(body, undefined)).toBe(true);
    });
  });

  describe('handleIncomingWebhook', () => {
    it('should ignore payloads that are not whatsapp_business_account', async () => {
      const result = await service.handleIncomingWebhook({ object: 'page' });
      expect(result).toEqual({ status: 'ignored' });
    });
  });
});
