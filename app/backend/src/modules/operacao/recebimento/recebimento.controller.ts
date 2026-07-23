import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { RecebimentoService } from './recebimento.service';
import {
  atualizarMetadadosLoteSchema,
  atualizarNfeSchema,
  iniciarRecebimentoSchema,
  registrarItemSchema,
  type AtualizarMetadadosLoteDto,
  type AtualizarNfeDto,
  type IniciarRecebimentoDto,
  type RegistrarItemDto,
} from './dto/recebimento.dto';

@SkipThrottle()
@Controller('operacao/recebimentos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RecebimentoController {
  constructor(private readonly service: RecebimentoService) {}

  @Get()
  @RequirePermissoes('RECEBIMENTO_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get('previsao/:compraProgramadaId')
  @RequirePermissoes('RECEBIMENTO_LER')
  async previsao(@Param('compraProgramadaId') compraProgramadaId: string) {
    return this.service.previsaoDaCompra(compraProgramadaId);
  }

  @Get(':id')
  @RequirePermissoes('RECEBIMENTO_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Get(':id/acoes')
  @RequirePermissoes('RECEBIMENTO_LER')
  async listarAcoes(@Param('id') id: string) {
    return this.service.listarAcoes(id);
  }

  @Patch(':id/metadados')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async atualizarMetadados(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarMetadadosLoteSchema)) dto: AtualizarMetadadosLoteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const recebimento = await this.service.atualizarMetadados(id, dto, user.sub);
    return { recebimento };
  }

  @Post()
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async iniciar(
    @Body(new ZodValidationPipe(iniciarRecebimentoSchema)) dto: IniciarRecebimentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.iniciar(dto, user.sub);
  }

  @Patch(':id/nfe')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async atualizarNfe(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarNfeSchema)) dto: AtualizarNfeDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const recebimento = await this.service.atualizarNfe(id, dto, user.sub);
    return { recebimento };
  }

  @Post(':id/cancelar')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async cancelar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    const recebimento = await this.service.cancelar(id, user.sub);
    return { recebimento };
  }

  @Post(':id/itens')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async registrarItem(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarItemSchema)) dto: RegistrarItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.registrarItem(id, dto, user.sub);
  }

  @Post(':id/concluir')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async concluir(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.concluir(id, user.sub);
  }

  @Post(':id/suspender')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async suspender(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    const recebimento = await this.service.suspender(id, user.sub);
    return { recebimento };
  }
}
