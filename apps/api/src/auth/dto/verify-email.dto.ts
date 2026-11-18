import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ example: 'b9e7c3...', description: 'Email verification token' })
  token!: string;
}
