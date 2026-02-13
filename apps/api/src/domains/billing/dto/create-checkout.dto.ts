import { IsString, IsEnum, IsOptional } from 'class-validator';
import { BillingPeriod } from '../../../generated/prisma';

export class CreateCheckoutDto {
  @IsString()
  planId: string;

  @IsEnum(BillingPeriod)
  @IsOptional()
  billingPeriod?: BillingPeriod = BillingPeriod.MONTHLY;
}
