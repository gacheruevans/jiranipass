import {
  IsString,
  IsNotEmpty,
  IsOptional,
  Length,
  IsEnum,
  Matches,
} from 'class-validator';
import {
  CreateVisitRequestDto as ICreateVisitRequestDto,
  CheckInDto as ICheckInDto,
  CheckOutDto as ICheckOutDto,
  SupervisorOverrideDto as ISupervisorOverrideDto,
  VerificationMethod,
} from '@jiranipass/shared';

export class CreateVisitRequestDto implements ICreateVisitRequestDto {
  @IsString()
  @IsNotEmpty()
  householdId: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 80)
  visitorName: string;

  @IsString()
  @IsOptional()
  @Length(7, 20)
  visitorPhone?: string;

  @IsString()
  @IsOptional()
  @Length(2, 20)
  vehiclePlate?: string;

  @IsString()
  @IsOptional()
  @Length(2, 120)
  purpose?: string;

  @IsString()
  @IsNotEmpty()
  gateId: string;

  @IsString()
  @IsOptional()
  idempotencyKey?: string;
}

export class CheckInDto implements ICheckInDto {
  @IsEnum(VerificationMethod)
  verificationMethod: VerificationMethod;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  notes?: string;
}

export class CheckOutDto implements ICheckOutDto {
  @IsString()
  @IsOptional()
  @Length(0, 255)
  notes?: string;
}

export class SupervisorOverrideDto implements ISupervisorOverrideDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  supervisorPin: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 500)
  reason: string;

  @IsEnum(VerificationMethod)
  verificationMethod: VerificationMethod;
}

export class RevokeVisitRequestDto {
  @IsString()
  @IsOptional()
  @Length(0, 255)
  reason?: string;
}
