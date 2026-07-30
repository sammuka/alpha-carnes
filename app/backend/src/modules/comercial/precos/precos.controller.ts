import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { PrecosService } from './precos.service';
import {
  copiarTabelaPrecoSchema,
  criarTabelaPrecoSchema,
  publicarTabelaPrecoSchema,
  salvarItensTabelaPrecoSchema,
  type CopiarTabelaPrecoDto,
  type CriarTabelaPrecoDto,
  type PublicarTabelaPrecoDto,
  type SalvarItensTabelaPrecoDto,
} from './dto/tabela-preco.dto';

@SkipThrottle()
@Controller('precos/tabelas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PrecosController {
  constructor(private readonly service: PrecosService) {}

  @Get()
  @RequirePermissoes('TABELA_PRECO_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('TABELA_PRECO_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  // D30 — caminho da matriz; a tabela continua `tabelas_preco_publicacoes`.
  @Get(':id/historico')
  @RequirePermissoes('TABELA_PRECO_LER')
  async historico(@Param('id') id: string) {
    return this.service.historico(id);
  }

  @Post()
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(criarTabelaPrecoSchema)) dto: CriarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id/itens')
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async salvarItens(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(salvarItensTabelaPrecoSchema)) dto: SalvarItensTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.salvarItens(id, dto, user.sub);
  }

  @Post(':id/copiar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async copiar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(copiarTabelaPrecoSchema)) dto: CopiarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.copiar(id, dto, user.sub);
  }

  @Post(':id/publicar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('TABELA_PRECO_GERENCIAR')
  async publicar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(publicarTabelaPrecoSchema)) dto: PublicarTabelaPrecoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.publicar(id, dto, user.sub);
  }
}
