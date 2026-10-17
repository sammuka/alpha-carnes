/**
 * E01-T02 — Operações fiscais e enquadramentos: jornada, autorização e acessibilidade.
 * O seed de apoio vai pela API; CFOP 5102 e NCM 02013000 nascem no diálogo da tela.
 */
import { test, expect, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';
import {
  criarBase,
  criarEnquadramento,
  criarEnquadramentosEmLote,
  entrarNoFrontend,
  liberarCodigosDaJornada,
  loginApi,
  prepararUsuarios,
  type CenarioE01T02,
  type UsuarioE2e,
} from './helpers/e01-t02-seed';

const TITULO = 'Operações fiscais e enquadramentos';
const EMPRESAS = 'Empresas, estabelecimentos e regime';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar operações fiscais e enquadramentos.';
const AVISO_TABELA = 'A tabela oficial completa não está carregada';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const CODIGO_DE_TASK = /E\d{2}-T\d{2}/;
const BUSCA = 'Buscar';

function dataLocal(deslocamentoDias: number): { iso: string; br: string } {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { iso: `${d.getFullYear()}-${mm}-${dd}`, br: `${dd}/${mm}/${d.getFullYear()}` };
}

function brDeIso(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Valor do campo rotulado da ficha (grade de rótulo + valor). */
function valorDoCampo(page: Page, rotulo: string): Locator {
  return page.locator(`p:text-is("${rotulo}") + div`);
}

// O `browser` vive o worker inteiro: contexto não fechado segue aberto nos specs seguintes da mesma execução,
// com tempo real e recargas do next dev disputando o servidor (Portão 2 r5, bateria combinada).
const contextosAbertos: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(contextosAbertos.splice(0).map((contexto) => contexto.close()));
});

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  contextosAbertos.push(context);
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.enquadramentos.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaEnquadramentos(page: Page): Promise<void> {
  await page.goto('/fiscal/enquadramentos');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 30_000 });
}

/** A grade pode restaurar a busca da sessão depois de hidratar; repete até o valor ficar estável. */
async function filtrarPor(page: Page, texto: string): Promise<void> {
  const busca = page.getByRole('textbox', { name: BUSCA });
  await expect(async () => {
    await busca.fill(texto);
    await expect(busca).toHaveValue(texto, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

async function abrirGrupoFiscal(page: Page): Promise<Locator> {
  const aside = page.getByRole('complementary', { name: 'Navegação principal' });
  const grupo = aside.getByRole('button', { name: /FISCAL/ });
  await expect(grupo).toBeVisible();
  if ((await grupo.getAttribute('aria-expanded')) !== 'true') await grupo.click();
  return aside;
}

async function escolherCombo(page: Page, drawer: Locator, id: string, placeholder: string, termo: string, opcao: RegExp): Promise<void> {
  const gatilho = drawer.locator(id);
  await expect(async () => {
    if ((await gatilho.getAttribute('aria-expanded')) !== 'true') await gatilho.click();
    await page.getByPlaceholder(placeholder).fill(termo);
    await expect(page.getByRole('option', { name: opcao })).toBeVisible({ timeout: 1_500 });
  }).toPass({ timeout: 20_000 });
  await page.getByRole('option', { name: opcao }).click();
  await expect(gatilho).toContainText(termo);
}

async function escolherDia(page: Page, botao: Locator, dia: number): Promise<void> {
  await botao.click();
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover).toBeVisible();
  const diaCell = popover
    .getByRole('gridcell', { name: String(dia), exact: true })
    .and(popover.locator(':not(.text-fg-faint)'));
  await diaCell.click();
  await expect(popover).toBeHidden();
}

async function cadastrarCodigo(page: Page, drawer: Locator, indice: number, codigo: string, descricao: string): Promise<void> {
  await drawer.getByRole('button', { name: 'Novo código' }).nth(indice).click();
  const dialogo = page.getByRole('dialog').filter({ hasText: AVISO_TABELA });
  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(AVISO_TABELA);
  await dialogo.getByLabel('Código', { exact: true }).fill(codigo);
  await dialogo.getByLabel('Descrição').fill(descricao);
  await dialogo.getByLabel('Motivo do código').fill('Cadastro manual do teste E2E.');
  const rota = indice === 0 ? '/api/erp/fiscal/cfops' : '/api/erp/fiscal/ncms';
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === rota,
      { timeout: 30_000 },
    ),
    dialogo.getByRole('button', { name: 'Salvar rascunho' }).click(),
  ]);
  if (!resposta.ok()) {
    const corpo = await resposta.text();
    const alerta = (await page.locator('[role=alert]').allTextContents()).join(' | ');
    throw new Error(`POST ${rota} ${resposta.status()} corpo=${corpo} alerta=${alerta || '(nenhum)'}`);
  }
  await expect(dialogo).toBeHidden();
}

