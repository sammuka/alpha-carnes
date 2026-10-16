import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, type CurrentUserPayload } from '../../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../../common/guards/rbac.guard';
import { ZodValidationPipe } from '../../../../common/pipes/zod-validation.pipe';
import { RequirePermissoes } from '../../../../common/rbac/require-permissoes.decorator';
import { NcmsService } from './ncms.service';
import { createNcmSchema, type CreateNcmDto } from './dto/ncm.dto';
import { listarCodigoFiscalQuerySchema, type ListarCodigoFiscalQuery } from './dto/cfop.dto';

@SkipThrottle()
@Controller('fiscal')
@UseGuards(JwtAuthGuard, RbacGuard)
export class NcmsController {
  constructor(private readonly ncms: NcmsService) {}

  @Get('ncms')
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_LER')
  listar(@Query(new ZodValidationPipe(listarCodigoFiscalQuerySchema)) query: ListarCodigoFiscalQuery) {
    return this.ncms.listar(query);
  }

  @Post('ncms')
  @HttpCode(201)
  @RequirePermissoes('FISCAL_ENQUADRAMENTOS_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(createNcmSchema)) dto: CreateNcmDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.ncms.criar(dto, user.sub);
  }
}
