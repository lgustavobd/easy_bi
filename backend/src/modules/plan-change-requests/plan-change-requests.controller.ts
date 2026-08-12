import { Body, Controller, Get, Headers, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreatePlanChangeRequestDto, ReviewPlanChangeRequestDto } from './dto';
import { PlanChangeRequestsService } from './plan-change-requests.service';

@UseGuards(JwtAuthGuard)
@Controller('plan-change-requests')
export class PlanChangeRequestsController {
  constructor(private service: PlanChangeRequestsService) {}

  @Post()
  create(@Body() dto: CreatePlanChangeRequestDto, @CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.create(dto, user, organizationId);
  }

  @Get()
  list(@CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.list(user, organizationId);
  }

  @Get('impact/:planId')
  impact(@Param('planId') planId: string, @CurrentUser() user: any, @Headers('x-organization-id') organizationId?: string) {
    return this.service.impact(planId, user, organizationId);
  }

  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewPlanChangeRequestDto, @CurrentUser() user: any) {
    return this.service.review(id, dto, user);
  }
}
