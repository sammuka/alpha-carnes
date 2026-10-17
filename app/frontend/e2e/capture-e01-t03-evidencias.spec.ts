/**
 * E01-T03 — captura de evidências fail-hard (Task 14). Não é regressão contínua:
 * gera os PNG de docs/evidencias/e01-t03, com um elemento-chave visível antes
 * de cada screenshot. A lista abaixo é a conta: 9 pares e 8 estados só da aplicação.
 */
import { request as playwrightRequest, test, expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  criarCenario,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T03,
  type UsuarioE2e,
  type UsuariosE01,
} from './helpers/e01-t03-seed';
import { executarSql } from './helpers/banco';
import { escolherCombo, valorCampo } from './helpers/fiscal-ui';
import { BACKEND_URL } from './helpers/onda6-seed';

const TITULO = 'Editor de regras tributárias';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o editor de regras tributárias.';
const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
const AVISO = 'Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal.';
const SEGREGACAO = 'A aprovação deve ser feita por usuário diferente de quem submeteu.';
const VIGENCIA = 'Já existe versão aprovada deste enquadramento com vigência sobreposta. Nenhuma foi escolhida.';
const BENEFICIO = 'O benefício fiscal selecionado não está ativo.';
const COMPARACAO = 'Alíquota (%): 12,00 → 7,00';
const MOTIVO = 'Evidência visual E01-T03';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e01-t03');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E01-T03`;

const ESPERADOS = [
  'app-lista.png',
  'prototipo-lista.png',
  'app-ficha.png',
  'prototipo-ficha.png',
  'app-movimentacoes.png',
  'prototipo-movimentacoes.png',
  'app-regras.png',
  'prototipo-regras.png',
  'app-excecoes.png',
  'prototipo-excecoes.png',
  'app-historico.png',
  'prototipo-historico.png',
  'app-integracoes.png',
  'prototipo-integracoes.png',
  'app-aceite.png',
  'prototipo-aceite.png',
  'app-drawer.png',
  'prototipo-drawer.png',
  'app-vazio.png',
  'app-erro-retry.png',
  'app-403.png',
  'app-comparar.png',
  'app-beneficio-nao-elegivel.png',
  'app-vigencia-ambigua.png',
  'app-segregacao.png',
  'app-dialogo-beneficio.png',
];

