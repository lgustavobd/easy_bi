import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSectorDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() organizationId?: string;
}

export class UpdateSectorDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
}
