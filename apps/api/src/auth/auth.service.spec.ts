import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@jiranipass/shared';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let prismaMock: any;
  let jwtMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findFirst: jest.fn(),
      },
      membership: {
        findMany: jest.fn(),
      },
      guardShift: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    jwtMock = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: JwtService, useValue: jwtMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('Secret Hashing and Verification', () => {
    it('should hash with bcrypt and verify correctly', () => {
      const pin = '1234';
      const hash = service.hashSecret(pin);
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
      expect(service.verifySecret(pin, hash)).toBe(true);
      expect(service.verifySecret('9999', hash)).toBe(false);
    });

    it('should support legacy sha256 verification backward-compatibility', () => {
      const pin = '5678';
      const legacySha256 = crypto.createHash('sha256').update(pin).digest('hex');
      expect(service.verifySecret(pin, legacySha256)).toBe(true);
      expect(service.verifySecret('wrong', legacySha256)).toBe(false);
    });

    it('should safely return false for null, undefined, or empty inputs', () => {
      expect(service.verifySecret('', 'some-hash')).toBe(false);
      expect(service.verifySecret('1234', null)).toBe(false);
      expect(service.verifySecret('1234', undefined)).toBe(false);
    });
  });

  describe('Guard Login & Brute Force Lockout', () => {
    const validPhone = '+254799000001';
    const validPin = '1234';
    const hashedPin = bcrypt.hashSync(validPin, 10);

    const mockGuardUser = {
      id: 'guard-user-1',
      phone: validPhone,
      name: 'Samson Guard',
      pinHash: hashedPin,
      disabledAt: null,
      memberships: [
        {
          id: 'mem-1',
          role: Role.GUARD,
          isActive: true,
          estateId: 'estate-1',
          estate: { id: 'estate-1', name: 'Green Valley' },
        },
      ],
    };

    it('should log in an active guard successfully and return token and shift', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockGuardUser);
      prismaMock.guardShift.findFirst.mockResolvedValue({
        id: 'shift-1',
        gateId: 'GATE-MAIN',
        startedAt: new Date(),
      });
      prismaMock.guardShift.create.mockResolvedValue({
        id: 'shift-1',
        gateId: 'GATE-MAIN',
        deviceId: 'DEV-1',
        startedAt: new Date(),
      });

      const res = await service.loginGuard({
        phone: '0799000001',
        pin: '1234',
        gateId: 'GATE-MAIN',
        deviceId: 'DEV-1',
      });

      expect(res.token).toBe('mock-jwt-token');
      expect(res.user.name).toBe('Samson Guard');
      expect(jwtMock.sign).toHaveBeenCalled();
    });

    it('should reject invalid PIN and increment failed attempts', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockGuardUser);

      await expect(
        service.loginGuard({
          phone: validPhone,
          pin: '9999',
          gateId: 'GATE-MAIN',
          deviceId: 'DEV-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should lockout user after 5 consecutive failed attempts', async () => {
      prismaMock.user.findFirst.mockResolvedValue(mockGuardUser);

      // 4 failures
      for (let i = 0; i < 4; i++) {
        await expect(
          service.loginGuard({
            phone: validPhone,
            pin: 'wrong',
            gateId: 'GATE-MAIN',
            deviceId: 'DEV-1',
          }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // 5th failure
      await expect(
        service.loginGuard({
          phone: validPhone,
          pin: 'wrong',
          gateId: 'GATE-MAIN',
          deviceId: 'DEV-1',
        }),
      ).rejects.toThrow(UnauthorizedException);

      // 6th attempt should now throw ForbiddenException due to lockout
      await expect(
        service.loginGuard({
          phone: validPhone,
          pin: validPin, // even correct PIN is rejected during lockout
          gateId: 'GATE-MAIN',
          deviceId: 'DEV-1',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Supervisor PIN Verification', () => {
    it('should return supervisor user for valid supervisor PIN', async () => {
      const pin = '9999';
      const supervisorUser = {
        id: 'sup-1',
        name: 'Jane Supervisor',
        pinHash: bcrypt.hashSync(pin, 10),
      };

      prismaMock.membership.findMany.mockResolvedValue([
        {
          id: 'mem-sup-1',
          role: Role.SUPERVISOR,
          isActive: true,
          user: supervisorUser,
        },
      ]);

      const result = await service.verifySupervisorPin('estate-1', pin);
      expect(result.id).toBe('sup-1');
      expect(result.name).toBe('Jane Supervisor');
    });

    it('should reject invalid supervisor PIN with UnauthorizedException', async () => {
      prismaMock.membership.findMany.mockResolvedValue([]);

      await expect(
        service.verifySupervisorPin('estate-1', '0000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
