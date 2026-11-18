import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'owner@example.com', description: 'User normalized email address' })
  email!: string;

  @ApiProperty({ example: 'StrongP@ssw0rd!', description: 'Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)' })
  password!: string;

  @ApiProperty({ example: 'Alex', description: 'User first name' })
  firstName!: string;

  @ApiProperty({ example: 'Mercer', description: 'User last name' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'Titan Fitness Gym', description: 'Optional initial gym name' })
  gymName?: string;

  @ApiPropertyOptional({ example: 'titan-fitness', description: 'Optional gym slug' })
  slug?: string;
}
