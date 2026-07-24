import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  criarPedidoFornecedorSchema,
  listarPedidosFornecedorSchema,
  registrarNfSchema,
  type CriarPedidoFornecedorDto,
  type ListarPedidosFornecedorDto,
  type RegistrarNfDto,
} from './dto/pedido-fornecedor.dto';
import { PedidoFornecedorService } from './pedido-fornecedor.service';

@SkipThrottle()
@Controller('operacao/pedidos-fornecedor')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PedidoFornecedorController {
  constructor(private readonly service: PedidoFornecedorService) {}

  @Get()
  @RequirePermissoes('RECEBIMENTO_LER')
  listar(@Query(new ZodValidationPipe(listarPedidosFornecedorSchema)) query: ListarPedidosFornecedorDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  @RequirePermissoes('RECEBIMENTO_LER')
  detalhar(@Param('id') id: string) {
    return this.service.detalhar(id);
  }

  @Post()
  @RequirePermissoes('PEDIDO_FORNECEDOR_GERENCIAR')
  criar(
    @Body(new ZodValidationPipe(criarPedidoFornecedorSchema)) dto: CriarPedidoFornecedorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.criar(dto, user.sub);
  }

  @Post(':id/enviar')
  @HttpCode(HttpStatus.OK)
  @RequirePermissoes('PEDIDO_FORNECEDOR_GERENCIAR')
  enviar(@Param('id') id: string, @CurrentUser() user: CurrentUserPayload) {
    return this.service.enviar(id, user.sub);
  }

  @Post(':id/nf')
  @RequirePermissoes('RECEBIMENTO_GERENCIAR')
  async registrarNf(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarNfSchema)) dto: RegistrarNfDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.service.registrarNf(id, dto, user.sub);
  }
}
