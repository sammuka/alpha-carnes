import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
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
  novaVersaoSchema,
  type CriarSimulacaoDto,
  type ListarSimulacoesQuery,
  type NovaVersaoDto,
} from './dto/simulacao.dto';
import { SimulacoesFiscaisService } from './simulacoes.service';

const compararQuerySchema = z.object({ com: uuidSchema });

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SimulacoesController {
  constructor(private readonly simulacoes: SimulacoesFiscaisService) {}

  @Get('simulacoes/contagens')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  contagens(@Query(new ZodValidationPipe(listarSimulacoesSchema)) query: ListarSimulacoesQuery) {
    return this.simulacoes.contagens(query);
  }

  @Get('simulacoes/exportacao')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  async exportacao(
    @Query(new ZodValidationPipe(listarSimulacoesSchema)) query: ListarSimulacoesQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.simulacoes.exportar(query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="simulacoes.csv"',
    });
    return csv;
  }

  @Get('simulacoes')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  listar(@Query(new ZodValidationPipe(listarSimulacoesSchema)) query: ListarSimulacoesQuery) {
    return this.simulacoes.listar(query);
  }

  @Get('simulacoes/:id/comparar')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  comparar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Query(new ZodValidationPipe(compararQuerySchema)) query: { com: string },
  ) {
    return this.simulacoes.comparar(id, query.com);
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

  @Get('simulacoes/:id/pre-condicoes')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  preCondicoes(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.simulacoes.preCondicoes(id);
  }

  @Get('simulacoes/:id/memoria')
  @RequirePermissoes('FISCAL_SIMULACOES_LER')
  async memoria(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.simulacoes.memoria(id);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="memoria.csv"',
    });
    return csv;
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

  @Post('simulacoes/:id/versoes')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_SIMULACOES_GERENCIAR')
  versoes(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(novaVersaoSchema)) dto: NovaVersaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.simulacoes.novaVersao(id, dto, user.sub);
  }

  @Patch('simulacoes/:id')
  @RequirePermissoes('FISCAL_SIMULACOES_GERENCIAR')
  alterar(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.simulacoes.recusarAlteracao(id);
  }
}
