import { BadRequestException, Body, Controller, Delete, Get, Headers, Param, Post, Put, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto';

const brandUploadDir = join(process.cwd(), 'uploads', 'public', 'organizations');
const brandImageUploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_, __, cb) => {
      if (!existsSync(brandUploadDir)) mkdirSync(brandUploadDir, { recursive: true });
      cb(null, brandUploadDir);
    },
    filename: (_, file, cb) => {
      const extension = file.originalname.match(/\.(png|jpe?g|webp)$/i)?.[0]?.toLowerCase() || '.png';
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (/\.(png|jpe?g|webp)$/i.test(file.originalname) && /^image\/(png|jpe?g|webp)$/i.test(file.mimetype)) return cb(null, true);
    return cb(new BadRequestException('Formato invalido. Envie PNG, JPG ou WEBP ate 2MB.'), false);
  }
});

@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Post()
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: any) {
    return this.service.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: any) {
    return this.service.list(user);
  }

  @Get('summary')
  summary(@CurrentUser() user: any) {
    return this.service.summary(user);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.get(id, user);
  }

  @Post(':id/brand-image')
  @UseInterceptors(brandImageUploadInterceptor)
  uploadBrandImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: any, @Headers('x-organization-id') currentOrg?: string) {
    return this.service.uploadBrandImage(id, file, user, currentOrg);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOrganizationDto, @CurrentUser() user: any, @Headers('x-organization-id') currentOrg?: string) {
    return this.service.update(id, dto, user, currentOrg);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user);
  }
}
