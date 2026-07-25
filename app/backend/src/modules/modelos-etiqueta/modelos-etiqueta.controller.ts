import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../common/crud/paginacao';
import { ModelosEtiquetaService } from './modelos-etiqueta.service';
import {
  createModeloEtiquetaSchema, updateModeloEtiquetaSchema,
  type CreateModeloEtiquetaDto, type UpdateModeloEtiquetaDto,
} from './dto/modelo-etiqueta.dto';

@SkipThrottle()
@Controller('modelos-etiqueta')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ModelosEtiquetaController {
  constructor(private readonly service: ModelosEtiquetaService) {}

  @Get()
  @RequirePermissoes('MODELOS_ETIQUETA_LER')
  listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createModeloEtiquetaSchema)) dto: CreateModeloEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateModeloEtiquetaSchema)) dto: UpdateModeloEtiquetaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('MODELOS_ETIQUETA_GERENCIAR')
  restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.restaurar(id, user.sub);
  }
}
