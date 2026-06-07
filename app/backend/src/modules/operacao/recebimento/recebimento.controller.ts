import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { RecebimentoService } from './recebimento.service';
import {
  iniciarRecebimentoSchema,
  registrarItemSchema,
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

  @Get(':id')
  @RequirePermissoes('RECEBIMENTO_LER')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async iniciar(
    @Body(new ZodValidationPipe(iniciarRecebimentoSchema)) dto: IniciarRecebimentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.iniciar(dto, user.sub);
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
}
