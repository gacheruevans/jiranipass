export interface SendTemplateParams {
  recipientPhone: string;
  templateName: string;
  visitorName: string;
  unitCode: string;
  reference: string;
  timeStr: string;
  approvePayload: string;
  denyPayload: string;
}

export class WhatsAppClient {
  private readonly graphApiVersion: string;
  private readonly phoneNumberId: string;
  private readonly systemUserToken: string;

  constructor() {
    this.graphApiVersion = process.env.META_GRAPH_API_VERSION || 'v20.0';
    this.phoneNumberId = process.env.META_PHONE_NUMBER_ID || '';
    this.systemUserToken = process.env.META_SYSTEM_USER_TOKEN || '';
  }

  isConfigured(): boolean {
    return Boolean(
      this.phoneNumberId &&
      this.systemUserToken &&
      !this.systemUserToken.includes('your_permanent') &&
      !this.phoneNumberId.includes('your_whatsapp'),
    );
  }

  /**
   * Dispatches WhatsApp utility template message to Meta Cloud API.
   * If running in local development mode without production Meta credentials,
   * simulates delivery and logs formatted resident message.
   */
  async sendVisitorAlertTemplate(params: SendTemplateParams): Promise<{ messageId: string }> {
    const isProd = this.isConfigured();

    if (!isProd) {
      const simulatedMessageId = `wamid.SIMULATED_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      console.log('\n============================================================');
      console.log(`📱 [WHATSAPP OUTBOX DISPATCH (SIMULATED DEV)]`);
      console.log(`To: ${params.recipientPhone}`);
      console.log(`Template: ${params.templateName}`);
      console.log(`------------------------------------------------------------`);
      console.log(`Estate Visitor Request [${params.reference}]`);
      console.log(`${params.visitorName} is at the main gate asking to visit ${params.unitCode} at ${params.timeStr}.`);
      console.log(`Do you expect this visitor?`);
      console.log(`[🔘 APPROVE] -> Payload: ${params.approvePayload}`);
      console.log(`[🔘 DENY]    -> Payload: ${params.denyPayload}`);
      console.log(`------------------------------------------------------------`);
      console.log(`Simulated Meta Message ID: ${simulatedMessageId}`);
      console.log('============================================================\n');

      return { messageId: simulatedMessageId };
    }

    // Production Meta Graph API Call
    const url = `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`;

    // Strip leading '+' for Meta recipient wa_id
    const recipientWaId = params.recipientPhone.replace('+', '');

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientWaId,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: params.visitorName },
              { type: 'text', text: params.unitCode },
              { type: 'text', text: params.timeStr },
            ],
          },
          {
            type: 'button',
            sub_type: 'quick_reply',
            index: '0',
            parameters: [{ type: 'payload', payload: params.approvePayload }],
          },
          {
            type: 'button',
            sub_type: 'quick_reply',
            index: '1',
            parameters: [{ type: 'payload', payload: params.denyPayload }],
          },
        ],
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.systemUserToken}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Meta Cloud API Error (${response.status}): ${JSON.stringify(data)}`);
    }

    const messageId = data.messages?.[0]?.id || `wamid.${Date.now()}`;
    return { messageId };
  }
}
