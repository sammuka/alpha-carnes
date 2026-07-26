import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../common/crud/paginacao';
import { ParametrosService } from './parametros.service';
import {
  atualizarValorSchema,
  createParametroSchema,
  updateParametroSchema,
  type CreateParametroDto,
  type UpdateParametroDto,
} from './dto/parametro.dto';

@SkipThrottle()
@Controller('parametros')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ParametrosController {
  constructor(private readonly parametrosService: ParametrosService) {}

  @Get()
  @RequirePermissoes('PARAMETROS_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.parametrosService.listar(query);
  }

  @Get('chave/:chave')
  @RequirePermissoes('PARAMETROS_LER')
  detalharPorChave(@Param('chave') chave: string) {
    return this.parametrosService.detalharPorChave(chave);
  }

  @Patch('chave/:chave')
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  atualizarPorChave(
    @Param('chave') chave: string,
    @Body(new ZodValidationPipe(atualizarValorSchema)) dto: { valorJson: Record<string, unknown> },
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.parametrosService.atualizarPorChave(chave, dto.valorJson, user.sub);
  }

  @Get(':id')
  @RequirePermissoes('PARAMETROS_LER')
  async detalhar(@Param('id') id: string) {
    return this.parametrosService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createParametroSchema)) dto: CreateParametroDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.parametrosService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateParametroSchema)) dto: UpdateParametroDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.parametrosService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.parametrosService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('PARAMETROS_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.parametrosService.restaurar(id, user.sub);
  }
}
