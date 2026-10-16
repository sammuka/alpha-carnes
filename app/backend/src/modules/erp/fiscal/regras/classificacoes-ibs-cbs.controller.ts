import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { ClassificacoesIbsCbsService } from './classificacoes-ibs-cbs.service';
import {
  classificacaoIbsCbsSchema,
  listarCatalogoQuerySchema,
  type ClassificacaoIbsCbsDto,
  type ListarClassificacoesQuery,
} from './dto/classificacao-ibs-cbs.dto';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ClassificacoesIbsCbsController {
  constructor(private readonly classificacoes: ClassificacoesIbsCbsService) {}

  @Get('classificacoes-ibs-cbs')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  listar(@Query(new ZodValidationPipe(listarCatalogoQuerySchema)) query: ListarClassificacoesQuery) {
    return this.classificacoes.listar(query);
  }

  @Post('classificacoes-ibs-cbs')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(classificacaoIbsCbsSchema)) dto: ClassificacaoIbsCbsDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.classificacoes.criar(dto, user.sub);
  }
}
