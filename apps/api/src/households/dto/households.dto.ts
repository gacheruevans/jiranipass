import { IsString, IsNotEmpty, Length, IsOptional, IsEnum } from 'class-validator';
import { ConsentSource } from '@jiranipass/shared';

export class CreateHouseholdDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 30)
  unitCode: string;
}

export class EnrollResidentDto {
  @IsString()
  @IsNotEmpty()
  householdId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(7, 20)
  phone: string;

  @IsEnum(ConsentSource)
  @IsOptional()
  consentSource?: ConsentSource;
}
