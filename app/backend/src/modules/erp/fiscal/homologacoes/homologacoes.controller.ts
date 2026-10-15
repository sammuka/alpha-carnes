import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { uuidSchema } from '../enquadramentos/dto/comum.dto';
import {
  corpoDecisaoSchema,
  criarHomologacaoSchema,
  listarHomologacoesSchema,
  type CorpoDecisaoDto,
  type CriarHomologacaoDto,
  type ListarHomologacoesQuery,
} from './dto/homologacao.dto';
import { HomologacoesService } from './homologacoes.service';

@SkipThrottle()
@Controller('fiscal/homologacoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class HomologacoesController {
  constructor(private readonly homologacoes: HomologacoesService) {}

  @Get('contagens')
  @RequirePermissoes('FISCAL_HOMOLOGACOES_LER')
  contagens(@Query(new ZodValidationPipe(listarHomologacoesSchema)) query: ListarHomologacoesQuery) {
    return this.homologacoes.contagens(query);
  }

  @Get('exportacao')
  @RequirePermissoes('FISCAL_HOMOLOGACOES_LER')
  async exportacao(
    @Query(new ZodValidationPipe(listarHomologacoesSchema)) query: ListarHomologacoesQuery,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.homologacoes.exportar(query);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="homologacoes.csv"',
    });
    return csv;
  }

  @Get()
  @RequirePermissoes('FISCAL_HOMOLOGACOES_LER')
  listar(@Query(new ZodValidationPipe(listarHomologacoesSchema)) query: ListarHomologacoesQuery) {
    return this.homologacoes.listar(query);
  }

  @Get(':id/diff')
  @RequirePermissoes('FISCAL_HOMOLOGACOES_LER')
  diff(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.homologacoes.diff(id);
  }

  @Get(':id')
  @RequirePermissoes('FISCAL_HOMOLOGACOES_LER')
  detalhar(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.homologacoes.detalhar(id);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_HOMOLOGACOES_APROVAR')
  aprovar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(corpoDecisaoSchema)) dto: CorpoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.homologacoes.aprovar(id, dto, user.sub);
  }

  @Post(':id/rejeitar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_HOMOLOGACOES_APROVAR')
  rejeitar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(corpoDecisaoSchema)) dto: CorpoDecisaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.homologacoes.rejeitar(id, dto, user.sub);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissoes('FISCAL_HOMOLOGACOES_GERENCIAR')
  abrir(
    @Body(new ZodValidationPipe(criarHomologacaoSchema)) dto: CriarHomologacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.homologacoes.abrir(dto, user.sub);
  }
}
