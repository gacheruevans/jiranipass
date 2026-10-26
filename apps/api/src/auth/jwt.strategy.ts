import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from './current-user.decorator';

interface JwtPayload {
  sub: string;
  name: string;
  phone: string;
  estateId: string;
  role: string;
  shiftId?: string;
  gateId?: string;
  deviceId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET must be defined in production');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'jiranipass_dev_super_secret_jwt_key_at_least_32_characters',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          where: { estateId: payload.estateId, isActive: true },
        },
      },
    });

    if (!user || user.disabledAt) {
      throw new UnauthorizedException('User account is invalid or deactivated');
    }

    if (user.memberships.length === 0) {
      throw new UnauthorizedException('User has no active membership in this estate');
    }

    // If session is a guard shift, verify shift is still active
    if (payload.shiftId) {
      const shift = await this.prisma.guardShift.findUnique({
        where: { id: payload.shiftId },
      });

      if (!shift || shift.endedAt) {
        throw new UnauthorizedException('Guard shift has ended or is invalid. Please sign in again.');
      }
    }

    return {
      userId: user.id,
      name: user.name,
      phone: user.phone,
      estateId: payload.estateId,
      role: payload.role as any,
      shiftId: payload.shiftId,
      gateId: payload.gateId,
      deviceId: payload.deviceId,
    };
  }
}
