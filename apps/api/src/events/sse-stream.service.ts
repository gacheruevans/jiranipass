import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { SSEMessage, VisitRequestResponse } from '@jiranipass/shared';
import Redis from 'ioredis';

const REDIS_CHANNEL = 'jiranipass:events';

@Injectable()
export class SseStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SseStreamService.name);
  private readonly eventSubject = new Subject<SSEMessage>();
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private isRedisConnected = false;

  onModuleInit() {
    this.initRedis();
  }

  onModuleDestroy() {
    this.subscriber?.disconnect();
    this.publisher?.disconnect();
  }

  private initRedis() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    const password = process.env.REDIS_PASSWORD || undefined;

    try {
      this.publisher = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't crash if Redis is unavailable in local dev
      });

      this.subscriber = new Redis({
        host,
        port,
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      Promise.all([this.publisher.connect(), this.subscriber.connect()])
        .then(() => {
          this.isRedisConnected = true;
          this.logger.log('Connected to Redis PubSub for real-time SSE cluster broadcasting');

          this.subscriber!.subscribe(REDIS_CHANNEL);
          this.subscriber!.on('message', (channel, message) => {
            if (channel === REDIS_CHANNEL) {
              try {
                const parsed: SSEMessage = JSON.parse(message);
                this.eventSubject.next(parsed);
              } catch (e) {
                this.logger.warn('Failed to parse incoming Redis PubSub event message');
              }
            }
          });
        })
        .catch(() => {
          this.isRedisConnected = false;
          this.logger.warn('Redis unavailable. Falling back to local in-memory event stream.');
        });
    } catch {
      this.isRedisConnected = false;
      this.logger.warn('Redis client initialization failed. Using in-memory event bus.');
    }
  }

  /**
   * Broadcast an event to all connected guard streams across nodes.
   */
  broadcast(message: SSEMessage) {
    if (this.isRedisConnected && this.publisher) {
      this.publisher.publish(REDIS_CHANNEL, JSON.stringify(message)).catch((err) => {
        this.logger.warn(`Redis publish error: ${err.message}. Emitting locally.`);
        this.eventSubject.next(message);
      });
    } else {
      this.eventSubject.next(message);
    }
  }

  /**
   * Broadcast an update for a specific visit request.
   */
  broadcastVisitUpdate(estateId: string, visit: VisitRequestResponse, gateId?: string) {
    this.broadcast({
      type: 'VISIT_UPDATED',
      estateId,
      gateId,
      data: visit,
    });
  }

  /**
   * Subscribe to events for a specific estate and optionally a specific gate.
   * Includes 20-second heartbeat to prevent proxy and network timeout disconnects.
   */
  getEventStream(estateId: string, gateId?: string): Observable<{ data: SSEMessage }> {
    const liveEvents = this.eventSubject.asObservable().pipe(
      filter((msg) => {
        if (msg.estateId !== estateId) return false;
        if (gateId && msg.gateId && msg.gateId !== gateId) return false;
        return true;
      }),
      map((msg) => ({ data: msg })),
    );

    const heartbeats = interval(20000).pipe(
      map(() => ({
        data: {
          type: 'HEARTBEAT' as const,
          estateId,
          gateId,
          data: { timestamp: new Date().toISOString() },
        },
      })),
    );

    return merge(liveEvents, heartbeats);
  }
}
