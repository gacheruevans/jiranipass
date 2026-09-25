import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { maskPhoneNumber, normalizePhoneNumber, HouseholdSearchResult, Role, ConsentSource } from '@jiranipass/shared';
import * as crypto from 'crypto';

@Injectable()
export class HouseholdsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search active households for guard arrival selection.
   * Strictly scopes by estateId and masks resident phone numbers.
   */
  async searchHouseholds(estateId: string, query?: string): Promise<HouseholdSearchResult[]> {
    const cleanQuery = query ? query.trim() : '';

    const households = await this.prisma.household.findMany({
      where: {
        estateId,
        isActive: true,
        ...(cleanQuery && {
          unitCode: {
            contains: cleanQuery,
            mode: 'insensitive',
          },
        }),
      },
      include: {
        memberships: {
          where: {
            isPrimary: true,
            isActive: true,
          },
          include: {
            user: true,
          },
        },
      },
      orderBy: { unitCode: 'asc' },
      take: 25,
    });

    return households.map((h) => {
      const primary = h.memberships[0]?.user;
      return {
        id: h.id,
        unitCode: h.unitCode,
        primaryResidentName: primary ? primary.name : 'Unassigned',
        maskedPhone: primary ? maskPhoneNumber(primary.phone) : 'N/A',
        isActive: h.isActive,
      };
    });
  }

  /**
   * Admin: Create a new household unit.
   */
  async createHousehold(estateId: string, unitCode: string) {
    const existing = await this.prisma.household.findUnique({
      where: {
        estateId_unitCode: {
          estateId,
          unitCode: unitCode.trim(),
        },
      },
    });

    if (existing) {
      throw new ConflictException(`Unit ${unitCode} already exists in this estate`);
    }

    return this.prisma.household.create({
      data: {
        estateId,
        unitCode: unitCode.trim(),
        isActive: true,
      },
    });
  }

  /**
   * Admin: Invite and assign primary resident to household with explicit WhatsApp consent.
   */
  async enrollResident(params: {
    estateId: string;
    householdId: string;
    name: string;
    phone: string;
    consentSource?: ConsentSource;
  }) {
    const household = await this.prisma.household.findFirst({
      where: { id: params.householdId, estateId: params.estateId },
    });

    if (!household) {
      throw new NotFoundException('Household unit not found in this estate');
    }

    const normalizedPhone = normalizePhoneNumber(params.phone);
    const phoneHash = crypto.createHash('sha256').update(normalizedPhone).digest('hex');

    // Create or update user record
    const user = await this.prisma.user.upsert({
      where: { id: `user-${normalizedPhone}` },
      update: {
        name: params.name,
      },
      create: {
        id: `user-${normalizedPhone}`,
        name: params.name,
        phone: normalizedPhone,
        phoneLookupHash: phoneHash,
        verifiedAt: new Date(),
      },
    });

    // Demote any existing primary resident for this household
    await this.prisma.membership.updateMany({
      where: { householdId: household.id, isPrimary: true },
      data: { isPrimary: false },
    });

    // Create membership as primary resident
    const membership = await this.prisma.membership.create({
      data: {
        userId: user.id,
        estateId: params.estateId,
        householdId: household.id,
        role: Role.RESIDENT,
        isPrimary: true,
        isActive: true,
      },
    });

    // Record explicit WhatsApp consent
    await this.prisma.whatsAppConsent.create({
      data: {
        userId: user.id,
        phone: normalizedPhone,
        purpose: 'ESTATE_VISITOR_ACCESS_ALERTS',
        noticeVersion: '1.0',
        collectionSource: params.consentSource || ConsentSource.ADMIN_PORTAL,
      },
    });

    return {
      message: 'Resident enrolled and assigned successfully',
      householdId: household.id,
      resident: {
        id: user.id,
        name: user.name,
        phone: maskPhoneNumber(user.phone),
      },
    };
  }
}
