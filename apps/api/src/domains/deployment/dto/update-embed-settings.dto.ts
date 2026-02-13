import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class UpdateEmbedSettingsDto {
  @IsString()
  chatbotId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  embedAllowedDomains?: string[];

  @IsOptional()
  @IsBoolean()
  passwordProtected?: boolean;

  @IsOptional()
  @IsString()
  password?: string;
}
