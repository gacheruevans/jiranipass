import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { HouseholdsService } from './households.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { Role } from '@jiranipass/shared';
import { CreateHouseholdDto, EnrollResidentDto } from './dto/households.dto';

@Controller('v1')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HouseholdsController {
  constructor(private readonly householdsService: HouseholdsService) {}

  @Get('households')
  @Roles(Role.GUARD, Role.ESTATE_ADMIN, Role.SUPERVISOR, Role.SUPER_ADMIN)
  async searchHouseholds(
    @CurrentUser() user: AuthenticatedUser,
    @Query('query') query?: string,
  ) {
    return this.householdsService.searchHouseholds(user.estateId, query);
  }

  @Post('admin/households')
  @Roles(Role.ESTATE_ADMIN, Role.SUPER_ADMIN)
  async createHousehold(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.householdsService.createHousehold(user.estateId, dto.unitCode);
  }

  @Post('admin/enroll-resident')
  @Roles(Role.ESTATE_ADMIN, Role.SUPER_ADMIN)
  async enrollResident(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrollResidentDto,
  ) {
    return this.householdsService.enrollResident({
      estateId: user.estateId,
      householdId: dto.householdId,
      name: dto.name,
      phone: dto.phone,
      consentSource: dto.consentSource,
    });
  }

  @Get('admin/audit-events')
  @Roles(Role.ESTATE_ADMIN, Role.SUPER_ADMIN, Role.SUPERVISOR)
  async getAuditEvents(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.householdsService.getAuditEvents(
      user.estateId,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
