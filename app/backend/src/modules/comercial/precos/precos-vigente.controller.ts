import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { PrecosService } from './precos.service';
import { vigenteQuerySchema, type VigenteQuery } from './dto/preco-vigente.dto';

@SkipThrottle()
@Controller('precos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PrecosVigenteController {
  constructor(private readonly service: PrecosService) {}

  @Get('vigente')
  @RequirePermissoes('TABELA_PRECO_LER')
  async vigente(@Query(new ZodValidationPipe(vigenteQuerySchema)) query: VigenteQuery) {
    const data = await this.service.vigentePorClienteOperacao({
      produtoIds: query.produtoIds,
      clienteId: query.clienteId,
      operacaoId: query.operacaoId,
    });
    return { data };
  }
}
