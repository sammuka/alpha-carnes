import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { PedidosService } from './pedidos.service';
import { AdendosService } from './adendos.service';
import {
  buscarPedidoAbertoSchema,
  cancelarPedidoSchema,
  confirmarCriacaoOverbookingSchema,
  confirmarInclusaoOverbookingSchema,
  createPedidoSchema,
  incluirItemSchema,
  liberarReservaSchema,
  reduzirItemSchema,
  removerItemSchema,
  type BuscarPedidoAbertoDto,
  type CancelarPedidoDto,
  type ConfirmarInclusaoOverbookingDto,
  type CreatePedidoDto,
  type IncluirItemDto,
  type LiberarReservaDto,
  type ReduzirItemDto,
  type RemoverItemDto,
} from './dto/pedido.dto';
import { registrarAdendoSchema, type RegistrarAdendoDto } from './dto/adendo.dto';

@SkipThrottle()
@Controller('comercial/pedidos')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PedidosController {
  constructor(
    private readonly service: PedidosService,
    private readonly adendos: AdendosService,
  ) {}

  @Get()
  @RequirePermissoes('PEDIDOS_LER')
  async listar(
    @Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.listar(query, user.sub);
  }

  @Get('aberto')
  @RequirePermissoes('PEDIDOS_LER')
  async buscarAberto(
    @Query(new ZodValidationPipe(buscarPedidoAbertoSchema)) query: BuscarPedidoAbertoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.buscarAberto(query, user.sub);
  }

  @Get(':id')
  @RequirePermissoes('PEDIDOS_LER')
  async detalhar(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.detalhar(id, user.sub);
  }

  @Post()
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createPedidoSchema)) dto: CreatePedidoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub, false);
  }

  @Post('confirmar-overbooking')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
  async confirmarCriacao(
    @Body(new ZodValidationPipe(confirmarCriacaoOverbookingSchema)) dto: CreatePedidoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub, true);
  }

  @Post(':id/itens/confirmar-overbooking')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
  async confirmarInclusao(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmarInclusaoOverbookingSchema)) dto: ConfirmarInclusaoOverbookingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.incluirItem(id, dto, user.sub, true);
  }

  @Post(':id/itens')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async incluir(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(incluirItemSchema)) dto: IncluirItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.incluirItem(id, dto, user.sub, false);
  }

  @Post(':id/finalizar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('PEDIDO_FINALIZAR')
  async finalizar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.finalizar(id, user.sub);
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

  @Delete(':id/itens/:itemId')
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async removerItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(removerItemSchema)) dto: RemoverItemDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.removerItem(id, itemId, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async cancelar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelarPedidoSchema)) dto: CancelarPedidoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.cancelarPedido(id, dto.motivo, user.sub);
  }

  @Post(':id/liberar-reserva')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('PEDIDO_RESERVA_LIBERAR')
  async liberarReserva(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(liberarReservaSchema)) dto: LiberarReservaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.liberarReservaAdministrativa(id, dto, user.sub);
  }

  @Post(':id/adendos')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissoes('PEDIDOS_GERENCIAR')
  async registrarAdendo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarAdendoSchema)) dto: RegistrarAdendoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adendos.registrar(id, dto, user.sub, false);
  }

  @Post(':id/adendos/confirmar-overbooking')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissoes('PEDIDO_OVERBOOKING_CONFIRMAR')
  async confirmarAdendoOverbooking(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarAdendoSchema)) dto: RegistrarAdendoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adendos.registrar(id, dto, user.sub, true);
  }

  @Get(':id/adendos')
  @RequirePermissoes('PEDIDOS_LER')
  async listarAdendos(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.adendos.listar(id, user.sub);
  }
}
