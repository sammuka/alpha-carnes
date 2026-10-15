/**
 * Seed HTTP do E01-T02: reusa os usuários e o estabelecimento aprovado da T01 e cria
 * operação, produto e cliente pelas APIs já existentes. CFOP 5102 e NCM 02013000
 * nascem na jornada, pelo diálogo da tela — aqui só entram códigos de apoio.
 */
import { execFileSync } from 'node:child_process';
import type { APIRequestContext } from '@playwright/test';
import {
  criarEstabelecimentoApi,
  entrarNoFrontend,
  gerarCnpj,
  gerarIdentificadores,
  loginApi,
  prepararUsuarios,
  type EstabelecimentoSeed,
  type UsuarioE2e,
  type UsuariosE01,
} from './e01-t01-seed';
import { BACKEND_URL } from './onda6-seed';

export {
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
  type UsuariosE01,
};

const MOTIVO = 'Seed E2E E01-T02';

export interface CenarioE01T02 {
  estabelecimento: EstabelecimentoSeed;
  operacaoId: string;
  rotuloOperacao: string;
  dataOperacao: string;
  produtoId: string;
  produtoNome: string;
  clienteId: string;
  clienteNome: string;
  cfopId?: string;
  cfopCodigo?: string;
  ncmId?: string;
  ncmCodigo?: string;
  enquadramentoId?: string;
  codigoEnquadramento?: string;
}

async function api<T>(
  request: APIRequestContext,
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  rota: string,
  corpo?: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${rota}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  const dados = (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
  if (!res.ok()) throw new Error(`${method} ${rota} → ${res.status()}: ${JSON.stringify(dados)}`);
  return dados;
}

function dataFutura(offset: number): string {
  const data = new Date(Date.UTC(2091, 0, 1));
  data.setUTCDate(data.getUTCDate() + offset);
  return data.toISOString().slice(0, 10);
}

async function criarOperacao(
  request: APIRequestContext,
  cookie: string,
  rotulo: string,
): Promise<{ id: string; data: string }> {
  for (let offset = 0; offset < 500; offset += 1) {
    const data = dataFutura(offset + (Date.now() % 40));
    const res = await request.fetch(`${BACKEND_URL}/operacoes/extraordinaria`, {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      data: { data, rotulo },
    });
    if (res.status() === 409) continue;
    const corpo = (await res.json().catch(async () => ({ raw: await res.text() }))) as { id?: string };
    if (!res.ok() || !corpo.id) {
      throw new Error(`POST /operacoes/extraordinaria → ${res.status()}: ${JSON.stringify(corpo)}`);
    }
    return { id: corpo.id, data };
  }
  throw new Error('Sem data livre para a operação do E2E');
}

function codigoNumerico(digitos: number, reservados: string[]): string {
  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const base = String(Date.now() + tentativa * 97).slice(-(digitos));
    // O primeiro dígito do epoch em ms muda só a cada ~2,7 h: zero inicial vira 1 em vez de falhar a janela inteira.
    const codigo = base.padStart(digitos, '1').slice(0, digitos).replace(/^0/, '1');
    if (!reservados.includes(codigo) && !codigo.startsWith('0')) return codigo;
  }
  throw new Error('Não foi possível gerar código fiscal de apoio');
}

/** Estabelecimento aprovado, operação, produto e cliente. Sem CFOP/NCM. */
export async function criarBase(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  rotulo: string,
): Promise<CenarioE01T02> {
  const ident = gerarIdentificadores(rotulo);
  const estabelecimento = await criarEstabelecimentoApi(request, cookieA, { rotulo, cookieB });
  const operacao = await criarOperacao(request, cookieA, ident.nome);
  const produto = await api<{ id: string }>(request, cookieA, 'POST', '/produtos', {
    codigo: `P${ident.sufixo}`.slice(0, 50),
    nome: `Acém ${ident.sufixo}`,
    unidadePedido: 'kg',
  });
  const cliente = await api<{ id: string }>(request, cookieA, 'POST', '/clientes', {
    codigo: `C${ident.sufixo}`.slice(0, 50),
    razaoSocial: `Açougue ${ident.sufixo} LTDA`,
    nomeFantasia: `Açougue ${ident.sufixo}`,
    documentoFiscal: gerarCnpj(),
    faixaPreco: 'A',
  });
  return {
    estabelecimento,
    operacaoId: operacao.id,
    rotuloOperacao: ident.nome,
    dataOperacao: operacao.data,
    produtoId: produto.id,
    produtoNome: `Acém ${ident.sufixo}`,
    clienteId: cliente.id,
    clienteNome: `Açougue ${ident.sufixo}`,
  };
}

