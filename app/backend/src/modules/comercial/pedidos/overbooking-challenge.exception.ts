import { ConflictException } from '@nestjs/common';

export interface OverbookingChallengeItem {
  produtoId: string;
  produtoCodigo: string | null;
  produtoNome: string | null;
  disponivelAntes: string;
  quantidadeSolicitada: string;
  overbookingGerado: string;
  mensagem: string;
}

export class OverbookingChallengeException extends ConflictException {
  constructor(itens: OverbookingChallengeItem[]) {
    super({
      code: 'OVERBOOKING_CONFIRMACAO_NECESSARIA',
      message: 'Disponibilidade insuficiente',
      itens,
    });
  }
}