const ABAS_PROTOTIPO: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Ficha e campos', arquivo: 'prototipo-ficha.png', chave: 'Trilha e responsabilização' },
  { aba: 'Movimentações', arquivo: 'prototipo-movimentacoes.png', chave: 'Acontecimentos simulados' },
  { aba: 'Regras e validações', arquivo: 'prototipo-regras.png', chave: 'Caminho de aprovação' },
  { aba: 'Exceções', arquivo: 'prototipo-excecoes.png', chave: 'Simular erro de validação' },
  { aba: 'Histórico', arquivo: 'prototipo-historico.png', chave: 'Cadastro de demonstração preparado' },
  { aba: 'Integrações', arquivo: 'prototipo-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'prototipo-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

const ABAS_APP: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Movimentações', arquivo: 'app-movimentacoes.png', chave: 'Etapas e evidências de negócio' },
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'motor de regras não permite edição retroativa em nota emitida; aprovação segregada' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Versão NT inválida' },
  { aba: 'Histórico', arquivo: 'app-historico.png', chave: 'Rascunho criado' },
  { aba: 'Integrações', arquivo: 'app-integracoes.png', chave: 'Dependências e conexões do domínio' },
  { aba: 'Aceite e testes', arquivo: 'app-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

interface RegraMinima {
  id: string;
  versao: number;
  operacaoId: string;
  cfopId: string;
  enquadramentoId: string;
  beneficioFiscalId: string;
  classificacaoIbsCbsId: string;
}

let cookieA = '';
let cookieB = '';
let requestApi: APIRequestContext;

async function api<T>(cookie: string, method: 'GET' | 'POST', rota: string, corpo?: unknown): Promise<T> {
  const res = await requestApi.fetch(`${BACKEND_URL}${rota}`, {
    method,
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: corpo,
  });
  const dados = (await res.json().catch(async () => ({ raw: await res.text() }))) as T;
  if (!res.ok()) throw new Error(`${method} ${rota} → ${res.status()}: ${JSON.stringify(dados)}`);
  return dados;
}

async function garantirCodigo(rota: string, codigo: string, descricao: string): Promise<string> {
  const res = await requestApi.fetch(`${BACKEND_URL}${rota}`, {
    method: 'POST',
    headers: { Cookie: cookieA, 'Content-Type': 'application/json' },
    data: { codigo, descricao, justificativa: MOTIVO },
  });
  const corpo = (await res.json().catch(async () => ({}))) as { id?: string };
  if (res.ok() && corpo.id) return corpo.id;
  if (res.status() !== 409) throw new Error(`POST ${rota} → ${res.status()}: ${JSON.stringify(corpo)}`);
  const lista = await api<{ data: Array<{ id: string; codigo: string }> }>(
    cookieA, 'GET', `${rota}?search=${encodeURIComponent(codigo)}&pageSize=20`,
  );
  const achado = lista.data.find((item) => item.codigo === codigo);
  if (!achado) throw new Error(`409 sem linha ativa para ${codigo}`);
  return achado.id;
}

function corpoRegra(
  cenario: CenarioE01T03,
  beneficioId: string,
  classificacaoId: string,
  vigenciaInicio: string,
  vigenciaFim: string | null,
  pIcms: string,
) {
  return {
    enquadramentoId: cenario.enquadramentoId,
    operacaoId: cenario.operacaoId,
    cfopId: cenario.cfopId,
    icmsCst: '20',
    pRedBc: '41,67',
    pIcms,
    beneficioFiscalId: beneficioId,
    ipiCst: '53',
    pisCst: '06',
    ibsCst: '000',
    classificacaoIbsCbsId: classificacaoId,
    vigenciaInicio,
    vigenciaFim,
    justificativa: MOTIVO,
  };
}

async function criarRascunho(
  cenario: CenarioE01T03,
  beneficioId: string,
  classificacaoId: string,
  vigenciaInicio: string,
  vigenciaFim: string | null,
  pIcms: string,
): Promise<RegraMinima> {
  return api<RegraMinima>(cookieA, 'POST', '/fiscal/regras', corpoRegra(
    cenario, beneficioId, classificacaoId, vigenciaInicio, vigenciaFim, pIcms,
  ));
}

async function submeter(regra: RegraMinima): Promise<RegraMinima> {
  return api<RegraMinima>(cookieA, 'POST', `/fiscal/regras/${regra.id}/submeter`, {
    versao: regra.versao,
    justificativa: MOTIVO,
  });
}

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  // O overlay do Next em desenvolvimento e os avisos temporários não fazem parte da tela.
  await page.addStyleTag({ content: 'nextjs-portal, [data-sonner-toaster] { display: none !important; }' });
  await chave.scrollIntoViewIfNeeded();
  // A captura da página inteira parte do topo: cabeçalho e menu fixos não aparecem no meio da imagem.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => {
    sessionStorage.removeItem('fiscal.regras.lista');
    sessionStorage.removeItem('fiscal.regras.rotulo-cfop');
  });
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaRegras(page: Page): Promise<void> {
  await page.goto('/fiscal/regras');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function filtrarCfop(page: Page, codigo: string): Promise<void> {
  const mascarado = `${codigo[0]}.${codigo.slice(1)}`;
  await escolherCombo(page, page, 'filtro-cfop', 'Buscar CFOP', codigo, new RegExp(mascarado.replace('.', '\\.')));
}

function linhas(page: Page, rotulo: string): Locator {
  return page.getByRole('row', { name: new RegExp(rotulo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
}

async function abrirAba(page: Page, aba: string, chave: string): Promise<Locator> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  const alvo = page.getByText(chave).first();
  await expect(alvo).toBeVisible({ timeout: 15_000 });
  return alvo;
}

async function abrirPrototipo(page: Page): Promise<void> {
  await page.goto('about:blank');
  await page.goto(PROTO_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();
}

async function abaPrototipo(page: Page, aba: string, chave: string): Promise<Locator> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  const alvo = page.getByText(chave).first();
  await expect(alvo).toBeVisible({ timeout: 15_000 });
  return alvo;
}

/** Abre a decisão na aba Movimentações e confirma com uma justificativa; devolve o diálogo. */
async function decidirNaFicha(page: Page, botao: string, dialogo: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Movimentações', exact: true }).click();
  await expect(page.getByRole('button', { name: botao, exact: true })).toBeEnabled();
  await page.getByRole('button', { name: botao, exact: true }).click();
  const caixa = page.getByRole('dialog', { name: dialogo });
  await caixa.getByLabel(/Justificativa/).fill(MOTIVO);
  await caixa.getByRole('button', { name: botao, exact: true }).click();
  return caixa;
}

/** Seleciona a linha da operação cuja ficha atende a condição (a mesma operação pode ter várias versões). */
async function selecionarTexto(page: Page, rotulo: string, confere: () => Promise<void>): Promise<void> {
  await page.getByLabel('Pesquisar descrição ou referência de negócio').fill(rotulo);
  const grupo = linhas(page, rotulo);
  await expect(grupo.first()).toBeVisible({ timeout: 15_000 });
  const total = await grupo.count();
  for (let i = 0; i < total; i += 1) {
    await grupo.nth(i).click();
    try {
      await confere();
      return;
    } catch {
      // a ficha ainda é de outra versão da mesma operação
    }
  }
  throw new Error(`não achei a versão esperada na operação ${rotulo}`);
}

async function removerBeneficio(id: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('Identificador inválido para o benefício');
  }
  await executarSql(`UPDATE beneficios_fiscais SET deleted_at = now() WHERE id = '${id}' AND deleted_at IS NULL`);
}

test.describe('E01-T03 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let usuarios: UsuariosE01;
  let principal: CenarioE01T03;
  let segregada: CenarioE01T03;
  let beneficio: CenarioE01T03;
  let beneficioId = '';

  test.beforeAll(async () => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    requestApi = await playwrightRequest.newContext();
    usuarios = await prepararUsuarios(requestApi);
    cookieA = await loginApi(requestApi, usuarios.adminA);
    cookieB = await loginApi(requestApi, usuarios.adminB);
    principal = await criarCenario(requestApi, cookieA, cookieB, 'Captura');
    segregada = await criarCenario(requestApi, cookieA, cookieB, 'Segregacao');
    beneficio = await criarCenario(requestApi, cookieA, cookieB, 'Beneficio');
    const beneficioPrincipal = await garantirCodigo(
      '/fiscal/beneficios-fiscais', 'SP020450', 'Redução de base — São Paulo (SP020450)',
    );
    const classificacao = await garantirCodigo(
      '/fiscal/classificacoes-ibs-cbs', '000001', 'Tributação integral (000001)',
    );
    beneficioId = await garantirCodigo(
      '/fiscal/beneficios-fiscais', 'SP020100', 'Isenção de cesta básica (SP020100)',
    );
    const aprovada = await submeter(await criarRascunho(
      principal, beneficioPrincipal, classificacao, '2026-01-01', '2026-12-31', '12,00',
    ));
    const decidida = await api<RegraMinima>(cookieB, 'POST', `/fiscal/regras/${aprovada.id}/aprovar`, {
      versao: aprovada.versao,
      justificativa: MOTIVO,
    });
    await api(cookieA, 'POST', `/fiscal/regras/${decidida.id}/versoes`, {
      ...corpoRegra(principal, beneficioPrincipal, classificacao, '2027-01-01', null, '7,00'),
      versao: decidida.versao,
    });
    await submeter(await criarRascunho(
      segregada, beneficioPrincipal, classificacao, '2028-01-01', '2028-12-31', '12,00',
    ));
    await criarRascunho(beneficio, beneficioId, classificacao, '2029-01-01', '2029-12-31', '12,00');
  });

  test.afterAll(async () => {
    await requestApi?.dispose();
  });

  test('26 capturas nomeadas com elemento-chave visível', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    if (!baseURL) throw new Error('baseURL do Playwright ausente');

    const proto = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await abrirPrototipo(proto);
    await capturar(proto, 'prototipo-lista.png', proto.locator('tr[data-row]').first());
    await proto.locator('tr[data-row="1"]').click();
    await expect(proto.locator('tr[data-row="1"]')).toHaveClass(/selected/);
    await capturar(proto, 'prototipo-ficha.png', proto.getByText('Trilha e responsabilização'));
    for (const item of ABAS_PROTOTIPO) {
      if (item.arquivo === 'prototipo-ficha.png') continue;
      await abrirPrototipo(proto);
      await capturar(proto, item.arquivo, await abaPrototipo(proto, item.aba, item.chave));
    }
    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: '+ Novo registro' }).click();
    const drawerProto = proto.getByRole('dialog', { name: `Formulário de ${TITULO}` });
    await capturar(proto, 'prototipo-drawer.png', drawerProto.getByRole('button', { name: 'Salvar rascunho ilustrativo' }));
    await proto.close();

    const page = await abrirComo(browser, baseURL, usuarios.adminA);
    await irParaRegras(page);
    await filtrarCfop(page, '5102');
    // A lista acumula registros de outras execuções: a busca traz a operação desta captura para a primeira página.
    await page.getByLabel('Pesquisar descrição ou referência de negócio').fill(principal.rotuloOperacao);
    await capturar(page, 'app-lista.png', linhas(page, principal.rotuloOperacao).first());
    await selecionarTexto(page, principal.rotuloOperacao, () => expect(valorCampo(page, 'Alíquota (%)')).toHaveText('12,00', { timeout: 15_000 }));
    await capturar(page, 'app-ficha.png', page.getByText('Dados principais'));
    for (const item of ABAS_APP) {
      await capturar(page, item.arquivo, await abrirAba(page, item.aba, item.chave));
    }

    await page.getByRole('tab', { name: 'Movimentações', exact: true }).click();
    await page.getByRole('button', { name: 'Comparar', exact: true }).click();
    const comparar = page.getByRole('dialog', { name: 'Comparar' });
    const opcao = comparar.locator('option', { hasText: / · versão 2 · Rascunho$/ });
    await expect(opcao).toBeAttached();
    await comparar.getByLabel('Outra versão').selectOption(await opcao.getAttribute('value') ?? '');
    await comparar.getByRole('button', { name: 'Comparar', exact: true }).click();
    await capturar(page, 'app-comparar.png', comparar.getByText(COMPARACAO));
    await comparar.getByRole('button', { name: 'Fechar' }).click();
    await expect(comparar).toBeHidden();

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Salvar rascunho' }));
    await drawer.getByRole('button', { name: 'Novo código' }).first().click();
    const dialogo = page.getByRole('dialog', { name: 'Benefício fiscal' });
    await capturar(page, 'app-dialogo-beneficio.png', dialogo.getByText(AVISO));
    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialogo).toBeHidden();
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();

    await irParaRegras(page);
    await filtrarCfop(page, '5102');
    await selecionarTexto(page, segregada.rotuloOperacao, () => expect(valorCampo(page, 'Situação')).toHaveText('Submetida', { timeout: 15_000 }));
    const dialogoSegregacao = await decidirNaFicha(page, 'Aprovar', 'Aprovar regra');
    await capturar(page, 'app-segregacao.png', dialogoSegregacao.getByText(SEGREGACAO));
    await dialogoSegregacao.getByRole('button', { name: 'Cancelar' }).click();

    await submeter(await criarRascunho(
      principal,
      await garantirCodigo('/fiscal/beneficios-fiscais', 'SP020450', 'Redução de base — São Paulo (SP020450)'),
      await garantirCodigo('/fiscal/classificacoes-ibs-cbs', '000001', 'Tributação integral (000001)'),
      '2026-06-01', '2026-08-31', '12,00',
    ));
    const pageB = await abrirComo(browser, baseURL, usuarios.adminB);
    await irParaRegras(pageB);
    await filtrarCfop(pageB, '5102');
    await selecionarTexto(pageB, principal.rotuloOperacao, () => expect(valorCampo(pageB, 'Início de vigência')).toContainText('01/06/2026', { timeout: 15_000 }));
    const dialogoVigencia = await decidirNaFicha(pageB, 'Aprovar', 'Aprovar regra');
    await capturar(pageB, 'app-vigencia-ambigua.png', dialogoVigencia.getByText(VIGENCIA));

    await irParaRegras(page);
    await filtrarCfop(page, '5102');
    await selecionarTexto(page, beneficio.rotuloOperacao, () => expect(valorCampo(page, 'Situação')).toHaveText('Rascunho', { timeout: 15_000 }));
    await page.getByRole('tab', { name: 'Ficha e campos', exact: true }).click();
    await page.getByRole('button', { name: 'Editar versão' }).click();
    const edicao = page.getByRole('dialog', { name: 'Editar versão' });
    await edicao.getByLabel('Justificativa auditável').fill('Evidência de benefício inativo.');
    await removerBeneficio(beneficioId);
    await edicao.getByRole('button', { name: 'Salvar rascunho' }).click();
    await capturar(page, 'app-beneficio-nao-elegivel.png', edicao.getByText(BENEFICIO));
    await edicao.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar e sair' }).click();
    await expect(edicao).toBeHidden();

    await irParaRegras(page);
    await filtrarCfop(page, '6102');
    await capturar(page, 'app-vazio.png', page.getByText(TEXTO_VAZIO));

    await page.route('**/api/erp/fiscal/regras**', async (route) => {
      const caminho = new URL(route.request().url()).pathname;
      const lista = route.request().method() === 'GET'
        && (caminho.endsWith('/regras') || caminho.endsWith('/regras/contagens'));
      if (lista) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
        return;
      }
      await route.continue();
    });
    await irParaRegras(page);
    await capturar(page, 'app-erro-retry.png', page.getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/erp/fiscal/regras**');

    const gestor = await abrirComo(browser, baseURL, usuarios.gestor);
    await gestor.goto('/fiscal/regras');
    await capturar(gestor, 'app-403.png', gestor.getByText(SEM_PERMISSAO));

    const pngs = fs.readdirSync(OUT_DIR).filter((nome) => nome.endsWith('.png')).sort();
    expect(pngs).toEqual([...ESPERADOS].sort());
  });
});
