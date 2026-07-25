import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import { listarQuerySchema, type ListarQuery } from '../../../common/crud/paginacao';
import { RegrasDesdobramentoService } from './regras-desdobramento.service';
import {
  createRegraDesdobramentoSchema,
  updateRegraDesdobramentoSchema,
  type CreateRegraDesdobramentoDto,
  type UpdateRegraDesdobramentoDto,
} from './dto/regra-desdobramento.dto';

const simularDesdobramentoSchema = z.object({
  itemCompraId: z.string().uuid(),
  quantidade: z.coerce.number().int().min(1).max(100000),
});

@SkipThrottle()
@Controller('regras-desdobramento')
@UseGuards(JwtAuthGuard, RbacGuard)
export class RegrasDesdobramentoController {
  constructor(private readonly regrasService: RegrasDesdobramentoService) {}

  @Get()
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_LER')
  async listar(@Query(new ZodValidationPipe(listarQuerySchema)) query: ListarQuery) {
    return this.regrasService.listar(query);
  }

  @Post('simular')
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_LER')
  async simular(@Body(new ZodValidationPipe(simularDesdobramentoSchema)) dto: z.infer<typeof simularDesdobramentoSchema>) {
    return this.regrasService.simular(dto.itemCompraId, dto.quantidade);
  }

  @Get(':id')
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_LER')
  async detalhar(@Param('id') id: string) {
    return this.regrasService.detalhar(id);
  }

  @Post()
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_GERENCIAR')
  async criar(
    @Body(new ZodValidationPipe(createRegraDesdobramentoSchema)) dto: CreateRegraDesdobramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regrasService.criar(dto, user.sub);
  }

  @Patch(':id')
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_GERENCIAR')
  async atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRegraDesdobramentoSchema)) dto: UpdateRegraDesdobramentoDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.regrasService.atualizar(id, dto, user.sub);
  }

  @Delete(':id')
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_GERENCIAR')
  async remover(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.regrasService.remover(id, user.sub);
  }

  @Post(':id/restaurar')
  @RequirePermissoes('REGRAS_DESDOBRAMENTO_GERENCIAR')
  async restaurar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.regrasService.restaurar(id, user.sub);
  }
}
