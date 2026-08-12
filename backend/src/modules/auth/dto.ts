import { IsEmail, IsString, MinLength } from 'class-validator';
export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MinLength(6) password: string;
}
export class RefreshTokenDto {
  @IsString() refreshToken: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(6) currentPassword: string;
  @IsString() @MinLength(8) newPassword: string;
  @IsString() @MinLength(8) confirmPassword: string;
}
