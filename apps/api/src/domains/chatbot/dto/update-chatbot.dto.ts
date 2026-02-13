import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsEnum,
  IsObject,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { ChatbotStatus } from '../../../generated/prisma';

export class UpdateChatbotDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

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
  @IsObject()
  appearance?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  voiceInputEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  voiceOutputEnabled?: boolean;

  @IsOptional()
  @IsString()
  ttsEngine?: string;

  @IsOptional()
  @IsString()
  ttsVoiceId?: string;

  @IsOptional()
  @IsBoolean()
  autoSpeakResponses?: boolean;

  @IsOptional()
  @IsBoolean()
  showCitations?: boolean;

  @IsOptional()
  @IsBoolean()
  rateLimitEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  rateLimitMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  rateLimitWindowMinutes?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rateLimitErrorMessage?: string;

  @IsOptional()
  @IsBoolean()
  handoffEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handoffCategories?: string[];

  @IsOptional()
  @IsString()
  handoffEmailMessage?: string;

  @IsOptional()
  @IsBoolean()
  leadCaptureEnabled?: boolean;

  @IsOptional()
  @IsEnum(ChatbotStatus)
  status?: ChatbotStatus;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  embedAllowedDomains?: string[];
}
