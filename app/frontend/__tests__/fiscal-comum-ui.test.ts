import {
  baixarArquivo,
  buscarCatalogo,
  errosPorCampo,
  mensagemRotulada,
  textoExibindo,
  valorDiferenca,
} from '../src/lib/fiscal-comum-ui';

function resposta(status: number, corpo: unknown): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const res = new Response(JSON.stringify(corpo), { status, headers });
  if (typeof res.headers?.get !== 'function') Object.defineProperty(res, 'headers', { value: headers });
  return res;
}

describe('fiscal-comum-ui', () => {
  it('rodapé "Exibindo N de M" conforme o protótipo', () => {
    expect(textoExibindo(20, 45)).toBe('Exibindo 20 de 45 registros');
    expect(textoExibindo(1, 1)).toBe('Exibindo 1 de 1 registro');
    expect(textoExibindo(0, 0)).toBe('Exibindo 0 de 0 registros');
  });

  it('mensagem 400 leva o rótulo da tela e ignora o caminho do Zod', () => {
    const rotulos = { cfopId: 'Operação fiscal (CFOP)', justificativa: 'Motivo da alteração' };
    expect(mensagemRotulada({ cfopId: 'Invalid UUID', justificativa: 'Muito curto' }, rotulos))
      .toBe('Operação fiscal (CFOP): Invalid UUID. Motivo da alteração: Muito curto');
    expect(mensagemRotulada({ 'campoDesconhecido.0': 'ruim' }, rotulos)).toBe('ruim');
    expect(mensagemRotulada({}, rotulos)).toBeNull();
    expect(errosPorCampo({ 'cfopId.0': 'x', justificativa: 'y' })).toEqual({ cfopId: 'x', justificativa: 'y' });
  });

  it('valor de diferença: data ISO em dd/MM/aaaa, nulo vazio, texto intacto', () => {
    expect(valorDiferenca('2026-01-31')).toBe('31/01/2026');
    expect(valorDiferenca('Sem fim de vigência')).toBe('Sem fim de vigência');
    expect(valorDiferenca('12,00')).toBe('12,00');
    expect(valorDiferenca(null)).toBe('');
  });

  it('busca no servidor envia search, devolve opções e avisa truncamento', async () => {
    const fetchMock = jest.fn(async () => resposta(200, { data: [{ id: 'a', nome: 'Um' }, { id: 'b', nome: 'Dois' }], total: 80 }));
    global.fetch = fetchMock as unknown as typeof fetch;
    const r = await buscarCatalogo('/api/x', ' um ', (l) => ({ id: String(l.id), rotulo: String(l.nome) }), { situacao: 'APROVADA', vazio: undefined });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown as [string])[0]), 'http://localhost');
    expect(url.pathname).toBe('/api/x');
    expect(url.searchParams.get('search')).toBe('um');
    expect(url.searchParams.get('situacao')).toBe('APROVADA');
    expect(url.searchParams.has('vazio')).toBe(false);
    expect(r).toEqual({ opcoes: [{ id: 'a', rotulo: 'Um' }, { id: 'b', rotulo: 'Dois' }], total: 80, truncado: true });
  });

  it('busca no servidor não engole a falha', async () => {
    const mapa = () => ({ id: '1', rotulo: 'a' });
    global.fetch = jest.fn(async () => resposta(500, {})) as unknown as typeof fetch;
    await expect(buscarCatalogo('/api/x', '', mapa)).rejects.toThrow('Serviço indisponível no momento. Tente novamente.');
    global.fetch = jest.fn(async () => resposta(400, { message: 'Termo inválido.' })) as unknown as typeof fetch;
    await expect(buscarCatalogo('/api/x', '', mapa)).rejects.toThrow('Termo inválido.');
    global.fetch = jest.fn(async () => { throw new Error('rede'); }) as unknown as typeof fetch;
    await expect(buscarCatalogo('/api/x', '', mapa)).rejects.toThrow('Verifique a conexão');
  });

  it('baixa o arquivo pelo navegador', () => {
    const revogar = jest.fn();
    Object.assign(URL, { createObjectURL: jest.fn(() => 'blob:x'), revokeObjectURL: revogar });
    const clique = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    baixarArquivo(new Blob(['a']), 'arquivo.csv');
    expect(clique).toHaveBeenCalled();
    expect(revogar).toHaveBeenCalledWith('blob:x');
    clique.mockRestore();
  });
});
