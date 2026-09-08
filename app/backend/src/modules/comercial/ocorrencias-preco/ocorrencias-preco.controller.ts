import {
  Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { OcorrenciasPrecoService } from './ocorrencias-preco.service';
import {
  listarOcorrenciasPrecoQuerySchema,
  type ListarOcorrenciasPrecoQuery,
} from './dto/ocorrencia-preco.dto';

@SkipThrottle()
@Controller('ocorrencias-preco')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OcorrenciasPrecoController {
  constructor(private readonly service: OcorrenciasPrecoService) {}

  @Get()
  @RequirePermissoes('APROVACOES_LER')
  async listar(@Query(new ZodValidationPipe(listarOcorrenciasPrecoQuerySchema)) query: ListarOcorrenciasPrecoQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('APROVACOES_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post(':id/ciente')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('OCORRENCIA_PRECO_CIENTE')
  async marcarCiente(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.marcarCiente(id, user.sub);
  }
}
