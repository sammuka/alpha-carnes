/**
 * Seed HTTP do E01-T01 (empresas, estabelecimentos e regime): segundo administrador, um usuário
 * `gestor` (sem permissão fiscal) e estabelecimentos prontos para a jornada de acessibilidade.
 * Padrão de `onda10-seed.ts`: `request.fetch` direto no backend; nada de dado inventado em dev/prod.
 */
import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { validarCnpjAlfanumerico } from '../../../backend/src/common/validators/cnpj-alfanumerico';
import { ADMIN_EMAIL, BACKEND_URL, loginBackend } from './onda6-seed';

export interface UsuarioE2e {
  email: string;
  password: string;
}

export interface UsuariosE01 {
  adminA: UsuarioE2e;
  adminB: UsuarioE2e;
  gestor: UsuarioE2e;
}

export interface Identificadores {
  /** Sufixo único da execução: evita colisão de nomes, CNPJ e inscrições entre rodadas. */
  sufixo: string;
  razaoSocial: string;
  /** CNPJ completo (14 posições) com DV válido; a raiz são as 8 primeiras. */
  cnpj: string;
  nome: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
}

let contador = 0;

/** Dígito verificador do CNPJ alfanumérico (valor = ASCII − 48; pesos 2..9 da direita para a esquerda). */
function digitoVerificador(base: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = base.length - 1; i >= 0; i--) {
    soma += (base.charCodeAt(i) - 48) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ numérico único por chamada, com DV conferido pelo mesmo validador do backend (Task 1). */
export function gerarCnpj(): string {
  contador += 1;
  const raiz = String(10_000_000 + ((Date.now() + contador * 7919) % 89_999_999)).padStart(8, '0');
  const base = `${raiz}0001`;
  const dv1 = digitoVerificador(base);
  const dv2 = digitoVerificador(`${base}${dv1}`);
  const cnpj = `${base}${dv1}${dv2}`;
  if (!validarCnpjAlfanumerico(cnpj)) throw new Error(`CNPJ gerado inválido: ${cnpj}`);
  return cnpj;
}

export function gerarIdentificadores(rotulo: string): Identificadores {
  contador += 1;
  const sufixo = `${Date.now().toString(36).slice(-5)}${contador}`.toUpperCase();
  return {
    sufixo,
    razaoSocial: `Empresa ${rotulo} ${sufixo} Ltda`,
    cnpj: gerarCnpj(),
    nome: `Filial ${rotulo} ${sufixo}`,
    inscricaoEstadual: `${Date.now()}${contador}`.slice(-12),
    inscricaoMunicipal: `${Date.now()}${contador}`.slice(-9),
  };
}

function cabecalhoCookie(res: { headersArray: () => Array<{ name: string; value: string }> }): string {
  return res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => h.value.split(';')[0])
    .join('; ');
}

async function api<T>(
  request: APIRequestContext,
  cookie: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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

/** Login direto no backend; devolve o cabeçalho Cookie para as chamadas de seed. */
export async function loginApi(request: APIRequestContext, usuario: UsuarioE2e): Promise<string> {
  const res = await request.post(`${BACKEND_URL}/auth/login`, {
    data: usuario,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`Login de ${usuario.email} falhou: ${res.status()}`);
  return cabecalhoCookie(res);
}

/**
 * Login pelo BFF do frontend e cookies aplicados ao contexto do navegador.
 * O contexto é quem guarda a sessão: dois contextos = dois usuários independentes.
 */
export async function entrarNoFrontend(context: BrowserContext, baseURL: string, usuario: UsuarioE2e): Promise<void> {
  const res = await context.request.post(`${baseURL}/api/auth/login`, {
    data: usuario,
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok()) throw new Error(`Login de ${usuario.email} no frontend falhou: ${res.status()}`);
  const cookies = res
    .headersArray()
    .filter((h) => h.name.toLowerCase() === 'set-cookie')
    .map((h) => {
      const [nomeValor] = h.value.split(';');
      const igual = nomeValor!.indexOf('=');
      return { name: nomeValor!.slice(0, igual), value: nomeValor!.slice(igual + 1), url: baseURL };
    });
  await context.addCookies(cookies);
}

/** Admin A (seed), admin B e `gestor` criados pela API de usuários; e-mails únicos por rodada. */
export async function prepararUsuarios(request: APIRequestContext): Promise<UsuariosE01> {
  const { cookieHeader, password } = await loginBackend(request);
  const rodada = Date.now().toString(36);
  const senha = `E01-${rodada}-Senha!9`;
  const criar = async (rotulo: string, perfil: string): Promise<UsuarioE2e> => {
    const email = `e01-${rotulo}-${rodada}@alphacarnes.local`;
    await api(request, cookieHeader, 'POST', '/usuarios', {
      nome: `E01 ${rotulo} ${rodada}`,
      email,
      password: senha,
      perfis: [perfil],
    });
    return { email, password: senha };
  };
  return {
    adminA: { email: ADMIN_EMAIL, password },
    adminB: await criar('admin-b', 'administrador'),
    gestor: await criar('gestor', 'gestor'),
  };
}

interface DetalheMinimo {
  id: string;
  versao: number;
}

export interface EstabelecimentoSeed extends Identificadores {
  id: string;
  empresaId: string;
}

/**
 * Empresa + estabelecimento com CNAE principal e secundário. `aprovado` percorre o fluxo real
 * (A submete, B aprova); sem ele o estabelecimento fica em rascunho.
 */
export async function criarEstabelecimentoApi(
  request: APIRequestContext,
  cookieA: string,
  opcoes: { rotulo: string; cookieB?: string },
): Promise<EstabelecimentoSeed> {
  const ident = gerarIdentificadores(opcoes.rotulo);
  const justificativa = 'Seed E2E E01-T01';
  const empresa = await api<{ id: string }>(request, cookieA, 'POST', '/fiscal/empresas', {
    razaoSocial: ident.razaoSocial,
    cnpjRaiz: ident.cnpj.slice(0, 8),
    justificativa,
  });
  const criado = await api<DetalheMinimo>(request, cookieA, 'POST', '/fiscal/estabelecimentos', {
    empresaId: empresa.id,
    nome: ident.nome,
    cnpj: ident.cnpj,
    inscricaoEstadual: ident.inscricaoEstadual,
    inscricaoMunicipal: ident.inscricaoMunicipal,
    uf: 'SP',
    cnaes: [
      { codigo: '6201501', descricao: 'Desenvolvimento de programas de computador sob encomenda', tipo: 'PRINCIPAL' },
      { codigo: '6202300', descricao: 'Desenvolvimento e licenciamento de programas customizáveis', tipo: 'SECUNDARIA' },
    ],
    justificativa,
  });
  if (opcoes.cookieB) {
    const rota = `/fiscal/estabelecimentos/${criado.id}`;
    await api(request, cookieA, 'POST', `${rota}/submeter`, { versao: criado.versao, justificativa });
    const emRevisao = await api<DetalheMinimo>(request, cookieA, 'GET', rota);
    await api(request, opcoes.cookieB, 'POST', `${rota}/aprovar`, { versao: emRevisao.versao, justificativa });
  }
  return { ...ident, id: criado.id, empresaId: empresa.id };
}
