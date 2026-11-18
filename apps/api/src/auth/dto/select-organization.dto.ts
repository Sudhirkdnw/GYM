import { ApiProperty } from '@nestjs/swagger';

export class SelectOrganizationDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', description: 'Organization UUID' })
  organizationId!: string;
}
