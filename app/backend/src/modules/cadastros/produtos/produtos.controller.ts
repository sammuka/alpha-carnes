import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  listarProdutoQuerySchema,
  type ListarProdutoQuery,
} from '../../../common/crud/paginacao';
import { ProdutosService } from './produtos.service';
import {
  createProdutoSchema,
  updateProdutoSchema,
  type CreateProdutoDto,
  type UpdateProdutoDto,
} from './dto/produto.dto';

@SkipThrottle()
@Controller('produtos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ProdutosController {
  constructor(private readonly produtosService: ProdutosService) {}

  @Get()
  @RequirePermissoes('PRODUTOS_LER')
  async listar(@Query(new ZodValidationPipe(listarProdutoQuerySchema)) query: ListarProdutoQuery) {
    return this.produtosService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('PRODUTOS_LER')
  async detalhar(@Param('id') id: string) {
    return this.produtosService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('PRODUTOS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createProdutoSchema)) dto: CreateProdutoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.produtosService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('PRODUTOS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProdutoSchema)) dto: UpdateProdutoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.produtosService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('PRODUTOS_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.produtosService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('PRODUTOS_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.produtosService.restaurar(id, user.sub);
  }
}
