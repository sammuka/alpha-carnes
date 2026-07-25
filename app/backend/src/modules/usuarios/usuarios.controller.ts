import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';
import { UsuariosService } from './usuarios.service';
import { createUsuarioSchema, type CreateUsuarioDto } from './dto/create-usuario.dto';
import {
  definirPerfisSchema,
  updateUsuarioSchema,
  type DefinirPerfisDto,
  type UpdateUsuarioDto,
} from './dto/update-usuario.dto';

@SkipThrottle()
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @RequirePermissoes('USUARIOS_LER')
  async listar() {
    return this.usuariosService.listar();
  }

  @Get('resumo-perfis')
  @RequirePermissoes('USUARIOS_LER')
  resumoPerfis() {
    return this.usuariosService.resumoPerfis();
  }

  @Get(':id')
  @RequirePermissoes('USUARIOS_LER')
  async detalhar(@Param('id') id: string) {
    return this.usuariosService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('USUARIOS_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createUsuarioSchema)) dto: CreateUsuarioDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usuariosService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('USUARIOS_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUsuarioSchema)) dto: UpdateUsuarioDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usuariosService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('USUARIOS_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usuariosService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('USUARIOS_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usuariosService.restaurar(id, user.sub);
  }

  @Put(':id/perfis')
  @RequirePermissoes('PERFIS_GERENCIAR')
  async definirPerfis(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(definirPerfisSchema)) dto: DefinirPerfisDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usuariosService.definirPerfis(id, dto.perfis, user.sub);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  @RequirePermissoes('USUARIOS_APROVAR')
  @Auditar('APROVAR_USUARIO', 'usuarios')
  async aprovar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.usuariosService.aprovar(id, user.sub);
  }
}
