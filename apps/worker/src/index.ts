import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env', '../../.env'] });

import { prisma } from '@jiranipass/database';
import { WhatsAppClient } from './whatsapp-client.js';
import { MessageSendState, VisitStatus, SSEMessage } from '@jiranipass/shared';
import Redis from 'ioredis';

const whatsAppClient = new WhatsAppClient();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  retryStrategy: () => null,
});

redis.connect().catch(() => {
  // Silent fallback if Redis not running
});

function broadcastWorkerEvent(message: SSEMessage) {
  redis.publish('jiranipass:events', JSON.stringify(message)).catch(() => {});
}

/**
 * Polls and processes pending Outbox Events.
 */
async function processOutboxQueue() {
  try {
    const pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        deliveredAt: null,
        retryCount: { lt: 3 },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    for (const event of pendingEvents) {
      if (event.eventType === 'VISIT_REQUEST_CREATED') {
        const payload = event.payload as any;
        try {
          const nowStr = new Date(payload.createdAt).toLocaleTimeString('en-KE', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });

          const { messageId } = await whatsAppClient.sendVisitorAlertTemplate({
            recipientPhone: payload.recipientPhone,
            templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'estate_visitor_access_request',
            visitorName: payload.visitorName,
            unitCode: payload.unitCode,
            reference: payload.reference,
            timeStr: nowStr,
            approvePayload: payload.approvePayload,
            denyPayload: payload.denyPayload,
          });

          // Record message attempt in database
          await prisma.messageAttempt.create({
            data: {
              visitRequestId: payload.requestId,
              recipientPhone: payload.recipientPhone,
              templateName: process.env.WHATSAPP_TEMPLATE_NAME || 'estate_visitor_access_request',
              sendState: MessageSendState.SENT,
              providerMessageId: messageId,
            },
          });

          // Mark outbox event as delivered
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { deliveredAt: new Date() },
          });

          console.log(`[Worker] Outbox event ${event.id} delivered -> Meta ID ${messageId}`);
        } catch (sendError: any) {
          console.error(`[Worker] Error delivering outbox event ${event.id}:`, sendError.message);
          const nextRetry = event.retryCount + 1;
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              retryCount: nextRetry,
              lastError: sendError.message,
            },
          });

          if (nextRetry >= 3) {
            console.warn(`[Worker] Outbox event ${event.id} exceeded max retries. Marking request ${payload.requestId} as DELIVERY_FAILED`);
            const req = await prisma.visitRequest.findUnique({ where: { id: payload.requestId } });
            if (req && req.status === VisitStatus.PENDING) {
              await prisma.$transaction(async (tx) => {
                await tx.visitRequest.updateMany({
                  where: { id: req.id, status: VisitStatus.PENDING, version: req.version },
                  data: { status: VisitStatus.DELIVERY_FAILED, version: { increment: 1 } },
                });
                await tx.accessEvent.create({
                  data: {
                    visitRequestId: req.id,
                    actorId: req.guardId,
                    action: 'DELIVERY_FAILED',
                    gateId: req.gateId,
                    reason: `Template send failed after 3 attempts: ${sendError.message}`,
                    previousStatus: VisitStatus.PENDING,
                    newStatus: VisitStatus.DELIVERY_FAILED,
                  },
                });
              });

              const updatedReq = await prisma.visitRequest.findUnique({
                where: { id: req.id },
                include: { household: true, visitor: true, assignedResident: true },
              });
              if (updatedReq) {
                broadcastWorkerEvent({
                  type: 'VISIT_UPDATED',
                  estateId: updatedReq.estateId,
                  gateId: updatedReq.gateId,
                  data: {
                    id: updatedReq.id,
                    estateId: updatedReq.estateId,
                    reference: updatedReq.reference,
                    unitCode: updatedReq.household.unitCode,
                    visitorName: updatedReq.visitor.name,
                    visitorPhone: updatedReq.visitor.phone,
                    vehiclePlate: updatedReq.visitor.vehicleRegistration,
                    purpose: updatedReq.purpose,
                    status: updatedReq.status as unknown as VisitStatus,
                    createdAt: updatedReq.createdAt.toISOString(),
                    expiresAt: updatedReq.expiresAt.toISOString(),
                    approvedUntil: null,
                    checkedInAt: null,
                    checkedOutAt: null,
                    assignedResidentName: updatedReq.assignedResident.name,
                    canAdmit: false,
                    canCheckOut: false,
                    canOverride: true,
                  },
                });
              }
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[Worker] Outbox polling cycle error:', err.message);
  }
}

/**
 * Sweeps and transitions expired pending requests as well as un-admitted approved requests.
 */
