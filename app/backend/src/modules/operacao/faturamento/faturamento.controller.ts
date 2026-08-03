import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { RequireQualquerPermissao } from '../../../common/rbac/require-qualquer-permissao.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ConsolidacaoService } from './consolidacao.service';
import { FaturamentoService } from './faturamento.service';
import { NotasConsultaService } from './notas-consulta.service';
import { SegurosService } from './seguros.service';
import {
  emitirNfseSchema,
  type EmitirNfseDto,
  cancelarNfseSchema,
  type CancelarNfseDto,
  listarNotasQuerySchema,
  type ListarNotasQuery,
  listarSegurosQuerySchema,
  type ListarSegurosQuery,
  criarSeguroSchema,
  type CriarSeguroDto,
  alterarStatusSeguroSchema,
  type AlterarStatusSeguroDto,
  registrarAnexoSeguroSchema,
  type RegistrarAnexoSeguroDto,
  salvarObservacaoSeguroSchema,
  type SalvarObservacaoSeguroDto,
} from './dto/faturamento.dto';

@Controller('operacao/faturamento')
@UseGuards(JwtAuthGuard, RbacGuard)
export class FaturamentoController {
  constructor(
    private readonly consolidacao: ConsolidacaoService,
    private readonly faturamento: FaturamentoService,
    private readonly notasConsulta: NotasConsultaService,
    private readonly seguros: SegurosService,
  ) {}

  @Get('seguros')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'SEGURO_GERENCIAR')
  listarSeguros(@Query(new ZodValidationPipe(listarSegurosQuerySchema)) query: ListarSegurosQuery) {
    return this.seguros.listar(query);
  }

  @Post('seguros')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'SEGURO_GERENCIAR')
  criarSeguro(@Body(new ZodValidationPipe(criarSeguroSchema)) dto: CriarSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.obterOuCriar(dto.caminhaoId, user.sub);
  }

  @Patch('seguros/:id/status')
  @RequirePermissoes('SEGURO_GERENCIAR')
  alterarStatusSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(alterarStatusSeguroSchema)) dto: AlterarStatusSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.alterarStatus(id, dto.status, user.sub);
  }

  @Post('seguros/:id/anexos')
  @RequirePermissoes('SEGURO_GERENCIAR')
  registrarAnexoSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(registrarAnexoSeguroSchema)) dto: RegistrarAnexoSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.registrarAnexo(id, dto.nome, dto.descricao, user.sub);
  }

  @Patch('seguros/:id/observacao')
  @RequirePermissoes('SEGURO_GERENCIAR')
  salvarObservacaoSeguro(@Param('id') id: string, @Body(new ZodValidationPipe(salvarObservacaoSeguroSchema)) dto: SalvarObservacaoSeguroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.seguros.salvarObservacao(id, dto.observacao, user.sub);
  }

  @Get('notas')
  @RequirePermissoes('FATURAMENTO_LER')
  listarNotas(@Query(new ZodValidationPipe(listarNotasQuerySchema)) query: ListarNotasQuery) {
    return this.notasConsulta.listar(query);
  }

  @Get('notas/:id/rastreabilidade')
  @RequirePermissoes('FATURAMENTO_LER')
  rastreabilidade(@Param('id') id: string) {
    return this.notasConsulta.rastreabilidade(id);
  }

  @Get('rtc/pesquisar-nbs')
  @RequirePermissoes('FATURAMENTO_GERENCIAR')
  rtcPesquisarNbs(@Query('atividade') atividade: string) {
    return this.faturamento.rtcPesquisarNbs(atividade);
  }

  @Get('caminhoes/:caminhaoId/consolidacao')
  @RequirePermissoes('FATURAMENTO_LER')
  consolidar(
    @Param('caminhaoId') caminhaoId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.consolidacao.consolidar(caminhaoId, user.sub);
  }

  @Post('caminhoes/:caminhaoId/emitir')
  @RequirePermissoes('NFSE_EMITIR')
  emitir(
    @Param('caminhaoId') caminhaoId: string,
    @Body(new ZodValidationPipe(emitirNfseSchema)) dto: EmitirNfseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.faturamento.emitir(caminhaoId, dto, user.sub);
  }

  @Post('notas/:notaId/cancelar')
  @RequirePermissoes('NFSE_CANCELAR')
  cancelar(
    @Param('notaId') notaId: string,
    @Body(new ZodValidationPipe(cancelarNfseSchema)) dto: CancelarNfseDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.faturamento.cancelar(notaId, dto, user.sub);
  }

  @Post('notas/:notaId/reprocessar')
  @RequirePermissoes('NFSE_EMITIR')
  reprocessar(
    @Param('notaId') notaId: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.faturamento.reprocessar(notaId, user.sub);
  }
}
