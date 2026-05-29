import { IsOptional, IsString, MinLength } from 'class-validator';
export class ImportTemplateDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() sectorId?: string;
  columnMapping: Record<string, unknown>;
  detectedTypes: Record<string, unknown>;
  metrics: unknown[];
  dimensions: unknown[];
  @IsOptional() transformationRules?: Record<string, unknown>;
  @IsOptional() localeConfig?: Record<string, unknown>;
}
