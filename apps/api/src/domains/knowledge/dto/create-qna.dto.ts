import {
  IsString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateQnaDto {
  @IsString()
  chatbotId: string;

  @IsString()
  question: string;

  @IsString()
  answer: string;
}

class QnaPairItem {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class BulkCreateQnaDto {
  @IsString()
  chatbotId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => QnaPairItem)
  pairs: QnaPairItem[];
}
