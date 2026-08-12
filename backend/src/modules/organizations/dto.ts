import { IsOptional, IsString, MinLength } from 'class-validator';
export class CreateOrganizationDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() document?: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsString() initialSectors?: string;
  @IsOptional() themeConfig?: Record<string, unknown>;
}
export class UpdateOrganizationDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() document?: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  @IsOptional() themeConfig?: Record<string, unknown>;
}
