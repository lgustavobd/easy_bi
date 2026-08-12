import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AccessRequestsService } from './access-requests.service';
import { CreateAccessRequestDto, ReviewAccessRequestDto } from './dto';

@Controller('access-requests')
export class AccessRequestsController {
  constructor(private service: AccessRequestsService) {}

  @Post()
  create(@Body() dto: CreateAccessRequestDto) {
    return this.service.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewAccessRequestDto, @CurrentUser() user: any) {
    return this.service.review(id, dto, user);
  }
}
