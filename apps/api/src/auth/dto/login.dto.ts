import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'owner@example.com', description: 'User registered email address' })
  email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!', description: 'Password' })
  password!: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Target organization ID (optional)' })
  organizationId?: string;
}
