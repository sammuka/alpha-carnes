import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { EstoqueConsultaService } from './estoque-consulta.service';
import { DestinarEstoqueService } from './destinar.service';
import { EntradasEstoqueService } from './entradas.service';
import { AjustesEstoqueService } from './ajustes.service';
import { HistoricoEstoqueService } from './historico.service';
import {
  consultaEstoqueQuerySchema,
  destinarSchema,
  criarEntradaSchema,
  criarAjusteSchema,
  rejeitarAjusteSchema,
  historicoParamsSchema,
  listarEntradasQuerySchema,
  listarAjustesQuerySchema,
  compativeisEntradaPorProdutoQuerySchema,
  type ConsultaEstoqueQuery,
  type DestinarDto,
  type CriarEntradaDto,
  type CriarAjusteDto,
  type RejeitarAjusteDto,
  type HistoricoParams,
  type ListarEntradasQuery,
  type ListarAjustesQuery,
  type CompativeisEntradaPorProdutoQuery,
} from './dto/estoque.dto';

@SkipThrottle()
@Controller('estoque')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EstoqueController {
  constructor(
    private readonly consulta: EstoqueConsultaService,
    private readonly destinarService: DestinarEstoqueService,
    private readonly entradas: EntradasEstoqueService,
    private readonly ajustes: AjustesEstoqueService,
    private readonly historico: HistoricoEstoqueService,
  ) {}

  // ── rotas literais (ANTES de :tipo/:id/historico) ──────────────────────────

  @Get('consulta')
  @RequirePermissoes('ESTOQUE_LER')
  consultar(@Query(new ZodValidationPipe(consultaEstoqueQuerySchema)) query: ConsultaEstoqueQuery) {
    return this.consulta.consultar(query);
  }

  @Post('destinar')
  @RequirePermissoes('ESTOQUE_GERENCIAR')
  destinar(
    @Body(new ZodValidationPipe(destinarSchema)) dto: DestinarDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.destinarService.destinar(dto, user.sub);
  }

  @Get('entradas/compativeis')
  @RequirePermissoes('ESTOQUE_LER')
  compativeisPorProduto(
    @Query(new ZodValidationPipe(compativeisEntradaPorProdutoQuerySchema)) query: CompativeisEntradaPorProdutoQuery,
  ) {
    return this.entradas.compativeisPorProduto(query.produtoId);
  }

  @Get('entradas/:id/compativeis')
  @RequirePermissoes('ESTOQUE_LER')
  compativeisDaEntrada(@Param('id') id: string) {
    return this.entradas.compativeis(id);
  }

  @Get('entradas')
  @RequirePermissoes('ESTOQUE_LER')
  listarEntradas(@Query(new ZodValidationPipe(listarEntradasQuerySchema)) query: ListarEntradasQuery) {
    return this.entradas.listar(query);
  }

  @Post('entradas')
  @RequirePermissoes('ESTOQUE_ENTRADA')
  criarEntrada(
    @Body(new ZodValidationPipe(criarEntradaSchema)) dto: CriarEntradaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.entradas.criar(dto, user.sub);
  }

  @Get('ajustes')
  @RequirePermissoes('ESTOQUE_LER')
  listarAjustes(@Query(new ZodValidationPipe(listarAjustesQuerySchema)) query: ListarAjustesQuery) {
    return this.ajustes.listar(query);
  }

  @Post('ajustes')
  @RequirePermissoes('ESTOQUE_AJUSTAR')
  criarAjuste(
    @Body(new ZodValidationPipe(criarAjusteSchema)) dto: CriarAjusteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ajustes.criar(dto, user.sub);
  }

  @Post('ajustes/:id/aprovar')
  @RequirePermissoes('ESTOQUE_AJUSTE_APROVAR')
  aprovarAjuste(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.ajustes.aprovar(id, user.sub);
  }

  @Post('ajustes/:id/rejeitar')
  @RequirePermissoes('ESTOQUE_AJUSTE_APROVAR')
  rejeitarAjuste(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejeitarAjusteSchema)) dto: RejeitarAjusteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ajustes.rejeitar(id, dto, user.sub);
  }

  // ── rota dinâmica (DEPOIS das literais) ─────────────────────────────────────

  @Get(':tipo/:id/historico')
  @RequirePermissoes('ESTOQUE_LER')
  historicoItem(@Param() params: HistoricoParams) {
    return this.historico.obter(historicoParamsSchema.parse(params));
  }
}
