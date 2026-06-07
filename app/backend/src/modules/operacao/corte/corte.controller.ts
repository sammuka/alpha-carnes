import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { CorteService } from './corte.service';
import { SubitemService } from './subitem.service';
import { EtiquetaService } from '../pesagem/etiqueta.service';
import {
  iniciarCorteSchema,
  concluirCorteSchema,
  type IniciarCorteDto,
  type ConcluirCorteDto,
} from './dto/corte.dto';
import { resolverQrSchema, type ResolverQrDto } from '../pesagem/dto/etiqueta.dto';
import {
  adicionarSubitemSchema,
  pesarSubitemSchema,
  associarSubitemSchema,
  redirecionarSubitemSchema,
  semCoberturaSubitemSchema,
  type AdicionarSubitemDto,
  type PesarSubitemDto,
  type AssociarSubitemDto,
  type RedirecionarSubitemDto,
  type SemCoberturaSubitemDto,
} from './dto/subitem.dto';

@SkipThrottle()
@Controller('operacao/corte')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CorteController {
  constructor(
    private readonly corte: CorteService,
    private readonly subitem: SubitemService,
    private readonly etiqueta: EtiquetaService,
  ) {}

  // ── Transformação ─────────────────────────────────────────────────────────
  @Post('pecas/:pecaId/iniciar')
  @RequirePermissoes('CORTE_GERENCIAR')
  iniciar(
    @Param('pecaId') pecaId: string,
    @Body(new ZodValidationPipe(iniciarCorteSchema)) dto: IniciarCorteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.corte.iniciar(pecaId, dto, user.sub);
  }

  @Get(':id')
  @RequirePermissoes('PESAGEM_LER')
  detalhar(@Param('id') id: string) {
    return this.corte.detalhar(id);
  }

  @Post(':id/concluir')
  @RequirePermissoes('CORTE_GERENCIAR')
  concluir(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(concluirCorteSchema)) dto: ConcluirCorteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.corte.concluir(id, dto, user.sub);
  }

  @Post(':id/cancelar')
  @RequirePermissoes('CORTE_GERENCIAR')
  cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.corte.cancelar(id, user.sub);
  }

  // ── Subitens ─────────────────────────────────────────────────────────────
  @Post(':id/subitens')
  @RequirePermissoes('CORTE_GERENCIAR')
  adicionar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(adicionarSubitemSchema)) dto: AdicionarSubitemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subitem.adicionar(id, dto, user.sub);
  }

  @Post('subitens/:subitemId/remover')
  @RequirePermissoes('CORTE_GERENCIAR')
  remover(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.remover(subitemId, user.sub);
  }

  @Post('subitens/:subitemId/pesar')
  @RequirePermissoes('CORTE_GERENCIAR')
  pesar(
    @Param('subitemId') subitemId: string,
    @Body(new ZodValidationPipe(pesarSubitemSchema)) dto: PesarSubitemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subitem.pesar(subitemId, dto, user);
  }

  @Get('subitens/:subitemId/sugestao')
  @RequirePermissoes('PESAGEM_LER')
  sugerir(@Param('subitemId') subitemId: string) {
    return this.subitem.sugerir(subitemId);
  }

  @Post('subitens/:subitemId/associar')
  @RequirePermissoes('CORTE_GERENCIAR')
  associar(
    @Param('subitemId') subitemId: string,
    @Body(new ZodValidationPipe(associarSubitemSchema)) dto: AssociarSubitemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subitem.associar(subitemId, dto, user.sub);
  }

  @Post('subitens/:subitemId/redirecionar')
  @RequirePermissoes('CORTE_GERENCIAR')
  redirecionar(
    @Param('subitemId') subitemId: string,
    @Body(new ZodValidationPipe(redirecionarSubitemSchema)) dto: RedirecionarSubitemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subitem.redirecionar(subitemId, dto, user.sub);
  }

  @Post('subitens/:subitemId/sem-cobertura')
  @RequirePermissoes('CORTE_GERENCIAR')
  semCobertura(
    @Param('subitemId') subitemId: string,
    @Body(new ZodValidationPipe(semCoberturaSubitemSchema)) dto: SemCoberturaSubitemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.subitem.semCobertura(subitemId, dto, user.sub);
  }

  // ── Reetiqueta do subitem ────────────────────────────────────────────────
  @Post('subitens/:subitemId/etiqueta')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  etiquetar(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.reetiquetar(subitemId, user.sub);
  }

  @Post('subitens/:subitemId/etiqueta/reimprimir')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  reimprimir(@Param('subitemId') subitemId: string, @CurrentUser() user: CurrentUserPayload) {
    return this.subitem.reimprimir(subitemId, user.sub);
  }

  // ── QR do subitem ─────────────────────────────────────────────────────────
  @Post('subitens/qr/resolver')
  @RequirePermissoes('LEITURA_MANUAL')
  resolverQr(@Body(new ZodValidationPipe(resolverQrSchema)) dto: ResolverQrDto) {
    return this.etiqueta.resolverQrSubitem(dto);
  }

  // ── Rastreabilidade ───────────────────────────────────────────────────────
  @Get('rastreabilidade/consulta')
  @RequirePermissoes('PESAGEM_LER')
  rastrear(
    @Query('pecaId') pecaId?: string,
    @Query('subitemId') subitemId?: string,
  ) {
    return this.corte.rastrear({ pecaId, subitemId });
  }
}
