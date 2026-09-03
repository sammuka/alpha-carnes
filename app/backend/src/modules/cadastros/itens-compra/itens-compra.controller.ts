import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  listarCadastroQuerySchema,
  type ListarCadastroQuery,
} from '../../../common/crud/paginacao';
import { ItensCompraService } from './itens-compra.service';
import {
  createItemCompraSchema,
  updateItemCompraSchema,
  type CreateItemCompraDto,
  type UpdateItemCompraDto,
} from './dto/item-compra.dto';

@SkipThrottle()
@Controller('itens-compra')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ItensCompraController {
  constructor(private readonly itensCompraService: ItensCompraService) {}

  @Get()
  @RequirePermissoes('ITENS_COMPRA_LER')
  async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
    return this.itensCompraService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('ITENS_COMPRA_LER')
  async detalhar(@Param('id') id: string) {
    return this.itensCompraService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('ITENS_COMPRA_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createItemCompraSchema)) dto: CreateItemCompraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.itensCompraService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('ITENS_COMPRA_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateItemCompraSchema)) dto: UpdateItemCompraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.itensCompraService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('ITENS_COMPRA_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.itensCompraService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('ITENS_COMPRA_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.itensCompraService.restaurar(id, user.sub);
  }
}
