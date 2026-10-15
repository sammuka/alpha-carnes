import { Body, Controller, Get, Header, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import {
  acaoSchema,
  criarCentroSchema,
  criarContaSchema,
  listarPlanoSchema,
  loteSchema,
  type CriarCentroDto,
  type CriarContaDto,
  type ListarPlanoQuery,
  type LoteDto,
} from './dto/plano.dto';
import { PlanoContasService } from './plano.service';

@SkipThrottle()
@Controller('contabilidade')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PlanoContasController {
  constructor(private readonly plano: PlanoContasService) {}

  @Get('plano')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  listar(@Query(new ZodValidationPipe(listarPlanoSchema)) query: ListarPlanoQuery) {
    return this.plano.listar(query);
  }

  @Get('plano/exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  exportar(@Query(new ZodValidationPipe(listarPlanoSchema)) query: ListarPlanoQuery) {
    return this.plano.exportarCsv(query);
  }

  @Get('centros-custo')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  centros() {
    return this.plano.listarCentrosAtivos();
  }

  @Post('centros-custo')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  criarCentro(@Body(new ZodValidationPipe(criarCentroSchema)) dto: CriarCentroDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.criarCentro(dto, user.sub);
  }

  @Post('plano')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  criar(@Body(new ZodValidationPipe(criarContaSchema)) dto: CriarContaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.criar(dto, user.sub);
  }

  @Post('plano/validar')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  validar(@Body(new ZodValidationPipe(criarContaSchema)) dto: CriarContaDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.validar(dto, user.sub);
  }

  @Post('plano/lote')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  lote(@Body(new ZodValidationPipe(loteSchema)) dto: LoteDto, @CurrentUser() user: CurrentUserPayload) {
    return this.plano.lote(dto, user.sub);
  }

  @Get('plano/:codigo/historico')
  @RequirePermissoes('CONTABILIDADE_PLANO_LER')
  historico(@Param('codigo') codigo: string) {
    return this.plano.historico(codigo);
  }

  @Post('plano/:codigo/:acao')
  @RequirePermissoes('CONTABILIDADE_PLANO_GERENCIAR')
  acao(
    @Param('codigo') codigo: string,
    @Param('acao') acao: keyof typeof acaoSchema,
    @Body() corpo: unknown,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const schema = acaoSchema[acao];
    if (!schema) throw new NotFoundException();
    return this.plano.executar(acao, codigo, schema.parse(corpo), user.sub);
  }
}
