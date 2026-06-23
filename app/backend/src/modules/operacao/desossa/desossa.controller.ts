import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { FaltasService } from './faltas.service';
import { RegrasTransformacaoService } from './regras-transformacao.service';
import {
  createRegraTransformacaoSchema,
  updateRegraTransformacaoSchema,
  type CreateRegraTransformacaoDto,
  type UpdateRegraTransformacaoDto,
} from './dto/regra-transformacao.dto';

@SkipThrottle()
@Controller('desossa')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DesossaController {
  constructor(
    private readonly regras: RegrasTransformacaoService,
    private readonly faltas: FaltasService,
  ) {}

  @Get('faltas')
  @RequirePermissoes('DESOSSA_LER')
  async listarFaltas() {
    return this.faltas.listarFaltas();
  }

  @Get('regras-transformacao')
  @RequirePermissoes('DESOSSA_LER')
  async listarRegras(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.regras.listar(query);
  }

  @Get('regras-transformacao/:id')
  @RequirePermissoes('DESOSSA_LER')
  async detalharRegra(@Param('id') id: string) {
    return this.regras.detalhar(id);
  }

  @Post('regras-transformacao')
  @RequirePermissoes('DESOSSA_GERENCIAR')
  async criarRegra(
    @Body(new ZodValidationPipe(createRegraTransformacaoSchema)) dto: CreateRegraTransformacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.criar(dto, user.sub);
  }

  @Patch('regras-transformacao/:id')
  @RequirePermissoes('DESOSSA_GERENCIAR')
  async atualizarRegra(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRegraTransformacaoSchema)) dto: UpdateRegraTransformacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.atualizar(id, dto, user.sub);
  }

  @Delete('regras-transformacao/:id')
  @RequirePermissoes('DESOSSA_GERENCIAR')
  async removerRegra(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.regras.remover(id, user.sub);
  }

  @Post('regras-transformacao/:id/restaurar')
  @RequirePermissoes('DESOSSA_GERENCIAR')
  async restaurarRegra(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.regras.restaurar(id, user.sub);
  }
}
