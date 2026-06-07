import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../../common/crud/paginacao';
import { OcorrenciaFornecedorService } from './ocorrencia-fornecedor.service';
import {
  abrirOcorrenciaSchema,
  atualizarOcorrenciaSchema,
  encerrarOcorrenciaSchema,
  type AbrirOcorrenciaDto,
  type AtualizarOcorrenciaDto,
  type EncerrarOcorrenciaDto,
} from './dto/ocorrencia-fornecedor.dto';

@SkipThrottle()
@Controller('operacao/ocorrencias-fornecedor')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OcorrenciaFornecedorController {
  constructor(private readonly service: OcorrenciaFornecedorService) {}

  @Get()
  @RequirePermissoes('OCORRENCIA_FORNECEDOR_GERENCIAR')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('OCORRENCIA_FORNECEDOR_GERENCIAR')
  async detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('OCORRENCIA_FORNECEDOR_GERENCIAR')
  async abrir(
    @Body(new ZodValidationPipe(abrirOcorrenciaSchema)) dto: AbrirOcorrenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const dataOperacao = await this.service.resolverDataOperacao(dto.compraProgramadaId);
    return this.service.abrir(dto, user.sub, dataOperacao);
  }

  @Patch(':id')
  @RequirePermissoes('OCORRENCIA_FORNECEDOR_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarOcorrenciaSchema)) dto: AtualizarOcorrenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.atualizar(id, dto, user.sub);
  }

  @Post(':id/encerrar')
  @RequirePermissoes('OCORRENCIA_FORNECEDOR_GERENCIAR')
  async encerrar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(encerrarOcorrenciaSchema)) dto: EncerrarOcorrenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.encerrar(id, dto, user.sub);
  }
}
