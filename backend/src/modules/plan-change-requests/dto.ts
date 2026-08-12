import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreatePlanChangeRequestDto {
  @IsString() requestedPlanId: string;
  @IsOptional() @IsString() reason?: string;
}

export class ReviewPlanChangeRequestDto {
  @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() adminNotes?: string;
}
