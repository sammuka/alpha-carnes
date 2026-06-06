import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Auditar } from '../../common/decorators/auditar.decorator';
import { UsuariosService } from './usuarios.service';
import { createUsuarioSchema } from './dto/create-usuario.dto';
import type { CreateUsuarioDto } from './dto/create-usuario.dto';

@SkipThrottle()
@Controller('usuarios')
@UseGuards(JwtAuthGuard, RbacGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @RequirePermissoes('USUARIOS_GERENCIAR')
  @Auditar('CRIAR_USUARIO', 'usuarios')
  async criar(
    @Body(new ZodValidationPipe(createUsuarioSchema)) dto: CreateUsuarioDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usuariosService.criar(dto, user.sub);
  }

  @Post(':id/aprovar')
  @HttpCode(200)
  @RequirePermissoes('USUARIOS_APROVAR')
  @Auditar('APROVAR_USUARIO', 'usuarios')
  async aprovar(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.usuariosService.aprovar(id, user.sub);
  }

  @Get()
  @RequirePermissoes('USUARIOS_GERENCIAR')
  async listar() {
    return this.usuariosService.listar();
  }
}
