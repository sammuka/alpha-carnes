import { Body, Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { uuidSchema } from './dto/comum.dto';
import {
  criarSimulacaoSchema,
  listarSimulacoesSchema,
  type CriarSimulacaoDto,
  type ListarSimulacoesQuery,
} from './dto/simulacao.dto';
import { SimulacoesFiscaisService } from './simulacoes.service';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SimulacoesController {
  constructor(private readonly simulacoes: SimulacoesFiscaisService) {}

  @Get('simulacoes')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  listar(@Query(new ZodValidationPipe(listarSimulacoesSchema)) query: ListarSimulacoesQuery) {
    return this.simulacoes.listar(query);
  }

  @Get('simulacoes/:id/explicacao')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  explicar(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.simulacoes.explicar(id);
  }

  @Get('simulacoes/:id/historico')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  historico(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.simulacoes.historico(id);
  }

  @Get('simulacoes/:id')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  detalhar(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.simulacoes.detalhar(id);
  }

  @Post('simulacoes')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_SIMULACOES_GERENCIAR')
  simular(
    @Body(new ZodValidationPipe(criarSimulacaoSchema)) dto: CriarSimulacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.simulacoes.simular(dto, user.sub);
  }
}
