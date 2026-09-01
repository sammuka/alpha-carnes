import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { ComprasProgramadasService } from './compras-programadas.service';
import {
  createCompraProgramadaSchema,
  updateCompraProgramadaSchema,
  impactoQuerySchema,
  atualizarItemCompraSchema,
  listarComprasProgramadasSchema,
  type CreateCompraProgramadaDto,
  type UpdateCompraProgramadaDto,
  type ImpactoQueryDto,
  type AtualizarItemCompraDto,
  type ListarComprasProgramadasDto,
} from './dto/compra-programada.dto';

@SkipThrottle()
@Controller('comercial/compras-programadas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ComprasProgramadasController {
  constructor(private readonly service: ComprasProgramadasService) {}

  @Get()
  @RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
  async listar(@Query(new ZodValidationPipe(listarComprasProgramadasSchema)) query: ListarComprasProgramadasDto) {
    return this.service.listar(query);
  }

  @Get(':id/impacto')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
  async impacto(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(impactoQuerySchema)) query: ImpactoQueryDto,
  ) {
    return this.service.impacto(id, query.simulacao);
  }

  @Get(':id/historico')
  @RequirePermissoes('COMPRAS_PROGRAMADAS_LER')
  async historico(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.historico(id);
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
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(atualizarItemCompraSchema)) dto: AtualizarItemCompraDto,
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
