import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDashboardDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  sectorId?: string;

  @IsOptional()
  @IsEnum(['LIGHT', 'DARK', 'CORPORATE'])
  theme?: 'LIGHT' | 'DARK' | 'CORPORATE';

  @IsOptional()
  layoutConfig?: Record<string, unknown>;

  @IsOptional()
  filterConfig?: Record<string, unknown>;
}

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['LIGHT', 'DARK', 'CORPORATE'])
  theme?: 'LIGHT' | 'DARK' | 'CORPORATE';

  @IsOptional()
  layoutConfig?: Record<string, unknown>;

  @IsOptional()
  filterConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class WidgetDto {
  @IsEnum(['KPI', 'BAR_CHART', 'LINE_CHART', 'DONUT_CHART', 'TABLE', 'MAP'])
  type: 'KPI' | 'BAR_CHART' | 'LINE_CHART' | 'DONUT_CHART' | 'TABLE' | 'MAP';

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  datasetId?: string;

  @IsOptional()
  @IsString()
  metricColumn?: string;

  @IsOptional()
  @IsString()
  dimensionColumn?: string;

  @IsOptional()
  @IsArray()
  tableColumns?: string[];

  @IsOptional()
  @IsEnum(['SUM', 'AVG', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'])
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX';

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  positionConfig?: Record<string, unknown>;

  @IsOptional()
  styleConfig?: Record<string, unknown>;
}

export class DashboardDataPreviewDto {
  @IsOptional()
  @IsString()
  datasetId?: string;

  @IsOptional()
  @IsString()
  metricColumn?: string;

  @IsOptional()
  @IsString()
  dimensionColumn?: string;

  @IsOptional()
  @IsArray()
  tableColumns?: string[];

  @IsOptional()
  @IsEnum(['SUM', 'AVG', 'COUNT', 'DISTINCT_COUNT', 'MIN', 'MAX'])
  aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'DISTINCT_COUNT' | 'MIN' | 'MAX';

  @IsOptional()
  filters?: Record<string, unknown>[];

  @IsOptional()
  limit?: number;
}

export class DashboardDataPreviewBatchDto {
  @IsOptional()
  @IsArray()
  items?: DashboardDataPreviewDto[];
}

export class FilterOptionsDto {
  @IsString()
  datasetId: string;

  @IsString()
  column: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  filters?: Record<string, unknown>[];

  @IsOptional()
  limit?: number;
}
