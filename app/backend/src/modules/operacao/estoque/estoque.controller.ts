import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { EstoqueConsultaService } from './estoque-consulta.service';

@SkipThrottle()
@Controller('estoque')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EstoqueController {
  constructor(private readonly consulta: EstoqueConsultaService) {}

  @Get('consulta')
  @RequirePermissoes('ESTOQUE_LER')
  async consultar() {
    return this.consulta.consultar();
  }
}
