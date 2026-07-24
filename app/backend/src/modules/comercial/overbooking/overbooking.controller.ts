import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissoes } from '../../../common/rbac/require-permissoes.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentUser, type CurrentUserPayload } from '../../../common/decorators/current-user.decorator';
import {
  alterarPendenciaSchema,
  decidirPendenciaSchema,
  listarPendenciasSchema,
  statusDoCaminho,
  type AlterarPendenciaDto,
  type DecidirPendenciaDto,
  type ListarPendenciasDto,
} from './dto/overbooking.dto';
import { OverbookingService } from './overbooking.service';

@SkipThrottle()
@Controller('comercial/overbooking')
@UseGuards(JwtAuthGuard, RbacGuard)
export class OverbookingController {
  constructor(private readonly service: OverbookingService) {}

  @Get()
  @RequirePermissoes('PEDIDOS_LER')
  listar(@Query(new ZodValidationPipe(listarPendenciasSchema)) query: ListarPendenciasDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('PEDIDOS_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post(':id/decisao')
  @RequirePermissoes('OVERBOOKING_RESOLVER')
  decidir(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(decidirPendenciaSchema)) dto: DecidirPendenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.alterarStatus(id, statusDoCaminho(dto.caminho), dto.detalhe, user.sub);
  }

  @Patch(':id/status')
  @RequirePermissoes('OVERBOOKING_RESOLVER')
  alterar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(alterarPendenciaSchema)) dto: AlterarPendenciaDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.alterarStatus(id, dto.status, dto.detalhe, user.sub);
  }
}
