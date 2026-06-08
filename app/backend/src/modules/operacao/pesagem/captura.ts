import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { formatarQtd } from '../../../common/crud/decimal';
import { PERMISSOES } from '../../../common/rbac/permissoes';
import type { BalancaGateway, SaudeDispositivo } from '../../../hardware/hardware.types';
import type { CurrentUserPayload } from '../../../common/decorators/current-user.decorator';

export interface EntradaCaptura {
  modoCaptura: 'automatico' | 'manual_assistido';
  pesoManual?: number;
  motivo?: string;
  motivoDetalhe?: string;
}

export interface ResultadoCaptura {
  peso: string;
  capturaMeta: Record<string, unknown>;
}

/**
 * Aplica o contrato ADR-009. Em automático exige leitura estável (senão lança e o
 * caller emite status). Em manual exige PESO_MANUAL (403) + pesoManual+motivo (400).
 * Nunca inventa valor. onIndisponivel permite ao caller emitir o evento de status.
 */
export async function resolverCaptura(
  balanca: BalancaGateway,
  dto: EntradaCaptura,
  user: CurrentUserPayload,
  onIndisponivel?: (saude: SaudeDispositivo) => void,
): Promise<ResultadoCaptura> {
  if (dto.modoCaptura === 'automatico') {
    const saude = balanca.status();
    if (saude.status !== 'disponivel') {
      onIndisponivel?.(saude);
      throw new ConflictException(
        'Balança indisponível ou instável: captura automática não disponível, use o modo manual assistido',
      );
    }
    const leitura = await balanca.lerEstavel();
    if (!leitura.estavel) {
      onIndisponivel?.(leitura.saude);
      throw new ConflictException('Leitura instável: confirme via modo manual assistido com motivo');
    }
    return {
      peso: formatarQtd(leitura.peso),
      capturaMeta: { leitura_estavel: true, gateway_status: leitura.saude, operador: user.sub },
    };
  }

  if (!user.permissoes.includes(PERMISSOES.PESO_MANUAL)) {
    throw new ForbiddenException('Sem permissão PESO_MANUAL para captura manual assistida');
  }
  if (dto.pesoManual === undefined || !dto.motivo) {
    throw new BadRequestException('Captura manual exige pesoManual e motivo');
  }
  return {
    peso: formatarQtd(dto.pesoManual),
    capturaMeta: {
      leitura_estavel: false,
      motivo: dto.motivo,
      motivo_detalhe: dto.motivoDetalhe ?? null,
      gateway_status: balanca.status(),
      operador: user.sub,
    },
  };
}
