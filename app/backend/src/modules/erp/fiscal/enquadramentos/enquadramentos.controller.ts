import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { EnquadramentosService } from './enquadramentos.service';
import {
  consultaEnquadramentoSchema,
  type ConsultaEnquadramentoDto,
} from './dto/consulta.dto';
import {
  acaoSituacaoSchema,
  createEnquadramentoSchema,
  duplicarEnquadramentoSchema,
  idParamSchema,
  listarEnquadramentosQuerySchema,
  removerEnquadramentoSchema,
  updateEnquadramentoSchema,
  type AcaoSituacaoDto,
  type CreateEnquadramentoDto,
  type DuplicarEnquadramentoDto,
  type ListarEnquadramentosQuery,
  type RemoverEnquadramentoDto,
  type UpdateEnquadramentoDto,
} from './dto/enquadramento.dto';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EnquadramentosController {
  constructor(private readonly enquadramentos: EnquadramentosService) {}

  @Get('enquadramentos/contagens')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  contagens(@Query(new ZodValidationPipe(listarEnquadramentosQuerySchema)) query: ListarEnquadramentosQuery) {
    return this.enquadramentos.contagens(query);
  }

  @Get('enquadramentos')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  listar(@Query(new ZodValidationPipe(listarEnquadramentosQuerySchema)) query: ListarEnquadramentosQuery) {
    return this.enquadramentos.listar(query);
  }

  @Get('enquadramentos/:id/historico')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  historico(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.enquadramentos.historico(id);
  }

  @Get('enquadramentos/:id')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  detalhar(@Param('id', new ZodValidationPipe(idParamSchema)) id: string) {
    return this.enquadramentos.detalhar(id);
  }

  @Post('enquadramentos/consulta')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  consultar(@Body(new ZodValidationPipe(consultaEnquadramentoSchema)) dto: ConsultaEnquadramentoDto) {
    return this.enquadramentos.consultar(dto);
  }

  @Post('enquadramentos')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createEnquadramentoSchema)) dto: CreateEnquadramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.criar(dto, user.sub);
  }

  @Patch('enquadramentos/:id')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  atualizar(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateEnquadramentoSchema)) dto: UpdateEnquadramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.atualizar(id, dto, user.sub);
  }

  @Post('enquadramentos/:id/duplicar')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  duplicar(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(duplicarEnquadramentoSchema)) dto: DuplicarEnquadramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.duplicar(id, dto, user.sub);
  }

  @Post('enquadramentos/:id/inativar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  inativar(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoSituacaoSchema)) dto: AcaoSituacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.inativar(id, dto, user.sub);
  }

  @Post('enquadramentos/:id/reativar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  reativar(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(acaoSituacaoSchema)) dto: AcaoSituacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.reativar(id, dto, user.sub);
  }

  @Delete('enquadramentos/:id')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  remover(
    @Param('id', new ZodValidationPipe(idParamSchema)) id: string,
    @Body(new ZodValidationPipe(removerEnquadramentoSchema)) dto: RemoverEnquadramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.enquadramentos.remover(id, dto, user.sub);
  }
}
