import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { AprovacoesService } from './aprovacoes.service';
import { ComparativoService } from './comparativo.service';
import {
  abrirAprovacaoSchema,
  decidirAprovacaoSchema,
  listarAprovacoesSchema,
  type AbrirAprovacaoDto,
  type DecidirAprovacaoDto,
  type ListarAprovacoesDto,
} from './dto/aprovacoes.dto';

@SkipThrottle()
@Controller('gestao/aprovacoes')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AprovacoesController {
  constructor(
    private readonly service: AprovacoesService,
    private readonly comparativo: ComparativoService,
  ) {}

  @Get()
  @RequirePermissoes('APROVACOES_LER')
  listar(@Query(new ZodValidationPipe(listarAprovacoesSchema)) query: ListarAprovacoesDto) {
    return this.service.listar(query);
  }

  @Get('ocorrencias/:id/comparativo')
  @RequirePermissoes('APROVACOES_LER')
  comparativoDaOcorrencia(@Param('id', ParseUUIDPipe) id: string) {
    return this.comparativo.doOcorrencia(id);
  }

  @Post('operacionais')
  @RequirePermissoes('APROVACOES_SOLICITAR')
  abrir(
    @Body(new ZodValidationPipe(abrirAprovacaoSchema)) dto: AbrirAprovacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.abrir(dto, user.sub);
  }

  @Post('operacionais/:id/decidir')
  @RequirePermissoes('APROVACOES_DECIDIR')
  decidir(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(decidirAprovacaoSchema)) dto: DecidirAprovacaoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.decidir(id, dto, user.sub);
  }
}
