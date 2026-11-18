import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({ example: 'a8f5b4...', description: 'Optional refresh token if not using HttpOnly cookies' })
  refreshToken?: string;
}
