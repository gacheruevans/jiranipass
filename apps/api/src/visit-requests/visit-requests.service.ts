import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SseStreamService } from '../events/sse-stream.service';
import { AuthService } from '../auth/auth.service';
import {
  CreateVisitRequestDto,
  CheckInDto,
  CheckOutDto,
  SupervisorOverrideDto,
  VisitRequestResponse,
  VisitStatus,
  generateVisitReference,
  normalizePhoneNumber,
  buildButtonPayload,
} from '@jiranipass/shared';

@Injectable()
export class VisitRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseStreamService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Transforms raw Prisma VisitRequest into authoritative API response.
   */
  private formatVisitResponse(req: any): VisitRequestResponse {
    const isApproved = req.status === VisitStatus.APPROVED;
    const isCheckedIn = req.status === VisitStatus.CHECKED_IN;
    const notExpired = req.approvedUntil ? new Date() <= new Date(req.approvedUntil) : false;

    return {
      id: req.id,
      estateId: req.estateId,
      reference: req.reference,
      unitCode: req.household?.unitCode || 'Unknown Unit',
      visitorName: req.visitor?.name || 'Unknown Visitor',
      visitorPhone: req.visitor?.phone,
      vehiclePlate: req.visitor?.vehicleRegistration,
      purpose: req.purpose,
      status: req.status as VisitStatus,
      createdAt: req.createdAt.toISOString(),
      expiresAt: req.expiresAt.toISOString(),
      approvedUntil: req.approvedUntil?.toISOString() || null,
      checkedInAt: req.checkedInAt?.toISOString() || null,
      checkedOutAt: req.checkedOutAt?.toISOString() || null,
      assignedResidentName: req.assignedResident?.name || null,
      canAdmit: isApproved && notExpired,
      canCheckOut: isCheckedIn,
      canOverride: [VisitStatus.PENDING, VisitStatus.EXPIRED, VisitStatus.DENIED, VisitStatus.DELIVERY_FAILED].includes(req.status),
    };
  }

  /**
   * Guard initiates a visitor arrival request.
   * Atomically commits VisitRequest + OutboxEvent in one transaction.
   */
  async createRequest(
    guardUser: { userId: string; estateId: string; gateId?: string; deviceId?: string },
    dto: CreateVisitRequestDto,
  ): Promise<VisitRequestResponse> {
    // 1. Verify household belongs to guard's estate
    const household = await this.prisma.household.findFirst({
      where: { id: dto.householdId, estateId: guardUser.estateId, isActive: true },
      include: {
        estate: true,
        memberships: {
          where: { isPrimary: true, isActive: true },
          include: {
            user: {
              include: {
                whatsappConsents: {
                  where: { withdrawnAt: null },
                  orderBy: { grantedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!household) {
      throw new NotFoundException('Household not found or inactive in this estate');
    }

    const primaryMembership = household.memberships[0];
    if (!primaryMembership) {
      throw new BadRequestException('Selected household has no designated primary resident');
    }

    const resident = primaryMembership.user;
    if (resident.whatsappConsents.length === 0) {
      throw new BadRequestException('Primary resident has not opted in to WhatsApp access alerts');
    }

    // 2. Normalize and upsert visitor
    const visitor = await this.prisma.visitor.create({
      data: {
        estateId: guardUser.estateId,
        name: dto.visitorName.trim(),
        phone: dto.visitorPhone ? normalizePhoneNumber(dto.visitorPhone) : null,
        vehicleRegistration: dto.vehiclePlate ? dto.vehiclePlate.trim().toUpperCase() : null,
      },
    });

    const ttlMinutes = household.estate.approvalTtlMinutes || 10;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    const reference = generateVisitReference();
    const gateId = dto.gateId || guardUser.gateId || 'GATE-MAIN';

    // 3. Atomically create VisitRequest, OutboxEvent, and AccessEvent
    const result = await this.prisma.$transaction(async (tx) => {
      const visitRequest = await tx.visitRequest.create({
        data: {
          estateId: guardUser.estateId,
          householdId: household.id,
          visitorId: visitor.id,
          guardId: guardUser.userId,
          assignedResidentId: resident.id,
          gateId,
          reference,
          status: VisitStatus.PENDING,
          purpose: dto.purpose?.trim() || null,
          expiresAt,
          idempotencyKey: dto.idempotencyKey || null,
        },
        include: {
          household: true,
          visitor: true,
          assignedResident: true,
        },
      });

      // Transactional Outbox Job for WhatsApp Worker
      const approvePayload = buildButtonPayload(visitRequest.id, 'APPROVE');
      const denyPayload = buildButtonPayload(visitRequest.id, 'DENY');

      await tx.outboxEvent.create({
        data: {
          aggregateId: visitRequest.id,
          eventType: 'VISIT_REQUEST_CREATED',
          payload: {
            requestId: visitRequest.id,
            reference: visitRequest.reference,
            estateName: household.estate.name,
            unitCode: household.unitCode,
            visitorName: visitor.name,
            recipientPhone: resident.phone,
            recipientName: resident.name,
            approvePayload,
            denyPayload,
            createdAt: now.toISOString(),
          },
        },
      });

      // Immutable Access Audit Log
      await tx.accessEvent.create({
        data: {
          visitRequestId: visitRequest.id,
          actorId: guardUser.userId,
          action: 'REQUEST_CREATED',
          gateId,
          deviceId: guardUser.deviceId,
          previousStatus: VisitStatus.PENDING,
          newStatus: VisitStatus.PENDING,
        },
      });

      return visitRequest;
    });

    const formatted = this.formatVisitResponse(result);
    // Broadcast live event to guard devices
    this.sseService.broadcastVisitUpdate(guardUser.estateId, formatted, gateId);

    return formatted;
  }

  /**
   * Get single visit request with authoritative state.
   */
  async getRequestById(estateId: string, requestId: string): Promise<VisitRequestResponse> {
    const request = await this.prisma.visitRequest.findFirst({
      where: { id: requestId, estateId },
      include: {
        household: true,
        visitor: true,
        assignedResident: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Visit request not found');
    }

    return this.formatVisitResponse(request);
  }

  /**
   * List visit requests scoped to estate (with optional gate, status, and date filters).
   */
  async listRequests(estateId: string, filters?: { gateId?: string; status?: VisitStatus; limit?: number }) {
    const requests = await this.prisma.visitRequest.findMany({
      where: {
        estateId,
        ...(filters?.gateId && { gateId: filters.gateId }),
        ...(filters?.status && { status: filters.status as any }),
      },
      include: {
        household: true,
        visitor: true,
        assignedResident: true,
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });

    return requests.map((req) => this.formatVisitResponse(req));
  }

  /**
   * Guard checks in visitor after verifying physical identity and server approval.
   */
  async checkInVisitor(
    guardUser: { userId: string; estateId: string; gateId?: string; deviceId?: string },
    requestId: string,
    dto: CheckInDto,
  ): Promise<VisitRequestResponse> {
    const request = await this.prisma.visitRequest.findFirst({
      where: { id: requestId, estateId: guardUser.estateId },
      include: { household: true, visitor: true, assignedResident: true },
    });

    if (!request) {
      throw new NotFoundException('Visit request not found');
    }

    // Strict validation
    if (request.status !== VisitStatus.APPROVED) {
      throw new BadRequestException(`Cannot check in visitor with status '${request.status}'. Approval required.`);
    }

    if (!request.approvedUntil || new Date() > new Date(request.approvedUntil)) {
      throw new BadRequestException('Approval window has expired. A new request must be created.');
    }

    const gateId = guardUser.gateId || request.gateId;

    // Atomic update with optimistic version lock
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitRequest.updateMany({
        where: {
          id: request.id,
          status: VisitStatus.APPROVED,
          version: request.version,
        },
        data: {
          status: VisitStatus.CHECKED_IN,
          checkedInAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concurrent modification detected during check-in');
      }

      await tx.accessEvent.create({
        data: {
          visitRequestId: request.id,
          actorId: guardUser.userId,
          action: 'CHECKED_IN',
          gateId,
          verificationMethod: dto.verificationMethod as any,
          reason: dto.notes || null,
          deviceId: guardUser.deviceId,
          previousStatus: VisitStatus.APPROVED,
          newStatus: VisitStatus.CHECKED_IN,
        },
      });

      return tx.visitRequest.findUnique({
        where: { id: request.id },
        include: { household: true, visitor: true, assignedResident: true },
      });
    });

    const formatted = this.formatVisitResponse(updated);
    this.sseService.broadcastVisitUpdate(guardUser.estateId, formatted, gateId);
    return formatted;
  }

  /**
   * Guard records visitor departure.
   */
  async checkOutVisitor(
    guardUser: { userId: string; estateId: string; gateId?: string; deviceId?: string },
    requestId: string,
    dto: CheckOutDto,
  ): Promise<VisitRequestResponse> {
    const request = await this.prisma.visitRequest.findFirst({
      where: { id: requestId, estateId: guardUser.estateId },
      include: { household: true, visitor: true, assignedResident: true },
    });

    if (!request) {
      throw new NotFoundException('Visit request not found');
    }

    if (request.status !== VisitStatus.CHECKED_IN) {
      throw new BadRequestException(`Cannot check out visitor with status '${request.status}'`);
    }

    const gateId = guardUser.gateId || request.gateId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitRequest.updateMany({
        where: {
          id: request.id,
          status: VisitStatus.CHECKED_IN,
          version: request.version,
        },
        data: {
          status: VisitStatus.CHECKED_OUT,
          checkedOutAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concurrent modification detected during check-out');
      }

      await tx.accessEvent.create({
        data: {
          visitRequestId: request.id,
          actorId: guardUser.userId,
          action: 'CHECKED_OUT',
          gateId,
          reason: dto.notes || null,
          deviceId: guardUser.deviceId,
          previousStatus: VisitStatus.CHECKED_IN,
          newStatus: VisitStatus.CHECKED_OUT,
        },
      });

      return tx.visitRequest.findUnique({
        where: { id: request.id },
        include: { household: true, visitor: true, assignedResident: true },
      });
    });

    const formatted = this.formatVisitResponse(updated);
    this.sseService.broadcastVisitUpdate(guardUser.estateId, formatted, gateId);
    return formatted;
  }

  /**
   * Exceptional supervisor admission.
   * Requires supervisor PIN and mandatory written reason. Never appears as resident approval.
   */
  async supervisorOverride(
    guardUser: { userId: string; estateId: string; gateId?: string; deviceId?: string },
    requestId: string,
    dto: SupervisorOverrideDto,
  ): Promise<VisitRequestResponse> {
    if (!dto.reason || dto.reason.trim().length < 10) {
      throw new BadRequestException('A descriptive supervisor justification reason (min 10 characters) is mandatory');
    }

    // Verify supervisor credentials
    const supervisor = await this.authService.verifySupervisorPin(guardUser.estateId, dto.supervisorPin);

    const request = await this.prisma.visitRequest.findFirst({
      where: { id: requestId, estateId: guardUser.estateId },
      include: { household: true, visitor: true, assignedResident: true },
    });

    if (!request) {
      throw new NotFoundException('Visit request not found');
    }

    if (request.status === VisitStatus.CHECKED_IN || request.status === VisitStatus.CHECKED_OUT) {
      throw new BadRequestException(`Cannot override visit that is already ${request.status}`);
    }

    const gateId = guardUser.gateId || request.gateId;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitRequest.updateMany({
        where: {
          id: request.id,
          version: request.version,
        },
        data: {
          status: VisitStatus.OVERRIDE_ADMITTED,
          checkedInAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException('Concurrent modification detected during override');
      }

      await tx.accessEvent.create({
        data: {
          visitRequestId: request.id,
          actorId: supervisor.id,
          action: 'OVERRIDE_ADMITTED',
          gateId,
          reason: dto.reason.trim(),
          verificationMethod: dto.verificationMethod as any,
          deviceId: guardUser.deviceId,
          previousStatus: request.status,
          newStatus: VisitStatus.OVERRIDE_ADMITTED,
        },
      });

      return tx.visitRequest.findUnique({
        where: { id: request.id },
        include: { household: true, visitor: true, assignedResident: true },
      });
    });

    const formatted = this.formatVisitResponse(updated);
    this.sseService.broadcastVisitUpdate(guardUser.estateId, formatted, gateId);
    return formatted;
  }
}