async function processExpiredRequests() {
  try {
    // 1. Pending requests past expiration TTL
    const expiredPending = await prisma.visitRequest.findMany({
      where: {
        status: VisitStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: { household: true, visitor: true, assignedResident: true },
      take: 20,
    });

    for (const req of expiredPending) {
      await prisma.$transaction(async (tx) => {
        await tx.visitRequest.updateMany({
          where: { id: req.id, status: VisitStatus.PENDING, version: req.version },
          data: { status: VisitStatus.EXPIRED, version: { increment: 1 } },
        });

        await tx.accessEvent.create({
          data: {
            visitRequestId: req.id,
            actorId: req.guardId,
            action: 'EXPIRED',
            gateId: req.gateId,
            reason: 'Pending request timed out without resident response',
            previousStatus: VisitStatus.PENDING,
            newStatus: VisitStatus.EXPIRED,
          },
        });
      });

      broadcastWorkerEvent({
        type: 'VISIT_UPDATED',
        estateId: req.estateId,
        gateId: req.gateId,
        data: {
          id: req.id,
          estateId: req.estateId,
          reference: req.reference,
          unitCode: req.household.unitCode,
          visitorName: req.visitor.name,
          visitorPhone: req.visitor.phone,
          vehiclePlate: req.visitor.vehicleRegistration,
          purpose: req.purpose,
          status: VisitStatus.EXPIRED,
          createdAt: req.createdAt.toISOString(),
          expiresAt: req.expiresAt.toISOString(),
          approvedUntil: null,
          checkedInAt: null,
          checkedOutAt: null,
          assignedResidentName: req.assignedResident.name,
          canAdmit: false,
          canCheckOut: false,
          canOverride: true,
        },
      });

      console.log(`[Worker] Visit request ${req.reference} marked EXPIRED due to timeout`);
    }

    // 2. Approved requests past approvedUntil window that were not checked in
    const expiredApproved = await prisma.visitRequest.findMany({
      where: {
        status: VisitStatus.APPROVED,
        approvedUntil: { lt: new Date() },
      },
      include: { household: true, visitor: true, assignedResident: true },
      take: 20,
    });

    for (const req of expiredApproved) {
      await prisma.$transaction(async (tx) => {
        await tx.visitRequest.updateMany({
          where: { id: req.id, status: VisitStatus.APPROVED, version: req.version },
          data: { status: VisitStatus.EXPIRED, version: { increment: 1 } },
        });

        await tx.accessEvent.create({
          data: {
            visitRequestId: req.id,
            actorId: req.guardId,
            action: 'EXPIRED',
            gateId: req.gateId,
            reason: 'Approved window elapsed prior to physical check-in',
            previousStatus: VisitStatus.APPROVED,
            newStatus: VisitStatus.EXPIRED,
          },
        });
      });

      broadcastWorkerEvent({
        type: 'VISIT_UPDATED',
        estateId: req.estateId,
        gateId: req.gateId,
        data: {
          id: req.id,
          estateId: req.estateId,
          reference: req.reference,
          unitCode: req.household.unitCode,
          visitorName: req.visitor.name,
          visitorPhone: req.visitor.phone,
          vehiclePlate: req.visitor.vehicleRegistration,
          purpose: req.purpose,
          status: VisitStatus.EXPIRED,
          createdAt: req.createdAt.toISOString(),
          expiresAt: req.expiresAt.toISOString(),
          approvedUntil: req.approvedUntil?.toISOString() || null,
          checkedInAt: null,
          checkedOutAt: null,
          assignedResidentName: req.assignedResident.name,
          canAdmit: false,
          canCheckOut: false,
          canOverride: true,
        },
      });

      console.log(`[Worker] Approved visit request ${req.reference} marked EXPIRED due to window timeout`);
    }
  } catch (err: any) {
    console.error('[Worker] Expiry check error:', err.message);
  }
}

/**
 * Daily retention purge: Sanitizes routine visitor PII older than estate's configured retention days (Kenya ODPC compliance).
 */
async function processDataRetentionPurge() {
  try {
    const estates = await prisma.estate.findMany();

    for (const estate of estates) {
      const retentionDays = estate.visitorRetentionDays || 90;
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      // Anonymize visitor PII for completed/expired routine visits past retention threshold
      const expiredVisits = await prisma.visitRequest.findMany({
        where: {
          estateId: estate.id,
          createdAt: { lt: cutoffDate },
          status: { in: [VisitStatus.CHECKED_OUT, VisitStatus.EXPIRED, VisitStatus.DENIED] },
        },
        select: { visitorId: true },
        take: 50,
      });

      if (expiredVisits.length > 0) {
        const visitorIds = [...new Set(expiredVisits.map((v) => v.visitorId))];
        const updated = await prisma.visitor.updateMany({
          where: { id: { in: visitorIds }, phone: { not: null } },
          data: {
            phone: null,
            vehicleRegistration: null,
          },
        });
        if (updated.count > 0) {
          console.log(`[Worker] Anonymized ${updated.count} visitor records in ${estate.name} older than ${retentionDays} days`);
        }
      }
    }
  } catch (err: any) {
    console.error('[Worker] Retention purge error:', err.message);
  }
}

async function startWorker() {
  console.log('🚀 JiraniPass Background Worker Engine started.');
  console.log('📦 Monitoring Outbox queue, request expiry, and data retention...');

  // Outbox loop every 2 seconds
  setInterval(processOutboxQueue, 2000);

  // Expiry sweep every 10 seconds
  setInterval(processExpiredRequests, 10000);

  // Retention sweep once every 12 hours
  setInterval(processDataRetentionPurge, 12 * 60 * 60 * 1000);
}

startWorker();
