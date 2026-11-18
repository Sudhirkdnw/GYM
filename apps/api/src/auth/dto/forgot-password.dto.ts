import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'owner@example.com', description: 'User registered email address' })
  email!: string;
}
