import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhoneNumber, Role } from '@jiranipass/shared';
import * as crypto from 'crypto';

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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret.trim()).digest('hex');
  }

  async loginGuard(dto: GuardLoginDto) {
    const normalizedPhone = normalizePhoneNumber(dto.phone);
    const pinHash = this.hashSecret(dto.pin);

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

    if (!user || user.pinHash !== pinHash) {
      throw new UnauthorizedException('Invalid guard phone number or PIN');
    }

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('User is not registered as an active guard in any estate');
    }

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
    const passwordHash = this.hashSecret(dto.password);

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

    if (!user || user.passwordHash !== passwordHash) {
      throw new UnauthorizedException('Invalid administrative credentials');
    }

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
    const pinHash = this.hashSecret(pin);

    const supervisorMembership = await this.prisma.membership.findFirst({
      where: {
        estateId,
        role: Role.SUPERVISOR,
        isActive: true,
        user: {
          pinHash,
          disabledAt: null,
        },
      },
      include: { user: true },
    });

    if (!supervisorMembership) {
      throw new UnauthorizedException('Invalid supervisor authorization PIN');
    }

    return supervisorMembership.user;
  }
}
