import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditoriaConsultaService } from './auditoria.service';
import { listarAuditoriaQuerySchema, type ListarAuditoriaQuery } from './dto/auditoria.dto';

@SkipThrottle()
@Controller('auditoria')
@UseGuards(JwtAuthGuard, RbacGuard)
export class AuditoriaController {
  constructor(private readonly service: AuditoriaConsultaService) {}

  @Get('facetas')
  @RequirePermissoes('AUDITORIA_VISUALIZAR')
  facetas() {
    return this.service.facetas();
  }

  @Get()
  @RequirePermissoes('AUDITORIA_VISUALIZAR')
  listar(@Query(new ZodValidationPipe(listarAuditoriaQuerySchema)) query: ListarAuditoriaQuery) {
    return this.service.listar(query);
  }
}
