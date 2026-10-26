import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber, Role } from '@jiranipass/shared';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

interface GuardLoginDto {
  phone: string;
  pin: string;
  gateId: string;
  deviceId: string;
}

interface AdminLoginDto {
  phone: string;
  password: string;
}

interface FailedAttemptTracker {
  count: number;
  lockedUntil?: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly failedAttempts = new Map<string, FailedAttemptTracker>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Hashes secrets with bcrypt (10 rounds).
   */
  hashSecret(secret: string): string {
    return bcrypt.hashSync(secret.trim(), 10);
  }

  /**
   * Verifies plaintext against bcrypt hash, with backward-compatibility for legacy sha256.
   */
  verifySecret(plain: string, hashed: string | null | undefined): boolean {
    if (!hashed || !plain) return false;
    const trimmed = plain.trim();
    if (hashed.startsWith('$2a$') || hashed.startsWith('$2b$')) {
      return bcrypt.compareSync(trimmed, hashed);
    }
    // Legacy SHA-256 fallback
    const legacySha = crypto.createHash('sha256').update(trimmed).digest('hex');
    return legacySha === hashed;
  }

  /**
   * Enforces brute-force lockout: 5 failed attempts locks target for 15 minutes.
   */
  private checkLockout(key: string) {
    const record = this.failedAttempts.get(key);
    if (record?.lockedUntil) {
      if (new Date() < record.lockedUntil) {
        const remainingMinutes = Math.ceil(
          (record.lockedUntil.getTime() - Date.now()) / (60 * 1000),
        );
        throw new ForbiddenException(
          `Too many failed attempts. Account locked for ${remainingMinutes} more minute(s).`,
        );
      } else {
        this.failedAttempts.delete(key);
      }
    }
  }

  private registerFailedAttempt(key: string) {
    const record = this.failedAttempts.get(key) || { count: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      this.logger.warn(`Security alert: Key '${key}' locked out for 15 minutes after 5 failed attempts.`);
    }
    this.failedAttempts.set(key, record);
  }

  private clearFailedAttempts(key: string) {
    this.failedAttempts.delete(key);
  }

  async loginGuard(dto: GuardLoginDto) {
    const normalizedPhone = normalizePhoneNumber(dto.phone);
    const lockoutKey = `guard:${normalizedPhone}`;
    this.checkLockout(lockoutKey);

    const user = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        disabledAt: null,
      },
      include: {
        memberships: {
          where: { role: Role.GUARD, isActive: true },
          include: { estate: true },
        },
      },
    });

    if (!user || !this.verifySecret(dto.pin, user.pinHash)) {
      this.registerFailedAttempt(lockoutKey);
      throw new UnauthorizedException('Invalid guard phone number or PIN');
    }

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('User is not registered as an active guard in any estate');
    }

    this.clearFailedAttempts(lockoutKey);

    const membership = user.memberships[0];
    const estate = membership.estate;

    // End any existing open shift on this device or for this guard
    await this.prisma.guardShift.updateMany({
      where: {
        guardId: user.id,
        endedAt: null,
      },
      data: {
        endedAt: new Date(),
      },
    });

    // Create a new shift session
    const shift = await this.prisma.guardShift.create({
      data: {
        guardId: user.id,
        gateId: dto.gateId || 'GATE-MAIN',
        estateId: estate.id,
        deviceId: dto.deviceId || 'DEV-MOBILE',
      },
    });

    const payload = {
      sub: user.id,
      name: user.name,
      phone: user.phone,
      estateId: estate.id,
      role: Role.GUARD,
      shiftId: shift.id,
      gateId: shift.gateId,
      deviceId: shift.deviceId,
    };

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: Role.GUARD,
        estateId: estate.id,
        estateName: estate.name,
        shiftId: shift.id,
        gateId: shift.gateId,
      },
    };
  }

  async endGuardShift(shiftId: string, guardId: string) {
    const shift = await this.prisma.guardShift.findFirst({
      where: { id: shiftId, guardId },
    });

    if (!shift) {
      throw new NotFoundException('Active shift not found');
    }

    await this.prisma.guardShift.update({
      where: { id: shiftId },
      data: { endedAt: new Date() },
    });

    return { message: 'Shift ended successfully' };
  }

  async loginAdmin(dto: AdminLoginDto) {
    const normalizedPhone = normalizePhoneNumber(dto.phone);
    const lockoutKey = `admin:${normalizedPhone}`;
    this.checkLockout(lockoutKey);

    const user = await this.prisma.user.findFirst({
      where: {
        phone: normalizedPhone,
        disabledAt: null,
      },
      include: {
        memberships: {
          where: { role: { in: [Role.ESTATE_ADMIN, Role.SUPER_ADMIN] }, isActive: true },
          include: { estate: true },
        },
      },
    });

    if (!user || !this.verifySecret(dto.password, user.passwordHash)) {
      this.registerFailedAttempt(lockoutKey);
      throw new UnauthorizedException('Invalid administrative credentials');
    }

    if (!user.memberships || user.memberships.length === 0) {
      this.registerFailedAttempt(lockoutKey);
      throw new UnauthorizedException('User has no administrative privileges assigned');
    }

    this.clearFailedAttempts(lockoutKey);

    const membership = user.memberships[0];

    const payload = {
      sub: user.id,
      name: user.name,
      phone: user.phone,
      estateId: membership.estateId,
      role: membership.role,
    };

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        role: membership.role,
        estateId: membership.estateId,
        estateName: membership.estate?.name || 'All Estates',
      },
    };
  }

  async verifySupervisorPin(estateId: string, pin: string) {
    const lockoutKey = `supervisor:${estateId}`;
    this.checkLockout(lockoutKey);

    // Retrieve active supervisors in this estate
    const supervisorMemberships = await this.prisma.membership.findMany({
      where: {
        estateId,
        role: Role.SUPERVISOR,
        isActive: true,
        user: {
          disabledAt: null,
          pinHash: { not: null },
        },
      },
      include: { user: true },
    });

    for (const membership of supervisorMemberships) {
      if (this.verifySecret(pin, membership.user.pinHash)) {
        this.clearFailedAttempts(lockoutKey);
        return membership.user;
      }
    }

    this.registerFailedAttempt(lockoutKey);
    throw new UnauthorizedException('Invalid supervisor authorization PIN');
  }
}
