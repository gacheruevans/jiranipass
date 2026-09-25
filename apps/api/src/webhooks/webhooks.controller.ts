import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Headers,
  Body,
  HttpStatus,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { WebhooksService } from './webhooks.service';

@Controller('v1/webhooks/whatsapp')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Meta Webhook Subscription Verification (GET).
   */
  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const verifiedChallenge = this.webhooksService.verifyChallenge(mode, token, challenge);
    return res.status(HttpStatus.OK).send(verifiedChallenge);
  }

  /**
   * Meta Webhook Ingestion (POST).
   * Verifies X-Hub-Signature-256 against raw body buffer.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: any,
  ) {
    // In Express with raw body capturing, req.rawBody or Buffer.from(JSON.stringify(body))
    const rawBuffer = (req as any).rawBody || Buffer.from(JSON.stringify(body));

    const isValid = this.webhooksService.verifySignature(rawBuffer, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid X-Hub-Signature-256 webhook signature');
    }

    return this.webhooksService.handleIncomingWebhook(body);
  }

  /**
   * Development & Test helper endpoint to simulate a resident WhatsApp button reply.
   */
  @Post('simulate-reply')
  @HttpCode(HttpStatus.OK)
  async simulateReply(
    @Body() body: { requestId: string; action: 'APPROVE' | 'DENY' },
  ) {
    return this.webhooksService.simulateResidentReply(body.requestId, body.action);
  }
}
