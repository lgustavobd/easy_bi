import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private service: PlansService) {}

  @Get('public')
  publicList() {
    return this.service.publicList();
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user);
  }
}
