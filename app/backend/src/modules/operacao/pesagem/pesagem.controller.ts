import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { PesagemService } from './pesagem.service';
import { AssociacaoService } from './associacao.service';
import { EtiquetaService } from './etiqueta.service';
import { registrarPesagemSchema, type RegistrarPesagemDto } from './dto/pesagem.dto';
import {
  confirmarAssociacaoSchema,
  redirecionarSchema,
  semCoberturaSchema,
  type ConfirmarAssociacaoDto,
  type RedirecionarDto,
  type SemCoberturaDto,
} from './dto/associacao.dto';
import { resolverQrSchema, type ResolverQrDto } from './dto/etiqueta.dto';

@SkipThrottle()
@Controller('operacao/pesagem')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PesagemController {
  constructor(
    private readonly pesagem: PesagemService,
    private readonly associacao: AssociacaoService,
    private readonly etiqueta: EtiquetaService,
  ) {}

  // ── Status de dispositivos (RA-05: sempre visível) ────────────────────────
  @Get('dispositivos/status')
  @RequirePermissoes('PESAGEM_LER')
  status() {
    return this.pesagem.statusDispositivos();
  }

  // ── Pesagem ───────────────────────────────────────────────────────────────
  @Post('pecas')
  @RequirePermissoes('PESAGEM_GERENCIAR')
  async pesar(
    @Body(new ZodValidationPipe(registrarPesagemSchema)) dto: RegistrarPesagemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.pesagem.registrarPesagem(dto, user);
  }

  @Get('pecas/:id')
  @RequirePermissoes('PESAGEM_LER')
  detalhar(@Param('id') id: string) {
    return this.pesagem.detalhar(id);
  }

  @Get('recebimentos/:recebimentoId/pecas')
  @RequirePermissoes('PESAGEM_LER')
  listarPorRecebimento(@Param('recebimentoId') recebimentoId: string) {
    return this.pesagem.listarPorRecebimento(recebimentoId);
  }

  // ── Associação sugestiva ──────────────────────────────────────────────────
  @Get('pecas/:id/sugestao')
  @RequirePermissoes('PESAGEM_LER')
  sugerir(@Param('id') id: string) {
    return this.associacao.sugerir(id);
  }

  @Get('pecas/:id/compativeis')
  @RequirePermissoes('PESAGEM_LER')
  compativeis(@Param('id') id: string) {
    return this.associacao.listarCompativeis(id);
  }

  @Post('pecas/:id/confirmar')
  @RequirePermissoes('ASSOCIACAO_GERENCIAR')
  confirmar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmarAssociacaoSchema)) dto: ConfirmarAssociacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.associacao.confirmar(id, dto, user.sub);
  }

  @Post('pecas/:id/redirecionar')
  @RequirePermissoes('ASSOCIACAO_GERENCIAR')
  redirecionar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(redirecionarSchema)) dto: RedirecionarDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.associacao.redirecionar(id, dto, user.sub);
  }

  @Post('pecas/:id/sem-cobertura')
  @RequirePermissoes('ASSOCIACAO_GERENCIAR')
  semCobertura(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(semCoberturaSchema)) dto: SemCoberturaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.associacao.semCobertura(id, dto, user.sub);
  }

  // ── Etiqueta ────────────────────────────────────────────────────────────────
  @Post('pecas/:id/etiqueta')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  emitir(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.etiqueta.emitir(id, user.sub);
  }

  @Post('pecas/:id/etiqueta/reimprimir')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  reimprimir(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.etiqueta.reimprimir(id, user.sub);
  }

  // ── Leitura QR (manual exige LEITURA_MANUAL) ──────────────────────────────
  @Post('qr/resolver')
  @RequirePermissoes('LEITURA_MANUAL')
  resolverQr(@Body(new ZodValidationPipe(resolverQrSchema)) dto: ResolverQrDto) {
    return this.etiqueta.resolverQr(dto);
  }
}
