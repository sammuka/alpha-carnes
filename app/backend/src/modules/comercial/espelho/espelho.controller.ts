import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { EspelhoService } from './espelho.service';
import { consultarEspelhoSchema, type ConsultarEspelhoDto } from './dto/espelho.dto';

@SkipThrottle()
@Controller('comercial/espelho')
@UseGuards(JwtAuthGuard, RbacGuard)
export class EspelhoController {
  constructor(private readonly service: EspelhoService) {}

  @Get()
  @RequirePermissoes('ESPELHO_COMERCIAL_LER')
  async consultar(
    @Query(new ZodValidationPipe(consultarEspelhoSchema)) query: ConsultarEspelhoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.formato === 'csv') {
      const csv = await this.service.exportarCsv(query);
      res.set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="espelho-comercial-${query.dataOperacao}.csv"`,
      });
      return csv;
    }
    return this.service.consultar(query);
  }
}
