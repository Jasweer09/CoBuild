import { IsString, IsNumber, Min } from 'class-validator';

export class CreateAddonCheckoutDto {
  @IsString()
  planId: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}
