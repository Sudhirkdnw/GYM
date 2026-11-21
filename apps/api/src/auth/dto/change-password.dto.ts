import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!', description: 'Current password for verification' })
  currentPassword!: string;

  @ApiProperty({ example: 'NewSecretPassword123!', description: 'New password (min 8 chars)' })
  newPassword!: string;
}
