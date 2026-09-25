import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Sse,
  MessageEvent,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { VisitRequestsService } from './visit-requests.service';
import { SseStreamService } from '../events/sse-stream.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import {
  CreateVisitRequestDto,
  CheckInDto,
  CheckOutDto,
  SupervisorOverrideDto,
  Role,
  VisitStatus,
} from '@jiranipass/shared';

@Controller('v1/visit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VisitRequestsController {
  constructor(
    private readonly visitRequestsService: VisitRequestsService,
    private readonly sseService: SseStreamService,
  ) {}

  @Post()
  @Roles(Role.GUARD)
  async createRequest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVisitRequestDto,
  ) {
    return this.visitRequestsService.createRequest(
      {
        userId: user.userId,
        estateId: user.estateId,
        gateId: user.gateId,
        deviceId: user.deviceId,
      },
      dto,
    );
  }

  @Get()
  @Roles(Role.GUARD, Role.ESTATE_ADMIN, Role.SUPERVISOR, Role.SUPER_ADMIN)
  async listRequests(
    @CurrentUser() user: AuthenticatedUser,
    @Query('gateId') gateId?: string,
    @Query('status') status?: VisitStatus,
    @Query('limit') limit?: string,
  ) {
    return this.visitRequestsService.listRequests(user.estateId, {
      gateId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Sse('stream')
  @Roles(Role.GUARD, Role.ESTATE_ADMIN, Role.SUPERVISOR)
  sseStream(
    @CurrentUser() user: AuthenticatedUser,
    @Query('gateId') gateId?: string,
  ): Observable<MessageEvent> {
    return this.sseService.getEventStream(user.estateId, gateId || user.gateId) as unknown as Observable<MessageEvent>;
  }

  @Get(':id')
  @Roles(Role.GUARD, Role.ESTATE_ADMIN, Role.SUPERVISOR, Role.SUPER_ADMIN)
  async getRequestById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.visitRequestsService.getRequestById(user.estateId, id);
  }

  @Post(':id/check-in')
  @Roles(Role.GUARD)
  async checkInVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CheckInDto,
  ) {
    return this.visitRequestsService.checkInVisitor(
      {
        userId: user.userId,
        estateId: user.estateId,
        gateId: user.gateId,
        deviceId: user.deviceId,
      },
      id,
      dto,
    );
  }

  @Post(':id/check-out')
  @Roles(Role.GUARD)
  async checkOutVisitor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CheckOutDto,
  ) {
    return this.visitRequestsService.checkOutVisitor(
      {
        userId: user.userId,
        estateId: user.estateId,
        gateId: user.gateId,
        deviceId: user.deviceId,
      },
      id,
      dto,
    );
  }

  @Post(':id/override')
  @Roles(Role.GUARD, Role.SUPERVISOR)
  async supervisorOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SupervisorOverrideDto,
  ) {
    return this.visitRequestsService.supervisorOverride(
      {
        userId: user.userId,
        estateId: user.estateId,
        gateId: user.gateId,
        deviceId: user.deviceId,
      },
      id,
      dto,
    );
  }
}
