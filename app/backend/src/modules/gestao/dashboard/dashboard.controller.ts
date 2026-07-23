import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequireQualquerPermissao } from '../../../common/rbac/require-qualquer-permissao.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DashboardService } from './dashboard.service';

const dataOperacaoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dataOperacao deve ser YYYY-MM-DD')
  .optional();

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

@SkipThrottle()
@Controller('gestao/dashboard')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequireQualquerPermissao('COMPRAS_PROGRAMADAS_LER', 'DISPONIBILIDADE_LER')
  async resumo(@Query('dataOperacao', new ZodValidationPipe(dataOperacaoSchema)) dataOperacao?: string) {
    return this.service.resumoDia(dataOperacao ?? hojeISO());
  }
}
