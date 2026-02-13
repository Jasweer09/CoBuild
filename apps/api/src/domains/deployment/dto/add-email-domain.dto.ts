import { IsString } from 'class-validator';

export class AddEmailDomainDto {
  @IsString()
  domain: string;
}
