import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { EmpresasService } from './empresas.service';
import { removerSchema, uuidParamSchema, type RemoverDto } from './dto/comum.dto';
import {
  createEmpresaSchema,
  listarEmpresasQuerySchema,
  updateEmpresaSchema,
  type CreateEmpresaDto,
  type ListarEmpresasQuery,
  type UpdateEmpresaDto,
} from './dto/empresa.dto';

@SkipThrottle()
@Controller('fiscal/empresas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @RequirePermissoes('FISCAL_EMPRESAS_LER')
  listar(@Query(new ZodValidationPipe(listarEmpresasQuerySchema)) query: ListarEmpresasQuery) {
    return this.empresas.listar(query);
  }

  @Post()
  @HttpCode(201)
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createEmpresaSchema)) dto: CreateEmpresaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.empresas.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  atualizar(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(updateEmpresaSchema)) dto: UpdateEmpresaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.empresas.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FISCAL_EMPRESAS_GERENCIAR')
  remover(
    @Param('id', new ZodValidationPipe(uuidParamSchema)) id: string,
    @Body(new ZodValidationPipe(removerSchema)) dto: RemoverDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.empresas.remover(id, dto, user.sub);
  }
}
