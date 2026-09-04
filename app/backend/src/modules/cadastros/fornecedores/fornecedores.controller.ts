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
import { FornecedoresService } from './fornecedores.service';
import {
  createFornecedorSchema,
  updateFornecedorSchema,
  type CreateFornecedorDto,
  type UpdateFornecedorDto,
} from './dto/fornecedor.dto';

@SkipThrottle()
@Controller('fornecedores')
@UseGuards(JwtAuthGuard, RbacGuard)
export class FornecedoresController {
  constructor(private readonly fornecedoresService: FornecedoresService) {}

  @Get()
  @RequirePermissoes('FORNECEDORES_LER')
  async listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
    return this.fornecedoresService.listar(query);
  }

  @Get('contagens')
  @RequirePermissoes('FORNECEDORES_LER')
  contagens() {
    return this.fornecedoresService.contagens();
  }

  @Get(':id/historico')
  @RequirePermissoes('FORNECEDORES_LER')
  historico(@Param('id') id: string) {
    return this.fornecedoresService.historico(id);
  }

  @Get(':id')
  @RequirePermissoes('FORNECEDORES_LER')
  async detalhar(@Param('id') id: string) {
    return this.fornecedoresService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('FORNECEDORES_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createFornecedorSchema)) dto: CreateFornecedorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fornecedoresService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FORNECEDORES_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateFornecedorSchema)) dto: UpdateFornecedorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.fornecedoresService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FORNECEDORES_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.fornecedoresService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('FORNECEDORES_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.fornecedoresService.restaurar(id, user.sub);
  }
}
