import { Body, Controller, Patch, Param, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { DivergenciaRecebimentoService } from './divergencia-recebimento.service';
import { atualizarDivergenciaSchema, type AtualizarDivergenciaDto } from './dto/divergencia-recebimento.dto';

@SkipThrottle()
@Controller('operacao/divergencias-recebimento')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DivergenciaRecebimentoController {
  constructor(private readonly service: DivergenciaRecebimentoService) {}

  @Patch(':id')
  @RequirePermissoes('DIVERGENCIA_RECEBIMENTO_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarDivergenciaSchema)) dto: AtualizarDivergenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }
}
