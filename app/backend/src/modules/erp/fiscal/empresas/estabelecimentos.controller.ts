import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { AlteracoesService } from './alteracoes.service';
import { EstabelecimentosService } from './estabelecimentos.service';
import { RegimesService } from './regimes.service';
import {
  createAlteracaoSchema,
  updateAlteracaoSchema,
  type CreateAlteracaoDto,
  type UpdateAlteracaoDto,
} from './dto/alteracao.dto';
import {
  createRegimeSchema,
  submeterRegimeSchema,
  updateRegimeSchema,
  type CreateRegimeDto,
  type SubmeterRegimeDto,
  type UpdateRegimeDto,
} from './dto/regime.dto';
import {
  acaoDecisaoSchema,
  removerSchema,
  uuidParamSchema,
  type AcaoDecisaoDto,
  type RemoverDto,
} from './dto/comum.dto';
import {
  createEstabelecimentoSchema,
  listarEstabelecimentosQuerySchema,
  substituirCnaesSchema,
  updateEstabelecimentoSchema,
  type CreateEstabelecimentoDto,
  type ListarEstabelecimentosQuery,
  type SubstituirCnaesDto,
  type UpdateEstabelecimentoDto,
} from './dto/estabelecimento.dto';

@SkipThrottle()
@Controller('fiscal/estabelecimentos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EstabelecimentosController {
  constructor(
    private readonly estabelecimentos: EstabelecimentosService,
    private readonly alteracoes: AlteracoesService,
    private readonly regimes: RegimesService,
  ) {}

  @Get()
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  listar(@Query(new ZodValidationPipe(listarEstabelecimentosQuerySchema)) query: ListarEstabelecimentosQuery) {
    return this.estabelecimentos.listar(query);
  }

  @Get('contagens')
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  contagens(@Query(new ZodValidationPipe(listarEstabelecimentosQuerySchema)) query: ListarEstabelecimentosQuery) {
    return this.estabelecimentos.contagens(query);
  }

  @Get('exportacao')
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  async exportacao(
    @Query(new ZodValidationPipe(listarEstabelecimentosQuerySchema)) query: ListarEstabelecimentosQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.estabelecimentos.exportar(query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="estabelecimentos.csv"',
    });
    return csv;
  }

  @Get(':id/historico')
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  historico(@Param('id', new ZodValidationPipe(uuidParamSchema)) id: string) {
    return this.estabelecimentos.historico(id);
  }

  @Get(':id/pre-condicoes')
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  preCondicoes(@Param('id', new ZodValidationPipe(uuidParamSchema)) id: string) {
    return this.estabelecimentos.preCondicoes(id);
  }

  @Get(':id')
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  detalhar(@Param('id', new ZodValidationPipe(uuidParamSchema)) id: string) {
    return this.estabelecimentos.detalhar(id);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createEstabelecimentoSchema)) dto: CreateEstabelecimentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  atualizar(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateEstabelecimentoSchema)) dto: UpdateEstabelecimentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.atualizar(id, dto, user.sub);
  }

  @Put(':id/cnaes')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  cnaes(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(substituirCnaesSchema)) dto: SubstituirCnaesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.substituirListaCnaes(id, dto, user.sub);
  }

  @Post(':id/submeter')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  submeter(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.submeter(id, dto, user.sub);
  }

  @Post(':id/reativar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  reativar(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.reativar(id, dto, user.sub);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  aprovar(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.aprovar(id, dto, user.sub);
  }

  @Post(':id/rejeitar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  rejeitar(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.rejeitar(id, dto, user.sub);
  }

  @Post(':id/suspender')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  suspender(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.suspender(id, dto, user.sub);
  }

  @Post(':id/alteracoes')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  criarAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(createAlteracaoSchema)) dto: CreateAlteracaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.criar(id, dto, user.sub);
  }

  @Patch(':id/alteracoes/:altId')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  editarAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('altId', new ZodValidationPipe(uuidParamSchema)) altId: string,
    @Body(new ZodValidationPipe(updateAlteracaoSchema)) dto: UpdateAlteracaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.atualizar(id, altId, dto, user.sub);
  }

  @Post(':id/alteracoes/:altId/submeter')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  submeterAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('altId', new ZodValidationPipe(uuidParamSchema)) altId: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.submeter(id, altId, dto, user.sub);
  }

  @Post(':id/alteracoes/:altId/aprovar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  aprovarAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('altId', new ZodValidationPipe(uuidParamSchema)) altId: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.aprovar(id, altId, dto, user.sub);
  }

  @Post(':id/alteracoes/:altId/rejeitar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  rejeitarAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('altId', new ZodValidationPipe(uuidParamSchema)) altId: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.rejeitar(id, altId, dto, user.sub);
  }

  @Delete(':id/alteracoes/:altId')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  descartarAlteracao(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('altId', new ZodValidationPipe(uuidParamSchema)) altId: string,
    @Body(new ZodValidationPipe(removerSchema)) dto: RemoverDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.alteracoes.descartar(id, altId, dto, user.sub);
  }

  @Post(':id/regimes')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  criarRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(createRegimeSchema)) dto: CreateRegimeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.criar(id, dto, user.sub);
  }

  @Patch(':id/regimes/:regimeId')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  editarRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('regimeId', new ZodValidationPipe(uuidParamSchema)) regimeId: string,
    @Body(new ZodValidationPipe(updateRegimeSchema)) dto: UpdateRegimeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.atualizar(id, regimeId, dto, user.sub);
  }

  @Post(':id/regimes/:regimeId/submeter')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  submeterRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('regimeId', new ZodValidationPipe(uuidParamSchema)) regimeId: string,
    @Body(new ZodValidationPipe(submeterRegimeSchema)) dto: SubmeterRegimeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.submeter(id, regimeId, dto, user.sub);
  }

  @Post(':id/regimes/:regimeId/aprovar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  aprovarRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('regimeId', new ZodValidationPipe(uuidParamSchema)) regimeId: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.aprovar(id, regimeId, dto, user.sub);
  }

  @Post(':id/regimes/:regimeId/rejeitar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_EMPRESAS_APROVAR')
  rejeitarRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('regimeId', new ZodValidationPipe(uuidParamSchema)) regimeId: string,
    @Body(new ZodValidationPipe(acaoDecisaoSchema)) dto: AcaoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.rejeitar(id, regimeId, dto, user.sub);
  }

  @Delete(':id/regimes/:regimeId')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  removerRegime(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Param('regimeId', new ZodValidationPipe(uuidParamSchema)) regimeId: string,
    @Body(new ZodValidationPipe(removerSchema)) dto: RemoverDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regimes.remover(id, regimeId, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  remover(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(removerSchema)) dto: RemoverDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.estabelecimentos.remover(id, dto, user.sub);
  }
}
