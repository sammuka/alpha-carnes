import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DisponibilidadeService } from './disponibilidade.service';
import { MapaService } from './mapa.service';
import { listarDisponibilidadeSchema, type ListarDisponibilidadeQuery } from './dto/disponibilidade.dto';
import { consultarMapaSchema, drillDownSchema, type ConsultarMapaDto, type DrillDownDto } from './dto/mapa.dto';

@SkipThrottle()
@Controller('comercial/disponibilidade')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DisponibilidadeController {
  constructor(
    private readonly service: DisponibilidadeService,
    private readonly mapa: MapaService,
  ) {}

  // Declarado antes de qualquer rota `:param` — evita colisão de path.
  @Get('mapa')
  @RequirePermissoes('DISPONIBILIDADE_LER')
  async consultarMapa(@Query(new ZodValidationPipe(consultarMapaSchema)) query: ConsultarMapaDto) {
    return this.mapa.consultar(query.operacaoId, query.produtoId);
  }

  @Get('mapa/:produtoId/detalhe')
  @RequirePermissoes('DISPONIBILIDADE_LER')
  async detalharMapa(
    @Param('produtoId') produtoId: string,
    @Query(new ZodValidationPipe(drillDownSchema)) query: DrillDownDto,
  ) {
    return this.mapa.detalhar(query.operacaoId, produtoId, query.estado);
  }

  @Get()
  @RequirePermissoes('DISPONIBILIDADE_LER')
  async listar(@Query(new ZodValidationPipe(listarDisponibilidadeSchema)) query: ListarDisponibilidadeQuery) {
    return this.service.listar(query);
  }
}
