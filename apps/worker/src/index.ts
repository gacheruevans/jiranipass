import * as dotenv from 'dotenv';
dotenv.config({ path: ['.env', '../../.env'] });

import { prisma } from '@jiranipass/database';
import { WhatsAppClient } from './whatsapp-client.js';
import { MessageSendState, VisitStatus } from '@jiranipass/shared';

const whatsAppClient = new WhatsAppClient();

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
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              retryCount: { increment: 1 },
              lastError: sendError.message,
            },
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[Worker] Outbox polling cycle error:', err.message);
  }
}

/**
 * Sweeps and transitions expired pending requests.
 */
async function processExpiredRequests() {
  try {
    const expired = await prisma.visitRequest.findMany({
      where: {
        status: VisitStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      take: 20,
    });

    for (const req of expired) {
      await prisma.$transaction(async (tx) => {
        await tx.visitRequest.update({
          where: { id: req.id },
          data: { status: VisitStatus.EXPIRED },
        });

        await tx.accessEvent.create({
          data: {
            visitRequestId: req.id,
            actorId: req.guardId,
            action: 'EXPIRED',
            gateId: req.gateId,
            previousStatus: VisitStatus.PENDING,
            newStatus: VisitStatus.EXPIRED,
          },
        });
      });
      console.log(`[Worker] Visit request ${req.reference} marked EXPIRED due to timeout`);
    }
  } catch (err: any) {
    console.error('[Worker] Expiry check error:', err.message);
  }
}

/**
 * Daily retention purge: Cleans routine visitor logs older than 90 days (Kenya ODPC compliance).
 */
async function processDataRetentionPurge() {
  try {
    const retentionDays = parseInt(process.env.DEFAULT_DATA_RETENTION_DAYS || '90', 10);
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const deleted = await prisma.visitRequest.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        status: { in: [VisitStatus.CHECKED_OUT, VisitStatus.EXPIRED, VisitStatus.DENIED] },
      },
    });

    if (deleted.count > 0) {
      console.log(`[Worker] Purged ${deleted.count} routine visit records older than ${retentionDays} days`);
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
