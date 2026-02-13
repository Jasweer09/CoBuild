import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AppearancePayload {
  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  @IsString()
  headerColor?: string;

  @IsOptional()
  @IsString()
  headerTextColor?: string;

  @IsOptional()
  @IsString()
  botAvatar?: string;

  @IsOptional()
  @IsString()
  userAvatar?: string;

  @IsOptional()
  @IsString()
  chatBubbleColor?: string;

  @IsOptional()
  @IsString()
  position?: string;
}

export class UpdateAppearanceDto {
  @IsString()
  chatbotId: string;

  @ValidateNested()
  @Type(() => AppearancePayload)
  appearance: AppearancePayload;
}
