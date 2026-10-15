import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
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

  @Post(':codigo/:acao')
  @RequirePermissoes('CONTABILIDADE_POLITICA_GERENCIAR')
  acao(
    @Param('codigo') codigo: string,
    @Param('acao') acao: 'editar' | 'simular' | 'aprovar',
    @Body() corpo: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const schema = acao === 'editar' ? editarSchema : acao === 'simular' ? simularSchema : acao === 'aprovar' ? aprovarSchema : null;
    if (!schema) throw new NotFoundException();
    const dto = schema.parse(corpo) as EditarPoliticaDto | SimularPoliticaDto | AprovarPoliticaDto;
    return this.politicas.executar(acao, codigo, dto, user.sub);
  }
}
