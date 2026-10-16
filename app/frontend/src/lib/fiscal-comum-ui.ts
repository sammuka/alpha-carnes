import { extrairMensagemErro } from './error-message';
import { rotuloData, TAMANHO_BUSCA, type OpcaoCombo, type ResultadoBusca } from './fiscal-enquadramentos';

/**
 * Peças comuns às telas fiscais de regras, simulações e homologações (T03, T04 e T05):
 * texto do rodapé da grade, mensagens por campo, datas em comparações e busca de combos no servidor.
 */

export const TEXTO_SERVICO_INDISPONIVEL = 'Serviço indisponível no momento. Tente novamente.';
export const TEXTO_SEM_DIFERENCAS = 'As duas versões não têm diferenças.';
/** Rótulo do valor "antes" quando a versão não tem origem para comparar. */
export const ROTULO_NOVO = 'novo';

/** Falha de gravação exibida no formulário: texto geral e erros por campo do servidor. */
export interface FalhaSalvar {
  mensagem: string;
  porCampo: Record<string, string>;
}

/** Rodapé do protótipo (aplicacao.js L176) sem a palavra "fictícios": `Exibindo N de M registros`. */
export function textoExibindo(exibidos: number, total: number): string {
  return `Exibindo ${exibidos} de ${total} ${total === 1 ? 'registro' : 'registros'}`;
}

/** Primeira parte do caminho do Zod (`vigenciaFim.0` vira `vigenciaFim`). */
function campoDe(caminho: string): string {
  return caminho.split('.')[0] ?? caminho;
}

/** Texto único de erro 400, com o rótulo da tela diante de cada mensagem do servidor. */
export function mensagemRotulada(porCampo: Record<string, string>, rotulos: Record<string, string>): string | null {
  const entradas = Object.entries(porCampo);
  if (entradas.length === 0) return null;
  return entradas
    .map(([caminho, texto]) => {
      const rotulo = rotulos[campoDe(caminho)];
      return rotulo ? `${rotulo}: ${texto}` : texto;
    })
    .join('. ');
}

/** Mapa campo→mensagem (sem o caminho do Zod) para exibir o erro junto de cada campo. */
export function errosPorCampo(porCampo: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(porCampo).map(([caminho, texto]) => [campoDe(caminho), texto]));
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valor de uma diferença: datas ISO viram dd/MM/aaaa; ausente vira texto vazio. */
export function valorDiferenca(valor: string | null | undefined): string {
  if (valor == null) return '';
  return DATA_ISO.test(valor) ? rotuloData(valor) : valor;
}

/** Busca paginada de cadastro no servidor (parâmetro `search`) para os combos das telas fiscais. */
export async function buscarCatalogo(
  rota: string,
  termo: string,
  mapear: (linha: Record<string, unknown>) => OpcaoCombo,
  extra: Record<string, string | undefined> = {},
): Promise<ResultadoBusca> {
  const params = new URLSearchParams({ page: '1', pageSize: String(TAMANHO_BUSCA) });
  for (const [chave, valor] of Object.entries(extra)) if (valor) params.set(chave, valor);
  if (termo.trim()) params.set('search', termo.trim());
  let res: Response;
  try {
    res = await fetch(`${rota}?${params.toString()}`, { cache: 'no-store' });
  } catch {
    throw new Error('Serviço indisponível. Verifique a conexão e tente novamente.');
  }
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new Error(res.status >= 500 ? TEXTO_SERVICO_INDISPONIVEL : extrairMensagemErro(body, 'Falha ao buscar.'));
  const dados = body && typeof body === 'object' && Array.isArray((body as { data?: unknown }).data)
    ? (body as { data: Record<string, unknown>[] }).data
    : [];
  const informado = (body as { total?: unknown } | null)?.total;
  const total = typeof informado === 'number' ? informado : dados.length;
  return { opcoes: dados.map(mapear).filter((opcao) => opcao.id), total, truncado: total > dados.length };
}

/** Entrega um CSV (ou outro arquivo) ao navegador. */
export function baixarArquivo(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(url);
}

/** Combo de enquadramentos ativos com busca no servidor: "código · operação". */
export const buscarEnquadramentos = (termo: string) =>
  buscarCatalogo('/api/erp/fiscal/enquadramentos', termo, (linha) => ({
    id: linha.situacao === 'INATIVA' ? '' : String(linha.id ?? ''),
    rotulo: `${String(linha.codigo ?? '')} · ${String(linha.operacao ?? '')}`,
  }));
