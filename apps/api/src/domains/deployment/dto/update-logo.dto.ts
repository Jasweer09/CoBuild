import { IsString } from 'class-validator';

export class UpdateLogoDto {
  @IsString()
  logoUrl: string;
}
