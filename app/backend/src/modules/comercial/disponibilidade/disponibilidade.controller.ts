import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DisponibilidadeService } from './disponibilidade.service';
import { listarDisponibilidadeSchema, type ListarDisponibilidadeQuery } from './dto/disponibilidade.dto';

@SkipThrottle()
@Controller('comercial/disponibilidade')
@UseGuards(JwtAuthGuard, RbacGuard)
export class DisponibilidadeController {
  constructor(private readonly service: DisponibilidadeService) {}

  @Get()
  @RequirePermissoes('DISPONIBILIDADE_LER')
  async listar(@Query(new ZodValidationPipe(listarDisponibilidadeSchema)) query: ListarDisponibilidadeQuery) {
    return this.service.listar(query);
  }
}
