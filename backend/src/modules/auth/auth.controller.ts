import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto, RefreshTokenDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('login') login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
  @Post('refresh') refresh(@Body() dto: RefreshTokenDto, @Req() req: any) {
    return this.auth.refresh(dto.refreshToken, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }
  @UseGuards(JwtAuthGuard) @Post('logout') logout(@CurrentUser() user: any) {
    return this.auth.logout(user.id);
  }
  @UseGuards(JwtAuthGuard) @Get('me') me(@CurrentUser() user: any) {
    return this.auth.me(user.id);
  }

  @UseGuards(JwtAuthGuard) @Post('change-password') changePassword(@CurrentUser() user: any, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.id, dto);
  }
}
