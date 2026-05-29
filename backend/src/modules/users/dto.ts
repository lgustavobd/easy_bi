import { IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8) password: string;
  @IsString() roleId: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsArray() sectorIds?: string[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() organizationId?: string;
  @IsOptional() @IsString() fromOrganizationId?: string;
  @IsOptional() @IsString() roleId?: string;
  @IsOptional() @IsString() status?: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  @IsOptional() @IsArray() sectorIds?: string[];
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) password: string;
}
