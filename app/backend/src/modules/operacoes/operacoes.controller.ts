import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import {
  alterarStatusOperacaoSchema,
  criarExtraordinariaSchema,
  gerarCadenciaSchema,
  listarOperacoesSchema,
  type AlterarStatusOperacaoDto,
  type CriarExtraordinariaDto,
  type GerarCadenciaDto,
  type ListarOperacoesDto,
} from './dto/operacao.dto';
import { OperacoesService } from './operacoes.service';

@SkipThrottle()
@Controller('operacoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OperacoesController {
  constructor(private readonly service: OperacoesService) {}

  @Get()
  async listar(@Query(new ZodValidationPipe(listarOperacoesSchema)) query: ListarOperacoesDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  async detalhar(@Param('id') id: string) { return this.service.detalhar(id); }

  @Post('extraordinaria')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async criarExtraordinaria(
    @Body(new ZodValidationPipe(criarExtraordinariaSchema)) dto: CriarExtraordinariaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.criarExtraordinaria(dto, user.sub); }

  @Post('gerar-cadencia')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async gerarCadencia(
    @Body(new ZodValidationPipe(gerarCadenciaSchema)) dto: GerarCadenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.gerarCadencia(dto, user.sub); }

  @Patch(':id/status')
  @RequirePermissoes('OPERACOES_GERENCIAR')
  async alterarStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(alterarStatusOperacaoSchema)) dto: AlterarStatusOperacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) { return this.service.alterarStatus(id, dto.status, user.sub); }
}
