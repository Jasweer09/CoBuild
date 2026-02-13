import { IsString } from 'class-validator';

export class AddCustomDomainDto {
  @IsString()
  fullDomain: string;
}
