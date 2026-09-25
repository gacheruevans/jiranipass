import {
  Injectable,
  UnauthorizedException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SseStreamService } from '../events/sse-stream.service';
import {
  parseButtonPayload,
  normalizePhoneNumber,
  VisitStatus,
  WebhookProcessingState,
  DecisionValue,
  DecisionChannel,
} from '@jiranipass/shared';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: SseStreamService,
  ) {}

  /**
   * Validates Meta challenge for webhook subscription verification.
   */
  verifyChallenge(mode: string, token: string, challenge: string): string {
    const configuredToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'jiranipass_webhook_verify_token_dev';
    if (mode === 'subscribe' && token === configuredToken) {
      this.logger.log('Meta webhook challenge verified successfully');
      return challenge;
    }
    throw new UnauthorizedException('Invalid webhook verification token');
  }

  /**
   * Verifies X-Hub-Signature-256 HMAC-SHA256 signature against the raw request buffer.
   */
  verifySignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const appSecret = process.env.META_APP_SECRET;
    // In local development without Meta secret configured, allow bypass with warning
    if (!appSecret || appSecret.includes('your_meta_app_secret')) {
      this.logger.warn('META_APP_SECRET not configured. Bypassing signature check in development mode.');
      return true;
    }

    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    const receivedSignature = signatureHeader.substring(7);
    return crypto.timingSafeEqual(
      Buffer.from(receivedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    );
  }

  /**
   * Ingests, deduplicates, and processes an incoming WhatsApp webhook.
   */
  async handleIncomingWebhook(payload: any) {
    if (payload.object !== 'whatsapp_business_account') {
      return { status: 'ignored' };
    }

    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // 1. Handle incoming button messages
        const messages = value.messages || [];
        for (const msg of messages) {
          await this.processIncomingMessage(msg);
        }

        // 2. Handle delivery statuses
        const statuses = value.statuses || [];
        for (const status of statuses) {
          await this.processDeliveryStatus(status);
        }
      }
    }

    return { status: 'success' };
  }

  /**
   * Process individual incoming WhatsApp interactive message or quick reply.
   */
  async processIncomingMessage(message: any) {
    const providerEventId = message.id;
    if (!providerEventId) return;

    // Deduplication check
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { providerEventId },
    });

    if (existing) {
      this.logger.debug(`Webhook message ${providerEventId} already processed (deduplicated)`);
      return;
    }

    // Persist webhook event for audit & deduplication
    await this.prisma.webhookEvent.create({
      data: {
        providerEventId,
        eventType: 'MESSAGES',
        payload: message,
        processingState: WebhookProcessingState.RECEIVED,
      },
    });

    // Extract button reply payload
    let rawPayload = '';
    if (message.type === 'interactive' && message.interactive?.button_reply) {
      rawPayload = message.interactive.button_reply.id;
    } else if (message.type === 'button' && message.button) {
      rawPayload = message.button.payload;
    }

    if (!rawPayload) {
      this.logger.debug(`Message ${providerEventId} is not a button reply. Ignoring.`);
      return;
    }

    const parsed = parseButtonPayload(rawPayload);
    if (!parsed) {
      this.logger.warn(`Unrecognized button payload format: ${rawPayload}`);
      return;
    }

    const { requestId, action } = parsed;
    const senderPhone = normalizePhoneNumber(message.from);

    await this.applyResidentDecision({
      requestId,
      action,
      senderPhone,
      providerMessageId: providerEventId,
      channel: DecisionChannel.WHATSAPP_BUTTON,
    });
  }

  /**
   * Process delivery status callback from Meta.
   */
  async processDeliveryStatus(status: any) {
    const providerMessageId = status.id;
    if (!providerMessageId) return;

    const attempt = await this.prisma.messageAttempt.findUnique({
      where: { providerMessageId },
    });

    if (attempt) {
      const stateMap: Record<string, any> = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        read: 'READ',
        failed: 'FAILED',
      };
      const sendState = stateMap[status.status] || attempt.sendState;

      await this.prisma.messageAttempt.update({
        where: { id: attempt.id },
        data: {
          sendState,
          errorCode: status.errors ? JSON.stringify(status.errors) : null,
        },
      });

      if (sendState === 'FAILED') {
        this.logger.warn(`WhatsApp message delivery failed for request ${attempt.visitRequestId}`);
      }
    }
  }

  /**
   * Applies an authenticated resident decision to a visit request.
   */
  async applyResidentDecision(params: {
    requestId: string;
    action: 'APPROVE' | 'DENY';
    senderPhone: string;
    providerMessageId?: string;
    channel: DecisionChannel;
  }) {
    const { requestId, action, senderPhone, providerMessageId, channel } = params;

    const request = await this.prisma.visitRequest.findUnique({
      where: { id: requestId },
      include: {
        estate: true,
        household: true,
        visitor: true,
        assignedResident: true,
      },
    });

    if (!request) {
      this.logger.error(`Visit request ${requestId} not found for incoming decision`);
      return;
    }

    // Verify sender phone matches assigned resident
    const resident = request.assignedResident;
    if (resident.phone !== senderPhone) {
      this.logger.warn(
        `Security mismatch: Webhook sender phone ${senderPhone} does not match assigned resident phone ${resident.phone}`,
      );
      return;
    }

    // Verify request is currently PENDING
    if (request.status !== VisitStatus.PENDING) {
      this.logger.warn(
        `Request ${requestId} is already in state '${request.status}'. Rejecting late decision.`,
      );
      return;
    }

    // Check expiration
    if (new Date() > request.expiresAt) {
      await this.prisma.visitRequest.update({
        where: { id: request.id },
        data: { status: VisitStatus.EXPIRED },
      });
      return;
    }

    const isApprove = action === 'APPROVE';
    const newStatus = isApprove ? VisitStatus.APPROVED : VisitStatus.DENIED;
    const ttlMinutes = request.estate.approvalTtlMinutes || 10;
    const approvedUntil = isApprove ? new Date(Date.now() + ttlMinutes * 60 * 1000) : null;

    // Atomically commit decision, update request status, and append access event
    const updated = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.visitRequest.updateMany({
        where: {
          id: request.id,
          status: VisitStatus.PENDING,
          version: request.version,
        },
        data: {
          status: newStatus,
          approvedUntil,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new Error('Concurrent state modification conflict during webhook processing');
      }

      await tx.visitDecision.create({
        data: {
          visitRequestId: request.id,
          residentId: resident.id,
          decision: isApprove ? DecisionValue.APPROVE : DecisionValue.DENY,
          channel,
          providerMessageId,
        },
      });

      await tx.accessEvent.create({
        data: {
          visitRequestId: request.id,
          actorId: resident.id,
          action: isApprove ? 'APPROVED' : 'DENIED',
          gateId: request.gateId,
          previousStatus: VisitStatus.PENDING,
          newStatus,
        },
      });

      return tx.visitRequest.findUnique({
        where: { id: request.id },
        include: {
          household: true,
          visitor: true,
          assignedResident: true,
        },
      });
    });

    if (updated) {
      this.logger.log(`Visit ${request.reference} successfully updated to ${newStatus} by resident ${resident.name}`);

      // Broadcast live event to guard screens immediately
      const formatted = {
        id: updated.id,
        estateId: updated.estateId,
        reference: updated.reference,
        unitCode: updated.household.unitCode,
        visitorName: updated.visitor.name,
        visitorPhone: updated.visitor.phone,
        vehiclePlate: updated.visitor.vehicleRegistration,
        purpose: updated.purpose,
        status: updated.status as VisitStatus,
        createdAt: updated.createdAt.toISOString(),
        expiresAt: updated.expiresAt.toISOString(),
        approvedUntil: updated.approvedUntil?.toISOString() || null,
        checkedInAt: updated.checkedInAt?.toISOString() || null,
        checkedOutAt: updated.checkedOutAt?.toISOString() || null,
        assignedResidentName: updated.assignedResident.name,
        canAdmit: isApprove,
        canCheckOut: false,
        canOverride: !isApprove,
      };

      this.sseService.broadcastVisitUpdate(updated.estateId, formatted, updated.gateId);
    }
  }

  /**
   * Development & Pilot simulation endpoint: Simulates a resident clicking Approve or Deny.
   */
  async simulateResidentReply(requestId: string, action: 'APPROVE' | 'DENY') {
    const request = await this.prisma.visitRequest.findUnique({
      where: { id: requestId },
      include: { assignedResident: true },
    });

    if (!request) {
      throw new BadRequestException('Request not found');
    }

    await this.applyResidentDecision({
      requestId: request.id,
      action,
      senderPhone: request.assignedResident.phone,
      providerMessageId: `sim-msg-${Date.now()}`,
      channel: DecisionChannel.WHATSAPP_BUTTON,
    });

    return {
      message: `Simulated resident reply '${action}' applied to request ${request.reference}`,
      requestId: request.id,
      status: action === 'APPROVE' ? VisitStatus.APPROVED : VisitStatus.DENIED,
    };
  }
}
