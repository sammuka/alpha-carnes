import { RegrasTransformacaoService } from '../../src/modules/operacao/desossa/regras-transformacao.service';

type RegraAtivaComSaidas = {
  id: string;
  nome: string;
  saidas: Array<{ produtoId: string; produtoNome: string; quantidadeFixa: string }>;
};

function criarServiceCom(regras: RegraAtivaComSaidas[]) {
  const service = new RegrasTransformacaoService({ db: {} as never } as never, {} as never);
  jest
    .spyOn(
      service as RegrasTransformacaoService & { listarAtivasComSaidas: () => Promise<RegraAtivaComSaidas[]> },
      'listarAtivasComSaidas',
    )
    .mockResolvedValue(regras);
  return service;
}

describe('simulador-desossa', () => {
  it('simulador de desossa respeita exclusividade por unidade de TZ', async () => {
    const service = criarServiceCom([
      { id: 'a', nome: 'Alternativa A', saidas: [
        { produtoId: 'coxao-bola', produtoNome: 'Coxão-bola', quantidadeFixa: '1' },
        { produtoId: 'jacare', produtoNome: 'Jacaré', quantidadeFixa: '1' },
      ] },
      { id: 'b', nome: 'Alternativa B', saidas: [
        { produtoId: 'coxao-bola-alcatra', produtoNome: 'Coxão-bola com alcatra', quantidadeFixa: '1' },
        { produtoId: 'file-curto', produtoNome: 'Filé curto', quantidadeFixa: '1' },
      ] },
    ]);

    const r = await service.simular({ tzLivre: 10, produtoId: 'jacare', quantidade: 10 });
    expect(r.alternativasPossiveis.map((a) => a.id)).toEqual(['a']);
    expect(r.resultados.find((x) => x.produtoId === 'file-curto')?.bloqueado).toBe(true);
    expect(r.resultados.find((x) => x.produtoId === 'coxao-bola')?.bloqueado).toBe(false);
  });

  it('simulador de desossa lista alternativas possiveis', async () => {
    const service = criarServiceCom([]);
    const r = await service.simular({ tzLivre: 10 });
    expect(r.alternativasPossiveis).toEqual([]);
    expect(r.resultados).toEqual([]);
  });
});
