import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class AgreementDraftDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({ maxLength: 200000 })
  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  content: string;
}
