import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { RequireQualquerPermissao } from '../../../common/rbac/require-qualquer-permissao.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { CaminhaoService } from './caminhao.service';
import { CargaService } from './carga.service';
import { ConferenciaService } from './conferencia.service';
import { FechamentoService } from './fechamento.service';
import { LiberacaoService } from './liberacao.service';
import {
  criarCaminhaoSchema, vincularPedidoSchema, adicionarItemSchema,
  transferirItemSchema, removerItemSchema, registrarItemConferenciaSchema,
  fecharSchema, reabrirSchema, divergenciaConferenciaSchema,
  type CriarCaminhaoDto, type VincularPedidoDto, type AdicionarItemDto,
  type TransferirItemDto, type RemoverItemDto, type RegistrarItemConferenciaDto,
  type FecharDto, type ReabrirDto, type DivergenciaConferenciaDto,
} from './dto/expedicao.dto';

@SkipThrottle()
@Controller('operacao/expedicao')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ExpedicaoController {
  constructor(
    private readonly caminhao: CaminhaoService,
    private readonly carga: CargaService,
    private readonly conferencia: ConferenciaService,
    private readonly fechamento: FechamentoService,
    private readonly liberacao: LiberacaoService,
  ) {}

  // ── Caminhão ───────────────────────────────────────────────────────────────
  @Post('caminhoes')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  criar(@Body(new ZodValidationPipe(criarCaminhaoSchema)) dto: CriarCaminhaoDto, @CurrentUser() user: CurrentUserPayload) {
    return this.caminhao.criar(dto, user.sub);
  }

  @Get('caminhoes')
  @RequireQualquerPermissao('EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR')
  listar(@Query('dataOperacao', new ZodValidationPipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'))) dataOperacao: string) {
    return this.caminhao.listar(dataOperacao);
  }

  // Declarada ANTES de `caminhoes/:id` para evitar captura de rota.
  @Get('envio-faturamento')
  @RequireQualquerPermissao('EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR', 'FATURAMENTO_LER')
  listarEnvioFaturamento(
    @Query('dataOperacao', new ZodValidationPipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'))) dataOperacao: string,
  ) {
    return this.liberacao.listarParaEnvio(dataOperacao);
  }

  @Get('caminhoes/:id')
  @RequireQualquerPermissao('EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR')
  detalhar(@Param('id') id: string) {
    return this.caminhao.detalhar(id);
  }

  @Post('caminhoes/:id/abrir-carga')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  abrirCarga(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.caminhao.abrirCarga(id, user.sub);
  }

  @Post('caminhoes/:id/pedidos')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  vincularPedido(@Param('id') id: string, @Body(new ZodValidationPipe(vincularPedidoSchema)) dto: VincularPedidoDto, @CurrentUser() user: CurrentUserPayload) {
    return this.caminhao.vincularPedido(id, dto, user.sub);
  }

  // ── Carga ─────────────────────────────────────────────────────────────────
  @Post('caminhoes/:id/itens')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  adicionarItem(@Param('id') id: string, @Body(new ZodValidationPipe(adicionarItemSchema)) dto: AdicionarItemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.carga.adicionarItem(id, dto, user.sub);
  }

  @Post('itens/:itemId/transferir')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  transferir(@Param('itemId') itemId: string, @Body(new ZodValidationPipe(transferirItemSchema)) dto: TransferirItemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.carga.transferir(itemId, dto, user.sub);
  }

  @Post('itens/:itemId/remover')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  removerItem(@Param('itemId') itemId: string, @Body(new ZodValidationPipe(removerItemSchema)) dto: RemoverItemDto, @CurrentUser() user: CurrentUserPayload) {
    return this.carga.removerItem(itemId, dto.motivo, user.sub);
  }

  // ── Conferência ───────────────────────────────────────────────────────────
  @Post('caminhoes/:id/conferencia/iniciar')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  iniciarConferencia(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.conferencia.iniciar(id, user.sub);
  }

  @Post('caminhoes/:id/conferencia/registrar-item')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  registrarItemConferencia(@Param('id') id: string, @Body(new ZodValidationPipe(registrarItemConferenciaSchema)) dto: RegistrarItemConferenciaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.conferencia.registrarItem(id, dto, user);
  }

  @Post('caminhoes/:id/conferencia/concluir')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  concluirConferencia(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.conferencia.concluir(id, user.sub);
  }

  @Post('caminhoes/:id/conferencia/divergencia')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  divergenciaConferencia(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(divergenciaConferenciaSchema)) dto: DivergenciaConferenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.conferencia.divergencia(id, dto, user);
  }

  // ── Fechamento ────────────────────────────────────────────────────────────
  @Post('caminhoes/:id/fechar')
  @RequirePermissoes('EXPEDICAO_GERENCIAR')
  fechar(@Param('id') id: string, @Body(new ZodValidationPipe(fecharSchema)) dto: FecharDto, @CurrentUser() user: CurrentUserPayload) {
    return this.fechamento.fechar(id, dto, user.sub);
  }

  @Post('caminhoes/:id/reabrir')
  @RequirePermissoes('EXPEDICAO_REABRIR')
  reabrir(@Param('id') id: string, @Body(new ZodValidationPipe(reabrirSchema)) dto: ReabrirDto, @CurrentUser() user: CurrentUserPayload) {
    return this.fechamento.reabrir(id, dto.justificativa, user.sub);
  }

  @Get('caminhoes/:id/romaneio')
  @RequireQualquerPermissao('EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR')
  romaneio(@Param('id') id: string) {
    return this.fechamento.romaneio(id);
  }

  // ── Liberação (F6) ────────────────────────────────────────────────────────
  @Get('liberacao')
  @RequireQualquerPermissao('FATURAMENTO_LER', 'EXPEDICAO_LER', 'EXPEDICAO_GERENCIAR')
  listarLiberacao(
    @Query('dataOperacao', new ZodValidationPipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'))) dataOperacao: string,
  ) {
    return this.liberacao.listarParaLiberacao(dataOperacao);
  }

  @Post('caminhoes/:id/liberar-faturamento')
  @RequireQualquerPermissao('FATURAMENTO_GERENCIAR', 'EXPEDICAO_GERENCIAR')
  liberarFaturamento(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.liberacao.liberarFaturamento(id, user.sub);
  }

  @Post('caminhoes/:id/liberar-saida')
  @RequireQualquerPermissao('FATURAMENTO_GERENCIAR', 'EXPEDICAO_GERENCIAR')
  liberarSaida(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.liberacao.liberarSaida(id, user.sub);
  }
}
