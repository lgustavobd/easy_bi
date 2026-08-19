import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Response } from 'express';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { DatasetsService } from './datasets.service';

const uploadDir = join(process.cwd(), 'uploads', 'tmp');
const datasetUploadMaxBytes = Number(process.env.DATASET_UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_, __, cb) => {
      if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (_, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`);
    }
  }),
  limits: { fileSize: datasetUploadMaxBytes },
  fileFilter: (_, file, cb) => {
    if (/\.(csv|xlsx|xls)$/i.test(file.originalname)) return cb(null, true);
    return cb(new BadRequestException('Formato inválido. Envie CSV, XLS ou XLSX.'), false);
  }
});

@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@Controller('datasets')
export class DatasetsController {
  constructor(private service: DatasetsService) {}

  @Post('upload')
  @Permissions('dataset.upload')
  @UseInterceptors(uploadInterceptor)
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
    @CurrentOrganization() org: string,
    @Body('name') name?: string,
    @Body('templateId') templateId?: string,
    @Body('saveTemplate') saveTemplate?: string,
    @Body('templateName') templateName?: string,
    @Body('sectorId') sectorId?: string,
    @Body('sheetName') sheetName?: string
  ) {
    return this.service.upload(file, user, org, name, { templateId, saveTemplate: saveTemplate === 'true', templateName, sectorId, sheetName });
  }

  @Post('workbook-sheets')
  @Permissions('dataset.upload')
  @UseInterceptors(uploadInterceptor)
  workbookSheets(@UploadedFile() file: Express.Multer.File) {
    return this.service.workbookSheets(file);
  }

  @Post('join-model')
  @Permissions('dataset.upload')
  createJoinModel(@Body() payload: any, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.createJoinModel(payload, org, user);
  }

  @Get()
  @Permissions('dashboard.view')
  list(@CurrentOrganization() org: string, @CurrentUser() user: any, @Query('sectorId') sectorId?: string, @Query('summary') summary?: string) {
    return this.service.list(org, user, sectorId, { summary: summary === 'true' });
  }

  @Get(':id')
  @Permissions('dashboard.view')
  get(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.get(id, org, user);
  }

  @Post(':id/import-template')
  @Permissions('dataset.upload')
  ensureImportTemplate(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.ensureImportTemplate(id, org, user);
  }


  @Get(':id/rows')
  @Permissions('dashboard.view')
  rows(
    @Param('id') id: string,
    @CurrentOrganization() org: string,
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('column') column?: string
  ) {
    return this.service.rows(id, org, {
      page: Number(page || 1),
      pageSize: Number(pageSize || 50),
      search,
      column
    }, user);
  }

  @Get(':id/template-csv')
  @Permissions('dashboard.view')
  async templateCsv(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.service.templateCsv(id, org, user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="modelo-dataset-${id}.csv"`);
    return res.send(csv);
  }

  @Post(':id/replace-file')
  @Permissions('dataset.reprocess')
  @UseInterceptors(uploadInterceptor)
  replaceFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentOrganization() org: string, @CurrentUser() user: any, @Body('sheetName') sheetName?: string) {
    return this.service.replaceRowsFromFile(id, file, user, org, sheetName);
  }

  @Post(':id/append-file')
  @Permissions('dataset.reprocess')
  @UseInterceptors(uploadInterceptor)
  appendFile(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentOrganization() org: string, @CurrentUser() user: any, @Body('sheetName') sheetName?: string) {
    return this.service.appendRowsFromFile(id, file, user, org, sheetName);
  }

  @Post(':id/patch-rows')
  @Permissions('dataset.reprocess')
  @UseInterceptors(uploadInterceptor)
  patchRows(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentOrganization() org: string,
    @CurrentUser() user: any,
    @Body('matchColumn') matchColumn?: string,
    @Body('sheetName') sheetName?: string
  ) {
    return this.service.patchRowsFromFile(id, file, user, org, matchColumn, sheetName);
  }

  @Post(':id/reload-join-model')
  @Permissions('dataset.reprocess')
  reloadJoinModel(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.reloadJoinModel(id, org, user);
  }

  @Delete(':id')
  @Permissions('dataset.reprocess')
  remove(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.remove(id, org, user);
  }

  @Post(':id/reprocess')
  @Permissions('dataset.reprocess')
  reprocess(@Param('id') id: string, @CurrentOrganization() org: string, @CurrentUser() user: any) {
    return this.service.reprocess(id, org, user);
  }
}
