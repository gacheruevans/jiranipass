import { IsString, IsNotEmpty, Length } from 'class-validator';

export class GuardLoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  pin: string;

  @IsString()
  @IsNotEmpty()
  gateId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;
}

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 64)
  password: string;
}
