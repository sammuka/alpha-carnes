import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { PedidosService } from './pedidos.service';
import {
  createPedidoSchema,
  reduzirItemSchema,
  type CreatePedidoDto,
  type ReduzirItemDto,
} from './dto/pedido.dto';

@SkipThrottle()
@Controller('comercial/pedidos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PedidosController {
  constructor(private readonly service: PedidosService) {}

  @Get()
  @RequirePermissoes('PEDIDOS_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('PEDIDOS_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createPedidoSchema)) dto: CreatePedidoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id/itens/:itemId')
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async reduzirItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(reduzirItemSchema)) dto: ReduzirItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.reduzirItem(id, itemId, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.cancelar(id, user.sub);
  }
}
