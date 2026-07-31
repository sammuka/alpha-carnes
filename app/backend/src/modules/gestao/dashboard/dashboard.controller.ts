import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequireQualquerPermissao } from '../../../common/rbac/require-qualquer-permissao.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DashboardService } from './dashboard.service';

const resumoQuerySchema = z.object({
  operacaoId: z.string().uuid().optional(),
});

@SkipThrottle()
@Controller('gestao/dashboard')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get()
  @RequireQualquerPermissao('COMPRAS_PROGRAMADAS_LER', 'DISPONIBILIDADE_LER')
  resumo(@Query(new ZodValidationPipe(resumoQuerySchema)) query: { operacaoId?: string }) {
    return this.service.resumo(query.operacaoId);
  }
}
