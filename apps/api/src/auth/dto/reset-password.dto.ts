import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a8f5b4c2...', description: 'Password reset token received via secure channel' })
  token!: string;

  @ApiProperty({ example: 'NewStrongP@ssw0rd!', description: 'New password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)' })
  newPassword!: string;
}
