import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { RepresentantesService } from './representantes.service';
import {
  createRepresentanteSchema,
  updateRepresentanteSchema,
  type CreateRepresentanteDto,
  type UpdateRepresentanteDto,
} from './dto/representante.dto';

@SkipThrottle()
@Controller('representantes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RepresentantesController {
  constructor(private readonly representantesService: RepresentantesService) {}

  @Get()
  @RequirePermissoes('REPRESENTANTES_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.representantesService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('REPRESENTANTES_LER')
  async detalhar(@Param('id') id: string) {
    return this.representantesService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('REPRESENTANTES_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createRepresentanteSchema)) dto: CreateRepresentanteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.representantesService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('REPRESENTANTES_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRepresentanteSchema)) dto: UpdateRepresentanteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.representantesService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('REPRESENTANTES_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.representantesService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('REPRESENTANTES_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.representantesService.restaurar(id, user.sub);
  }
}