async function expectSemIdentificadoresTecnicos(page: Page): Promise<void> {
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(UUID);
  expect(texto).not.toMatch(CODIGO_DE_TASK);
  expect(texto).not.toMatch(/Marca/);
  expect(texto).not.toMatch(/al[ií]quota/i);
}

/** `: texto`, aspas ou colchetes contam como nome. Só falha o controle sem nenhum desses. */
function controleSemNomeAcessivel(linha: string): boolean {
  if (!/^\s*- (?:textbox|combobox|button|searchbox)\b/.test(linha)) return false;
  if (/:\s*\S/.test(linha)) return false;
  if (/["']/.test(linha)) return false;
  if (/\[/.test(linha)) return false;
  return true;
}

async function expectControlesComNome(escopo: Locator): Promise<void> {
  const snapshot = await escopo.ariaSnapshot();
  const semNome = snapshot.split('\n').filter(controleSemNomeAcessivel);
  expect(semNome, `controles sem nome acessível:\n${semNome.join('\n')}`).toEqual([]);
}

/**
 * O seletor do painel faz replace em `?operacaoId` e cancela o clique do menu
 * se os dois acontecem juntos. Segue até a query aparecer, ou 5s sem navegação.
 */
async function esperarPainelEstavel(page: Page): Promise<void> {
  const comOperacao = () => /[?&]operacaoId=/.test(page.url());
  await expect(page.getByText('Carregando operações…')).toBeHidden({ timeout: 30_000 });
  const limite = Date.now() + 60_000;
  while (!comOperacao() && Date.now() < limite) {
    const navegou = await page
      .waitForEvent('framenavigated', { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!navegou) return;
  }
}

test.describe('E01-T02 Operações fiscais e enquadramentos', () => {
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(300_000);

  // next dev frio compila cada rota na primeira visita (dezenas de segundos); aquece as rotas da
  // jornada antes dos testes para que as asserções de tempo normal valham sem folga extra.
  test.beforeAll(async ({ browser, playwright }, testInfo) => {
    test.setTimeout(240_000);
    const baseURL = String(testInfo.project.use.baseURL);
    const request = await playwright.request.newContext();
    const usuarios = await prepararUsuarios(request);
    await request.dispose();
    const context = await browser.newContext({ baseURL });
    try {
      await entrarNoFrontend(context, baseURL, usuarios.adminA);
      const page = await context.newPage();
      for (const rota of ['/gestao/dashboard', '/fiscal/enquadramentos']) {
        await page.goto(rota, { timeout: 120_000 });
        await page.waitForLoadState('networkidle', { timeout: 120_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('jornada: cadastro, duplicação, sobreposição e consulta sem alíquota', async ({ browser, request, baseURL }) => {
    await liberarCodigosDaJornada();
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const base = await criarBase(request, cookieA, cookieB, 'Jornada');
    const hoje = dataLocal(0);
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);

    await page.goto('/gestao/dashboard');
    await esperarPainelEstavel(page);
    const aside = await abrirGrupoFiscal(page);
    await expect(aside.getByRole('link', { name: EMPRESAS })).toBeVisible();
    const linkEnquadramentos = aside.getByRole('link', { name: TITULO });
    await expect(linkEnquadramentos).toHaveAttribute('href', '/fiscal/enquadramentos');
    await Promise.all([
      page.waitForURL(/\/fiscal\/enquadramentos$/, { timeout: 60_000 }),
      linkEnquadramentos.click(),
    ]);
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();
    await expect(page.getByText('H-E01-12')).toBeVisible();

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await expect(drawer.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible();
    await cadastrarCodigo(page, drawer, 0, '5102', 'Venda de mercadoria');
    await expect(drawer.locator('#enq-cfop')).toContainText('5.102');
    await cadastrarCodigo(page, drawer, 1, '02013000', 'Carnes bovinas');
    await expect(drawer.locator('#enq-ncm')).toContainText('0201.30.00');

    await escolherCombo(page, drawer, '#enq-estab', 'Buscar estabelecimento', base.estabelecimento.nome, new RegExp(base.estabelecimento.nome));
    await escolherCombo(
      page,
      drawer,
      '#enq-op',
      'Buscar operação',
      base.rotuloOperacao,
      new RegExp(`${base.rotuloOperacao} · ${brDeIso(base.dataOperacao)}`),
    );
    await drawer.getByLabel('Tipo da nota').selectOption({ label: 'Saída' });
    await drawer.getByLabel('Finalidade').selectOption({ label: 'Operação normal' });
    await drawer.getByLabel('Abrangência da operação').selectOption({ label: 'Dentro do estado' });
    await drawer.getByLabel('Origem do produto').selectOption({ label: 'Revenda' });
    await expect(drawer.getByLabel('Finalidade')).toHaveValue('1');
    await expect(drawer.getByLabel('Abrangência da operação')).toHaveValue('INTERNA');
    await expect(drawer.getByLabel('Origem do produto')).toHaveValue('REVENDA');
    // A busca do combo consulta o servidor (parâmetro search), não uma página fixa de 100 itens.
    const buscaNoServidor = page.waitForRequest((r) => r.url().includes('/api/cadastros/produtos') && new URL(r.url()).searchParams.get('search') === base.produtoNome);
    await escolherCombo(page, drawer, '#enq-prod', 'Buscar produto', base.produtoNome, new RegExp(base.produtoNome));
    await buscaNoServidor;
    await escolherCombo(page, drawer, '#enq-cli', 'Buscar cliente', base.clienteNome, new RegExp(base.clienteNome));
    await drawer.getByLabel('Substituição tributária (CEST)').fill('1708700');
    await drawer.getByRole('button', { name: 'Início de vigência' }).click();
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await escolherDia(page, drawer.getByRole('button', { name: 'Fim de vigência' }), 20);
    await drawer.getByLabel('Prioridade').fill('1');
    await drawer.locator('#enq-motivo').fill('Cadastro inicial do enquadramento, E2E.');
    for (const selo of ['H-E01-06', 'H-E01-08', 'H-E01-09', 'H-E01-10']) {
      await expect(drawer.getByText(selo).first()).toBeVisible();
    }
    await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(drawer).toBeHidden();

    await filtrarPor(page, base.rotuloOperacao);
    const linhas = page.getByRole('row', { name: new RegExp(base.rotuloOperacao) });
    await expect(linhas).toHaveCount(1);
    await linhas.click();
    await expect(valorDoCampo(page, 'Código')).toHaveText(/^[1-9]\d*$/);
    await expect(page.getByText('Operação normal').first()).toBeVisible();
    await expect(page.getByText('Dentro do estado').first()).toBeVisible();
    await expect(page.getByText('Revenda').first()).toBeVisible();
    for (const selo of ['H-E01-06', 'H-E01-08', 'H-E01-09', 'H-E01-10', 'H-E01-11', 'H-E01-12']) {
      await expect(page.getByText(selo).first()).toBeVisible();
    }

    await page.getByRole('tab', { name: 'Movimentações' }).click();
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    const duplicar = page.getByRole('dialog', { name: 'Duplicar perfil' });
    await escolherDia(page, duplicar.getByRole('button', { name: 'Início de vigência da cópia' }), 28);
    await duplicar.getByLabel('Motivo da duplicação').fill('Cópia com início posterior, E2E.');
    await duplicar.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await expect(duplicar).toBeHidden();
    await expect(linhas).toHaveCount(2);

    await page.getByRole('row', { name: new RegExp(hoje.br) }).click();
    await page.getByRole('tab', { name: 'Movimentações' }).click();
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await expect(duplicar).toBeVisible();
    await duplicar.getByRole('button', { name: 'Início de vigência da cópia' }).click();
    await page.getByRole('button', { name: 'Hoje', exact: true }).click();
    await duplicar.getByLabel('Motivo da duplicação').fill('Cópia com a mesma vigência, E2E.');
    await duplicar.getByRole('button', { name: 'Duplicar', exact: true }).click();
    await expect(duplicar.getByRole('alert')).toContainText(/sobrepost/i);
    await duplicar.getByRole('button', { name: 'Cancelar' }).click();
    await expect(duplicar).toBeHidden();
    await expect(linhas).toHaveCount(2);

    await page.getByRole('button', { name: 'Inativar', exact: true }).click();
    const decisao = page.getByRole('dialog', { name: 'Inativar enquadramento' });
    await decisao.getByLabel(/Justificativa/).fill('Inativação da primeira vigência no teste E2E.');
    await decisao.getByRole('button', { name: 'Inativar', exact: true }).click();
    await expect(decisao).toBeHidden();
    await page.getByRole('row', { name: new RegExp(hoje.br) }).click();
    await page.getByRole('tab', { name: 'Ficha e campos' }).click();
    await expect(valorDoCampo(page, 'Situação').filter({ hasText: 'Inativa' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Validar pré-condições' }).click();
    await expect(page.getByText(/provisória/).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Exceções' }).click();
    await page.getByRole('button', { name: 'Validar', exact: true }).click();
    await expect(page.getByText('Nenhum enquadramento vigente cobre o critério e não há regra tributária aprovada.')).toBeVisible();
    await expectSemIdentificadoresTecnicos(page);
  });

  test('autorização: gestor não vê o item e o administrador mantém empresas', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const gestor = await abrirComo(browser, baseURL!, usuarios.gestor);
    await gestor.goto('/fiscal/enquadramentos');
    await expect(gestor.getByText(SEM_PERMISSAO)).toBeVisible({ timeout: 30_000 });
    const asideGestor = gestor.getByRole('complementary', { name: 'Navegação principal' });
    await expect(asideGestor.locator('button[aria-expanded]').first()).toBeVisible();
    await expect(asideGestor.getByRole('link', { name: TITULO })).toHaveCount(0);
    await expect(gestor.getByRole('heading', { name: TITULO, level: 1 })).toHaveCount(0);
    await expectSemIdentificadoresTecnicos(gestor);

    const admin = await abrirComo(browser, baseURL!, usuarios.adminA);
    await admin.goto('/gestao/dashboard');
    const asideAdmin = await abrirGrupoFiscal(admin);
    await expect(asideAdmin.getByRole('link', { name: EMPRESAS })).toBeVisible();
    await expect(asideAdmin.getByRole('link', { name: TITULO })).toBeVisible();
  });

  test('acessibilidade: nomes, grade por teclado, Escape e retorno de foco', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario: CenarioE01T02 = await criarEnquadramento(request, cookieA, cookieB, 'Acessibilidade');
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);
    const principal = page.getByRole('main');

    await irParaEnquadramentos(page);
    await filtrarPor(page, cenario.rotuloOperacao);
    await expect(page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) })).toBeVisible();
    await expectControlesComNome(principal);

    const verificarSobreposicao = async (abridor: Locator, sobreposicao: Locator): Promise<void> => {
      await abridor.click();
      await expect(sobreposicao).toBeVisible();
      await expectControlesComNome(sobreposicao);
      await expectSemIdentificadoresTecnicos(page);
      await page.keyboard.press('Escape');
      await expect(sobreposicao).toBeHidden();
      await expect(abridor).toBeFocused();
    };

    const novo = page.getByRole('button', { name: '+ Novo registro' });
    await novo.click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await expect(drawer).toBeVisible();
    await expectControlesComNome(drawer);
    await expect(drawer.getByText('Provisório').first()).toBeVisible();
    await verificarSobreposicao(
      drawer.getByRole('button', { name: 'Novo código' }).first(),
      page.getByRole('dialog', { name: 'Operação fiscal (CFOP)' }),
    );
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(novo).toBeFocused();

    const linhaCenario = page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) });
    await page.getByRole('textbox', { name: BUSCA }).focus();
    let naLinha = false;
    for (let i = 0; i < 30 && !naLinha; i += 1) {
      await page.keyboard.press('Tab');
      naLinha = await linhaCenario.evaluate((el) => el === document.activeElement);
    }
    expect(naLinha, 'o foco deve alcançar a linha da grade só com Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(valorDoCampo(page, 'Código')).toHaveText(/^[1-9]\d*$/);
    await expect(page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) })).toHaveAttribute('data-state', 'selected');
    await expectControlesComNome(principal);
    await expectSemIdentificadoresTecnicos(page);

    await page.getByRole('tab', { name: 'Movimentações' }).click();
    await verificarSobreposicao(
      page.getByRole('button', { name: 'Duplicar', exact: true }),
      page.getByRole('dialog', { name: 'Duplicar perfil' }),
    );
    await expectSemIdentificadoresTecnicos(page);
  });

  test('lista com mais de 20 linhas: paginação e ordenação no servidor', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario: CenarioE01T02 = await criarEnquadramento(request, cookieA, cookieB, 'Paginacao');
    const inicios = await criarEnquadramentosEmLote(request, cookieA, cenario, 20);
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);

    await irParaEnquadramentos(page);
    await filtrarPor(page, cenario.rotuloOperacao);
    const paginacao = page.getByRole('navigation', { name: 'Paginação' });
    await expect(paginacao).toContainText('21 registros · Página 1 de 2');
    await expect(page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) })).toHaveCount(20);
    await expect(paginacao.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await paginacao.getByRole('button', { name: 'Próxima' }).click();
    await expect(paginacao).toContainText('Página 2 de 2');
    await expect(page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) })).toHaveCount(1);
    await expect(paginacao.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await page.getByRole('button', { name: 'Início de vigência', exact: true }).click();
    await expect(paginacao).toContainText('Página 1 de 2');
    const cabecalho = page.getByRole('columnheader', { name: 'Início de vigência' });
    await expect(cabecalho).toHaveAttribute('aria-sort', 'ascending');
    const primeira = page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) }).first();
    await expect(primeira).toContainText('14/10/2026');
    await page.getByRole('button', { name: 'Início de vigência', exact: true }).click();
    await expect(cabecalho).toHaveAttribute('aria-sort', 'descending');
    await expect(primeira).toContainText(brDeIso(inicios[inicios.length - 1]!));
  });

  test('ficha: histórico, aceite, integrações e estabelecimento somente leitura na edição', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario: CenarioE01T02 = await criarEnquadramento(request, cookieA, cookieB, 'Ficha');
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);

    await irParaEnquadramentos(page);
    await filtrarPor(page, cenario.rotuloOperacao);
    await page.getByRole('row', { name: new RegExp(cenario.rotuloOperacao) }).click();
    await expect(valorDoCampo(page, 'Código')).toHaveText(/^[1-9][0-9]*$/);
    await expect(valorDoCampo(page, 'Operação fiscal (CFOP)')).toContainText(/^[0-9]\.[0-9]{3}/);
    await expect(valorDoCampo(page, 'Classificação fiscal (NCM)')).toContainText(/^[0-9]{4}\.[0-9]{2}\.[0-9]{2}/);
    await expect(valorDoCampo(page, 'Substituição tributária (CEST)')).toContainText('17.087.00');

    await page.getByRole('button', { name: 'Consultar histórico' }).click();
    const abaHistorico = page.getByRole('tab', { name: 'Histórico' });
    await expect(abaHistorico).toHaveAttribute('aria-selected', 'true');
    await expect(abaHistorico).toBeFocused();
    await expect(page.getByRole('tabpanel')).toContainText(/[0-9]{2}\/[0-9]{2}\/[0-9]{4} [0-9]{2}:[0-9]{2}/);

    await page.getByRole('tab', { name: 'Aceite e testes' }).click();
    await expect(page.getByRole('list', { name: 'Critérios de aceite' }).getByRole('listitem')).toHaveCount(8);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Integrações' }).click();
    await expect(page.getByRole('button', { name: 'Abrir simulador' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Central de Integrações' })).toBeDisabled();

    await page.getByRole('tab', { name: 'Ficha e campos' }).click();
    await page.getByRole('button', { name: 'Editar versão' }).click();
    const drawer = page.getByRole('dialog', { name: 'Editar versão' });
    await expect(drawer.locator('#enq-estab')).toBeDisabled();
    await drawer.getByLabel('Prioridade').fill('7');
    await drawer.locator('#enq-motivo').fill('Ajuste de prioridade no teste E2E.');
    await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(drawer).toBeHidden();
    await expect(valorDoCampo(page, 'Prioridade')).toContainText('7');
    await page.getByRole('button', { name: 'Editar versão' }).click();
    await drawer.getByLabel('Prioridade').fill('8');
    await drawer.locator('#enq-motivo').fill('Segundo ajuste imediato no teste E2E.');
    await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(drawer).toBeHidden();
    await expect(valorDoCampo(page, 'Prioridade')).toContainText('8');
    await expectSemIdentificadoresTecnicos(page);
  });
});
