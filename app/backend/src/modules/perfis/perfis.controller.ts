import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PerfisService } from './perfis.service';
import {
  definirMenusSchema,
  definirPermissoesSchema,
  type DefinirMenusDto,
  type DefinirPermissoesDto,
} from './dto/perfil.dto';

@SkipThrottle()
@Controller('perfis')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PerfisController {
  constructor(private readonly perfisService: PerfisService) {}

  @Get()
  @RequirePermissoes('PERFIS_GERENCIAR')
  async listar() {
    return this.perfisService.listar();
  }

  @Get('catalogo')
  @RequirePermissoes('PERFIS_GERENCIAR')
  catalogo() {
    return this.perfisService.catalogo();
  }

  @Put(':slug/menus')
  @RequirePermissoes('PERFIS_GERENCIAR')
  async definirMenus(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(definirMenusSchema)) dto: DefinirMenusDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.perfisService.definirMenus(slug, dto.menus, user.sub);
  }

  @Put(':slug/permissoes')
  @RequirePermissoes('PERFIS_GERENCIAR')
  async definirPermissoes(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(definirPermissoesSchema)) dto: DefinirPermissoesDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.perfisService.definirPermissoes(slug, dto.permissoes, user.sub);
  }
}
