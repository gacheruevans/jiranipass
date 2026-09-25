import { Role, VisitStatus, VerificationMethod, ConsentSource } from './enums.js';

export interface CreateVisitRequestDto {
  householdId: string;
  visitorName: string;
  visitorPhone?: string;
  vehiclePlate?: string;
  purpose?: string;
  gateId: string;
  idempotencyKey?: string;
}

export interface CheckInDto {
  verificationMethod: VerificationMethod;
  notes?: string;
}

export interface CheckOutDto {
  notes?: string;
}

export interface SupervisorOverrideDto {
  supervisorPin: string;
  reason: string;
  verificationMethod: VerificationMethod;
}

export interface HouseholdSearchResult {
  id: string;
  unitCode: string;
  primaryResidentName: string;
  maskedPhone: string;
  isActive: boolean;
}

export interface VisitRequestResponse {
  id: string;
  estateId: string;
  reference: string;
  unitCode: string;
  visitorName: string;
  visitorPhone?: string | null;
  vehiclePlate?: string | null;
  purpose?: string | null;
  status: VisitStatus;
  createdAt: string;
  expiresAt: string;
  approvedUntil?: string | null;
  checkedInAt?: string | null;
  checkedOutAt?: string | null;
  assignedResidentName?: string | null;
  canAdmit: boolean;
  canCheckOut: boolean;
  canOverride: boolean;
}

export interface WhatsAppIncomingWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: 'interactive' | 'button' | 'text';
          interactive?: {
            type: 'button_reply';
            button_reply: {
              id: string;
              title: string;
            };
          };
          button?: {
            payload: string;
            text: string;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
          errors?: Array<{
            code: number;
            title: string;
            message: string;
          }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface SSEMessage {
  type: 'VISIT_UPDATED' | 'HEARTBEAT' | 'VISIT_CREATED';
  estateId: string;
  gateId?: string;
  data: VisitRequestResponse | { timestamp: string };
}
