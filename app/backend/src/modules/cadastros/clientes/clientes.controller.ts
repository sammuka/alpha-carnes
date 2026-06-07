import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { ClientesService } from './clientes.service';
import { createClienteSchema, updateClienteSchema, type CreateClienteDto, type UpdateClienteDto } from './dto/cliente.dto';

@SkipThrottle()
@Controller('clientes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @RequirePermissoes('CLIENTES_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.clientesService.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('CLIENTES_LER')
  async detalhar(@Param('id') id: string) {
    return this.clientesService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('CLIENTES_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createClienteSchema)) dto: CreateClienteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientesService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('CLIENTES_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateClienteSchema)) dto: UpdateClienteDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.clientesService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('CLIENTES_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.clientesService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('CLIENTES_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.clientesService.restaurar(id, user.sub);
  }
}
