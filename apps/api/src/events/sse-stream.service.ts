import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { SSEMessage, VisitRequestResponse } from '@jiranipass/shared';

@Injectable()
export class SseStreamService {
  private readonly eventSubject = new Subject<SSEMessage>();

  /**
   * Broadcast an event to all connected guard streams.
   */
  broadcast(message: SSEMessage) {
    this.eventSubject.next(message);
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
   */
  getEventStream(estateId: string, gateId?: string): Observable<{ data: SSEMessage }> {
    return this.eventSubject.asObservable().pipe(
      filter((msg) => {
        if (msg.estateId !== estateId) return false;
        if (gateId && msg.gateId && msg.gateId !== gateId) return false;
        return true;
      }),
      map((msg) => ({ data: msg })),
    );
  }
}
