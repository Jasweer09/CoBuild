import { IsString, IsEnum, IsOptional } from 'class-validator';
import { BillingPeriod } from '../../../generated/prisma';

export class UpdateSubscriptionDto {
  @IsString()
  @IsOptional()
  planId?: string;

  @IsEnum(BillingPeriod)
  @IsOptional()
  billingPeriod?: BillingPeriod;
}
