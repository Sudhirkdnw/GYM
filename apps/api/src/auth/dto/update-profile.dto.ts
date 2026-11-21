import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Sudhir', description: 'User first name' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Kumar', description: 'User last name' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'sudhirkdnw@gmail.com', description: 'User email address' })
  email?: string;

  @ApiPropertyOptional({ example: '+919876543210', description: 'User phone number' })
  phone?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/...', description: 'Avatar image URL' })
  avatarUrl?: string;
}
