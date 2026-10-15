import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { uuidSchema } from './dto/comum.dto';
import {
  acaoRegraSchema,
  atualizarRegraSchema,
  criarRegraSchema,
  listarRegrasSchema,
  novaVersaoSchema,
  type AcaoRegraDto,
  type AtualizarRegraDto,
  type CriarRegraDto,
  type ListarRegrasQuery,
  type NovaVersaoDto,
} from './dto/regra.dto';
import { RegrasTributariasService } from './regras.service';

const compararQuerySchema = z.object({ com: uuidSchema });

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RegrasController {
  constructor(private readonly regras: RegrasTributariasService) {}

  @Get('regras')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  listar(@Query(new ZodValidationPipe(listarRegrasSchema)) query: ListarRegrasQuery) {
    return this.regras.listar(query);
  }

  @Get('regras/:id/comparar')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  comparar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Query(new ZodValidationPipe(compararQuerySchema)) query: { com: string },
  ) {
    return this.regras.comparar(id, query.com);
  }

  @Get('regras/:id/historico')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  historico(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.regras.historico(id);
  }

  @Get('regras/:id')
  @RequirePermissoes('FISCAL_REGRAS_LER')
  detalhar(@Param('id', new ZodValidationPipe(uuidSchema)) id: string) {
    return this.regras.detalhar(id);
  }

  @Post('regras')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(criarRegraSchema)) dto: CriarRegraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.criarRascunho(dto, user.sub);
  }

  @Patch('regras/:id')
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  atualizar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(atualizarRegraSchema)) dto: AtualizarRegraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.atualizarRascunho(id, dto, user.sub);
  }

  @Post('regras/:id/versoes')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  versoes(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(novaVersaoSchema)) dto: NovaVersaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.adicionarVersao(id, dto, user.sub);
  }

  @Post('regras/:id/submeter')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_REGRAS_GERENCIAR')
  submeter(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(acaoRegraSchema)) dto: AcaoRegraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.submeter(id, dto, user.sub);
  }

  @Post('regras/:id/aprovar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_REGRAS_APROVAR')
  aprovar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(acaoRegraSchema)) dto: AcaoRegraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.aprovar(id, dto, user.sub);
  }

  @Post('regras/:id/aposentar')
  @HttpCode(200)
  @RequirePermissoes('FISCAL_REGRAS_APROVAR')
  aposentar(
    @Param('id', new ZodValidationPipe(uuidSchema)) id: string,
    @Body(new ZodValidationPipe(acaoRegraSchema)) dto: AcaoRegraDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regras.aposentar(id, dto, user.sub);
  }
}
