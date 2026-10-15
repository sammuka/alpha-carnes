import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import {
  aprovarSchema,
  configurarSchema,
  editarSchema,
  listarPoliticasSchema,
  loteSchema,
  simularSchema,
  type AprovarPoliticaDto,
  type ConfigurarPoliticaDto,
  type EditarPoliticaDto,
  type ListarPoliticasQuery,
  type LotePoliticaDto,
  type SimularPoliticaDto,
} from './dto/politicas.dto';
import { PoliticasContabilizacaoService } from './politicas.service';

@SkipThrottle()
@Controller('contabilidade/politicas')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PoliticasContabilizacaoController {
  constructor(private readonly politicas: PoliticasContabilizacaoService) {}

  @Get()
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  listar(@Query(new ZodValidationPipe(listarPoliticasSchema)) query: ListarPoliticasQuery) {
    return this.politicas.listar(query);
  }

  @Get('exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="politicas-de-contabilizacao.csv"')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  exportar(@Query(new ZodValidationPipe(listarPoliticasSchema)) query: ListarPoliticasQuery) {
    return this.politicas.exportarCsv(query);
  }

  @Get('opcoes')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  opcoes() {
    return this.politicas.listarOpcoes();
  }

  @Post()
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  configurar(@Body(new ZodValidationPipe(configurarSchema)) dto: ConfigurarPoliticaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.politicas.configurar(dto, user.sub);
  }

  @Post('validar')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  validar(@Body(new ZodValidationPipe(configurarSchema)) dto: ConfigurarPoliticaDto) {
    return this.politicas.validar(dto);
  }

  @Post('lote')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  lote(@Body(new ZodValidationPipe(loteSchema)) dto: LotePoliticaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.politicas.lote(dto, user.sub);
  }

  @Get(':codigo/historico')
  @RequirePermissoes('CONTABILIDADE_POLITICA_LER')
  historico(@Param('codigo') codigo: string) {
    return this.politicas.historico(codigo);
  }

  @Post(':codigo/editar')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  editar(
    @Param('codigo') codigo: string,
    @Body(new ZodValidationPipe(editarSchema)) dto: EditarPoliticaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.politicas.editar(codigo, dto, user.sub);
  }

  @Post(':codigo/simular')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  simular(
    @Param('codigo') codigo: string,
    @Body(new ZodValidationPipe(simularSchema)) dto: SimularPoliticaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.politicas.simular(codigo, dto, user.sub);
  }

  @Post(':codigo/aprovar')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  aprovar(
    @Param('codigo') codigo: string,
    @Body(new ZodValidationPipe(aprovarSchema)) dto: AprovarPoliticaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.politicas.aprovar(codigo, dto, user.sub);
  }
}
