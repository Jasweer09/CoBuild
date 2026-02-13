import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateQnaDto {
  @IsOptional()
  @IsString()
  question?: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
