import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { ItensComerciaisService } from './itens-comerciais.service';
import {
  createItemComercialSchema,
  updateItemComercialSchema,
  type CreateItemComercialDto,
  type UpdateItemComercialDto,
} from './dto/item-comercial.dto';

@SkipThrottle()
@Controller('itens-comerciais')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ItensComerciaisController {
  constructor(private readonly itensComerciaisService: ItensComerciaisService) {}

  @Get()
  @RequirePermissoes('ITENS_COMERCIAIS_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.itensComerciaisService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('ITENS_COMERCIAIS_LER')
  async detalhar(@Param('id') id: string) {
    return this.itensComerciaisService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('ITENS_COMERCIAIS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createItemComercialSchema)) dto: CreateItemComercialDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.itensComerciaisService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('ITENS_COMERCIAIS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateItemComercialSchema)) dto: UpdateItemComercialDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.itensComerciaisService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('ITENS_COMERCIAIS_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.itensComerciaisService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('ITENS_COMERCIAIS_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.itensComerciaisService.restaurar(id, user.sub);
  }
}
