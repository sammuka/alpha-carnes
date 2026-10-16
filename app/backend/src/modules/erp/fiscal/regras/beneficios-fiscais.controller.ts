import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { BeneficiosFiscaisService } from './beneficios-fiscais.service';
import {
  beneficioFiscalSchema,
  listarCatalogoQuerySchema,
  type BeneficioFiscalDto,
  type ListarBeneficiosQuery,
} from './dto/beneficio-fiscal.dto';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class BeneficiosFiscaisController {
  constructor(private readonly beneficios: BeneficiosFiscaisService) {}

  @Get('beneficios-fiscais')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  listar(@Query(new ZodValidationPipe(listarCatalogoQuerySchema)) query: ListarBeneficiosQuery) {
    return this.beneficios.listar(query);
  }

  @Post('beneficios-fiscais')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(beneficioFiscalSchema)) dto: BeneficioFiscalDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.beneficios.criar(dto, user.sub);
  }
}
