import { IsEmail, IsIn, IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAccessRequestDto {
  @IsString() @MinLength(2) requesterName: string;
  @IsEmail() requesterEmail: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(2) companyName: string;
  @IsOptional() @IsString() document?: string;
  @IsOptional() @IsString() requestedPlanId?: string;
  @IsOptional() @IsString() message?: string;
}

export class ReviewAccessRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() adminNotes?: string;
  @IsOptional() @IsString() planId?: string;
  @IsOptional() @IsString() organizationName?: string;
  @IsOptional() @IsString() document?: string;
  @IsOptional() @IsString() userName?: string;
  @IsOptional() @IsEmail() userEmail?: string;
  @IsOptional() @IsNumberString() trialDays?: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}
