import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { CfopsService } from './cfops.service';
import {
  createCfopSchema,
  listarCodigoFiscalQuerySchema,
  type CreateCfopDto,
  type ListarCodigoFiscalQuery,
} from './dto/cfop.dto';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class CfopsController {
  constructor(private readonly cfops: CfopsService) {}

  @Get('cfops')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  listar(@Query(new ZodValidationPipe(listarCodigoFiscalQuerySchema)) query: ListarCodigoFiscalQuery) {
    return this.cfops.listar(query);
  }

  @Post('cfops')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createCfopSchema)) dto: CreateCfopDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.cfops.criar(dto, user.sub);
  }
}
