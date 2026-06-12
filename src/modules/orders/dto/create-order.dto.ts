import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class OrderPracticeInputDto {
  @ApiProperty({ description: 'Id de la practica del catalogo' })
  @IsInt()
  @Min(1)
  practiceId!: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  includeInReport?: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  authorizationCode?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateOrderDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  patientId!: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  insurerId!: number;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  insuranceAffiliateNumber?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  referringDoctorId?: number;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Solo se usa si referringDoctorId no se proporciona',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  referringDoctorName?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  referringDoctorMp?: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  diagnosis?: string;

  @ApiProperty({ enum: ['ambulatorio', 'internacion', 'urgencia'] })
  @IsIn(['ambulatorio', 'internacion', 'urgencia'])
  origin!: 'ambulatorio' | 'internacion' | 'urgencia';

  @ApiProperty({ default: false })
  @IsBoolean()
  isUrgent!: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiProperty({
    type: [OrderPracticeInputDto],
    description: 'Lista de practicas a incluir. Minimo 1.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((p: OrderPracticeInputDto) => p.practiceId)
  @ValidateNested({ each: true })
  @Type(() => OrderPracticeInputDto)
  practices!: OrderPracticeInputDto[];
}
