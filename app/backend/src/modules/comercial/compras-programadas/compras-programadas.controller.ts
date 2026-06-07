import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { ComprasProgramadasService } from './compras-programadas.service';
import {
  createCompraProgramadaSchema,
  updateCompraItemSchema,
  updateCompraProgramadaSchema,
  type CreateCompraProgramadaDto,
  type UpdateCompraItemDto,
  type UpdateCompraProgramadaDto,
} from './dto/compra-programada.dto';

@SkipThrottle()
@Controller('comercial/compras-programadas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ComprasProgramadasController {
  constructor(private readonly service: ComprasProgramadasService) {}

  @Get()
  @RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createCompraProgramadaSchema)) dto: CreateCompraProgramadaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompraProgramadaSchema)) dto: UpdateCompraProgramadaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Patch(':id/itens/:itemId')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
  async atualizarItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(updateCompraItemSchema)) dto: UpdateCompraItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizarItem(id, itemId, dto, user.sub);
  }

  @Post(':id/confirmar')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
  async confirmar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.confirmar(id, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_GERENCIAR')
  async cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.cancelar(id, user.sub);
  }
}
