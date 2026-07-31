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
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import {
  listarSifSchema,
  retificarSifSchema,
  type ListarSifDto,
  type RetificarSifDto,
} from './dto/sif.dto';
import { SifService } from './sif.service';

@SkipThrottle()
@Controller('sif/relatorios')
@UseGuards(JwtAuthGuard, RbacGuard)
export class SifController {
  constructor(private readonly service: SifService) {}

  @Get()
  @RequirePermissoes('SIF_LER')
  listar(@Query(new ZodValidationPipe(listarSifSchema)) query: ListarSifDto) {
    return this.service.listar(query.operacaoId);
  }

  @Get(':id/versoes')
  @RequirePermissoes('SIF_LER')
  versoes(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.versoes(id);
  }

  @Get(':id/preview')
  @RequirePermissoes('SIF_LER')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.preview(id);
  }

  @Post(':id/gerar')
  @RequirePermissoes('SIF_GERAR')
  gerar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.gerar(id, user.sub);
  }

  @Post(':id/retificar')
  @RequirePermissoes('SIF_GERAR')
  retificar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(retificarSifSchema)) dto: RetificarSifDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.retificar(id, user.sub, dto.motivo);
  }
}
