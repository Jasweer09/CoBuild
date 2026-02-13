import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateChatbotDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  aiModel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  temperature?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  initialMessage?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suggestedMessages?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
