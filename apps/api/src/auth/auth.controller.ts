import { Controller, Post, Body, Get, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from './current-user.decorator';
import { GuardLoginDto, AdminLoginDto } from './dto/auth.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('guard/login')
  @HttpCode(HttpStatus.OK)
  async loginGuard(@Body() body: GuardLoginDto) {
    return this.authService.loginGuard(body);
  }

  @Post('guard/end-shift')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async endShift(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.endGuardShift(user.shiftId!, user.userId);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  async loginAdmin(@Body() body: AdminLoginDto) {
    return this.authService.loginAdmin(body);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
