import { IsString } from 'class-validator';

export class UpsertTextTrainingDto {
  @IsString()
  chatbotId: string;

  @IsString()
  content: string;
}
