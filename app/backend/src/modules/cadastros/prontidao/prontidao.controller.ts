import { Controller, Get, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ProntidaoService } from './prontidao.service';

@SkipThrottle()
@Controller('cadastros')
@UseGuards(JwtAuthGuard, RbacGuard)
export class ProntidaoController {
  constructor(private readonly prontidaoService: ProntidaoService) {}

  // S3: o RbacGuard exige permissões nomeadas concretas (não "qualquer *_LER").
  // Exigimos CLIENTES_LER, que todos os perfis possuem (leitura de cadastros) — o
  // endpoint fica disponível a qualquer perfil autenticado com acesso de leitura.
  @Get('prontidao')
  @RequirePermissoes('CLIENTES_LER')
  async prontidao() {
    return this.prontidaoService.verificarProntidaoCadastros();
  }
}
