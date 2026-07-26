import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { listarCadastroQuerySchema, type ListarCadastroQuery } from '../../common/crud/paginacao';
import { MotoristasService } from './motoristas.service';
import {
  createMotoristaSchema, updateMotoristaSchema,
  type CreateMotoristaDto, type UpdateMotoristaDto,
} from './dto/motorista.dto';

@SkipThrottle()
@Controller('frota/motoristas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class MotoristasController {
  constructor(private readonly service: MotoristasService) {}

  @Get()
  @RequirePermissoes('FROTA_MOTORISTAS_LER')
  listar(@Query(new ZodValidationPipe(listarCadastroQuerySchema)) query: ListarCadastroQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createMotoristaSchema)) dto: CreateMotoristaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMotoristaSchema)) dto: UpdateMotoristaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('FROTA_MOTORISTAS_GERENCIAR')
  restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.restaurar(id, user.sub);
  }
}