/** Base mais um enquadramento ativo, com CFOP/NCM de apoio (não 5102 / 02013000). */
export async function criarEnquadramento(
  request: APIRequestContext,
  cookieA: string,
  cookieB: string,
  rotulo: string,
): Promise<CenarioE01T02> {
  const base = await criarBase(request, cookieA, cookieB, rotulo);
  const cfopCodigo = codigoNumerico(4, ['5102']);
  const ncmCodigo = codigoNumerico(8, ['02013000']);
  const cfop = await api<{ id: string; codigo: string }>(request, cookieA, 'POST', '/fiscal/cfops', {
    codigo: cfopCodigo,
    descricao: `CFOP ${cfopCodigo}`,
    justificativa: MOTIVO,
  });
  const ncm = await api<{ id: string; codigo: string }>(request, cookieA, 'POST', '/fiscal/ncms', {
    codigo: ncmCodigo,
    descricao: `NCM ${ncmCodigo}`,
    justificativa: MOTIVO,
  });
  const criado = await api<{ id: string; codigo: string }>(request, cookieA, 'POST', '/fiscal/enquadramentos', {
    estabelecimentoId: base.estabelecimento.id,
    operacaoId: base.operacaoId,
    tpNf: '1',
    finNfe: '1',
    cfopId: cfop.id,
    abrangencia: 'INTERNA',
    tipoProduto: 'REVENDA',
    produtoId: base.produtoId,
    ncmId: ncm.id,
    cest: '1708700',
    clienteId: base.clienteId,
    vigenciaInicio: '2026-10-14',
    vigenciaFim: '2026-10-20',
    prioridade: 1,
    justificativa: MOTIVO,
  });
  return {
    ...base,
    cfopId: cfop.id,
    cfopCodigo: cfop.codigo,
    ncmId: ncm.id,
    ncmCodigo: ncm.codigo,
    enquadramentoId: criado.id,
    codigoEnquadramento: criado.codigo,
  };
}

/** Nome do banco vindo de DATABASE_URL; recusa banco sem sufixo de teste. */
export function bancoDeTeste(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL é obrigatório para o seed SQL do E2E');
  const nome = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/^[a-z0-9_]+$/.test(nome) || !/_(test|e2e|e01_t\d+)$/.test(nome)) {
    throw new Error(`Banco "${nome}" sem sufixo de teste (_test, _e2e ou _e01_tNN): seed SQL recusado`);
  }
  return nome;
}

/** Libera 5102 e 02013000 para a jornada criar os códigos pelo diálogo. */
export function liberarCodigosDaJornada(): void {
  const sql = `UPDATE cfops SET deleted_at = now() WHERE codigo = '5102' AND deleted_at IS NULL; UPDATE ncms SET deleted_at = now() WHERE codigo = '02013000' AND deleted_at IS NULL;`;
  execFileSync('docker', [
    'exec', 'alphacarnes-postgres-1',
    'psql', '-U', 'alphacarnes', '-d', bancoDeTeste(),
    '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { stdio: 'pipe' });
}

/**
 * Segunda linha ATIVA da mesma chave, para o alerta de empate. O POST do serviço
 * recusa a sobreposição; a evidência usa o mesmo atalho do teste de consulta.
 */
export function inserirEmpate(enquadramentoId: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(enquadramentoId)) {
    throw new Error('Identificador inválido para o empate');
  }
  const codigo = String(Date.now());
  const sql = `INSERT INTO enquadramentos_fiscais (codigo, empresa_id, estabelecimento_id, operacao_id, tp_nf, fin_nfe, cfop_id, abrangencia, tipo_produto, produto_id, ncm_id, cest, cliente_id, vigencia_inicio, vigencia_fim, prioridade, situacao, criado_por_id, atualizado_por_id) SELECT '${codigo}', empresa_id, estabelecimento_id, operacao_id, tp_nf, fin_nfe, cfop_id, abrangencia, tipo_produto, produto_id, ncm_id, cest, cliente_id, vigencia_inicio, vigencia_fim, 99, situacao, criado_por_id, atualizado_por_id FROM enquadramentos_fiscais WHERE id = '${enquadramentoId}'`;
  execFileSync('docker', [
    'exec', 'alphacarnes-postgres-1',
    'psql', '-U', 'alphacarnes', '-d', bancoDeTeste(),
    '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { stdio: 'pipe' });
  return codigo;
}
