import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { RotasService } from './rotas.service';
import {
  createRotaSchema,
  updateRotaSchema,
  type CreateRotaDto,
  type UpdateRotaDto,
} from './dto/rota.dto';

@SkipThrottle()
@Controller('rotas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RotasController {
  constructor(private readonly rotasService: RotasService) {}

  @Get()
  @RequirePermissoes('ROTAS_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.rotasService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('ROTAS_LER')
  async detalhar(@Param('id') id: string) {
    return this.rotasService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('ROTAS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createRotaSchema)) dto: CreateRotaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.rotasService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('ROTAS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRotaSchema)) dto: UpdateRotaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.rotasService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('ROTAS_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.rotasService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('ROTAS_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.rotasService.restaurar(id, user.sub);
  }
}
