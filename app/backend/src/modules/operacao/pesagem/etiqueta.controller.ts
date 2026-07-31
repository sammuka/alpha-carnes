import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { EtiquetaService } from './etiqueta.service';
import {
  cancelarEtiquetaSchema,
  listarEtiquetasSchema,
  type CancelarEtiquetaDto,
  type ListarEtiquetasDto,
} from './dto/etiqueta.dto';

// Matriz de rastreabilidade v1.1, linha 16: GET /operacao/etiquetas?filtros e
// POST /operacao/etiquetas/:id/cancelar.
@SkipThrottle()
@Controller('operacao/etiquetas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EtiquetaController {
  constructor(private readonly etiqueta: EtiquetaService) {}

  @Get()
  @RequirePermissoes('PESAGEM_LER')
  listar(@Query(new ZodValidationPipe(listarEtiquetasSchema)) filtros: ListarEtiquetasDto) {
    return this.etiqueta.listar(filtros);
  }

  @Post(':id/cancelar')
  @RequirePermissoes('ETIQUETA_GERENCIAR')
  cancelar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelarEtiquetaSchema)) dto: CancelarEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.etiqueta.cancelar(id, dto, user.sub);
  }
}
