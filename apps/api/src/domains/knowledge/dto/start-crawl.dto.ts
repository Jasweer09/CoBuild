import {
  IsString,
  IsUrl,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { PageType } from '../../../generated/prisma';

export class StartCrawlDto {
  @IsString()
  chatbotId: string;

  @IsUrl()
  url: string;

  @IsOptional()
  @IsEnum(PageType)
  pageType?: PageType;

  @IsOptional()
  @IsInt()
  @Min(-1)
  maxDepth?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  confirmedLimit?: number;
}
