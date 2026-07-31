import { buscarComparativo } from '../src/lib/aprovacoes';
import { previewRelatorio } from '../src/lib/sif';

function respostaErro(message: unknown): Response {
  return {
    ok: false,
    json: async () => ({ message }),
  } as Response;
}

describe('contratos de erro da Gestão', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('trata CONCLUSAO_INEXISTENTE mesmo quando o filtro Nest aninha message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaErro({
        codigo: 'CONCLUSAO_INEXISTENTE',
        mensagem: 'Ocorrência sem conferência tripla concluída.',
      }),
    );

    await expect(buscarComparativo('ocorrencia-1')).resolves.toBeNull();
  });

  it('trata SEM_VERSAO_GERADA mesmo quando o filtro Nest aninha message', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      respostaErro({
        codigo: 'SEM_VERSAO_GERADA',
        mensagem: 'Nenhuma versão gerada ainda para este relatório.',
      }),
    );

    await expect(previewRelatorio('relatorio-1')).resolves.toBeNull();
  });
});
