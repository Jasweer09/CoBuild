import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class SelectPagesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  selectedPageIds: string[];
}
