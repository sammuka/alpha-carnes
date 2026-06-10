import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ConsolidacaoService } from './consolidacao.service';
import { FaturamentoService } from './faturamento.service';
import {
  emitirNfseSchema,
  type EmitirNfseDto,
  cancelarNfseSchema,
  type CancelarNfseDto,
} from './dto/faturamento.dto';

@Controller('operacao/faturamento')
@UseGuards(JwtAuthGuard, RbacGuard)
export class FaturamentoController {
  constructor(
    private readonly consolidacao: ConsolidacaoService,
    private readonly faturamento: FaturamentoService,
  ) {}

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
