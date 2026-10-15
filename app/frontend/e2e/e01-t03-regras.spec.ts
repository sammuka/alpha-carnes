/**
 * E01-T03 — Editor de regras tributárias: jornada, autorização e acessibilidade.
 * Benefício SP020450 e classificação 000001 nascem no diálogo da jornada.
 */
import { test, expect, type Browser, type Locator, type Page, type Response } from '@playwright/test';
import {
  CODIGO_BENEFICIO,
  CODIGO_CLASSIFICACAO,
  DESC_BENEFICIO,
  DESC_CLASSIFICACAO,
  criarCenario,
  criarRegraApoio,
  entrarNoFrontend,
  liberarCodigosDaJornada,
  loginApi,
  prepararUsuarios,
  type CenarioE01T03,
  type UsuarioE2e,
} from './helpers/e01-t03-seed';

const TITULO = 'Editor de regras tributárias';
const EMPRESAS = 'Empresas, estabelecimentos e regime';
const ENQUADRAMENTOS = 'Operações fiscais e enquadramentos';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o editor de regras tributárias.';
const AVISO_TABELA = 'Cadastro manual. A tabela oficial completa não está carregada; confira o código na documentação fiscal.';
const SEGREGACAO = 'A aprovação deve ser feita por usuário diferente de quem submeteu.';
const DIVERGENTE = 'A operação e a operação fiscal (CFOP) precisam ser as do enquadramento selecionado.';
const JUSTIFICATIVA = 'Regra inicial da vigência de 2026.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const CODIGO_DE_TASK = /E\d{2}-T\d{2}/;

function escapar(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.regras.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaRegras(page: Page): Promise<void> {
  await page.goto('/fiscal/regras');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 30_000 });
}

async function abrirGrupoFiscal(page: Page): Promise<Locator> {
  const aside = page.getByRole('complementary', { name: 'Navegação principal' });
  const grupo = aside.getByRole('button', { name: /FISCAL/ });
  await expect(grupo).toBeVisible();
  if ((await grupo.getAttribute('aria-expanded')) !== 'true') await grupo.click();
  return aside;
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

async function exigirPost(page: Page, resposta: Response, rota: string): Promise<void> {
  if (resposta.ok()) return;
  const corpo = await resposta.text();
  const alerta = (await page.locator('p[role=alert]').allTextContents()).join(' | ');
  throw new Error(`POST ${rota} ${resposta.status()} url=${resposta.url()} corpo=${corpo} alerta=${alerta || '(nenhum)'}`);
}

async function cadastrarCodigo(page: Page, drawer: Locator, indice: number, codigo: string, descricao: string): Promise<void> {
  await drawer.getByRole('button', { name: 'Novo código' }).nth(indice).click();
  const titulo = indice === 0 ? 'Benefício fiscal' : 'Classificação IBS/CBS';
  const dialogo = page.getByRole('dialog', { name: titulo });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(AVISO_TABELA)).toBeVisible();
  await dialogo.getByLabel('Código do cadastro manual', { exact: true }).fill(codigo);
  await dialogo.getByLabel('Descrição do cadastro manual', { exact: true }).fill(descricao);
  await dialogo.getByLabel('Motivo do cadastro manual', { exact: true }).fill('Cadastro manual do teste E2E.');
  const rota = indice === 0 ? '/api/erp/fiscal/beneficios-fiscais' : '/api/erp/fiscal/classificacoes-ibs-cbs';
  const [resposta] = await Promise.all([
    page.waitForResponse(
      (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === rota,
      { timeout: 30_000 },
    ),
    dialogo.getByRole('button', { name: 'Salvar rascunho' }).click(),
  ]);
  await exigirPost(page, resposta, rota);
  await expect(dialogo).toBeHidden();
}

async function abrirAcoes(page: Page): Promise<void> {
  const aprovar = page.getByRole('button', { name: 'Aprovar', exact: true });
  if (!(await aprovar.isVisible())) await page.getByText('Ações do processo', { exact: true }).click();
  await expect(aprovar).toBeVisible();
}

async function escolherEnquadramento(drawer: Locator, cenario: CenarioE01T03): Promise<void> {
  await expect(drawer.getByLabel('Enquadramento fiscal').locator(`option[value="${cenario.enquadramentoId}"]`)).toBeAttached();
  await drawer.getByLabel('Enquadramento fiscal', { exact: true }).selectOption(cenario.enquadramentoId);
  await expect(drawer.getByLabel('Operação', { exact: true })).toHaveValue(cenario.operacaoId, { timeout: 15_000 });
  await expect(drawer.getByLabel('Operação fiscal (CFOP)', { exact: true })).toHaveValue(cenario.cfopId);
}

async function preencherTributos(drawer: Locator): Promise<void> {
  await expect(drawer.getByLabel('Benefício fiscal').locator('option', { hasText: DESC_BENEFICIO })).toBeAttached();
  await expect(drawer.getByLabel('Classificação IBS/CBS').locator('option', { hasText: DESC_CLASSIFICACAO })).toBeAttached();
  await drawer.getByLabel('Tratamento ICMS').selectOption({ label: 'Redução de base' });
  await drawer.getByLabel('Redução de base do ICMS (%)').fill('41,67');
  await drawer.getByLabel('Alíquota (%)').fill('12,00');
  await drawer.getByLabel('Benefício fiscal').selectOption({ label: DESC_BENEFICIO });
  await drawer.getByLabel('Tratamento IPI').selectOption({ label: 'Saída não tributada' });
  await drawer.getByLabel('Tratamento PIS/COFINS').selectOption({ label: 'Alíquota zero' });
  await drawer.getByLabel('Tratamento IBS/CBS').selectOption({ label: 'Tributação integral' });
  await drawer.getByLabel('Classificação IBS/CBS').selectOption({ label: DESC_CLASSIFICACAO });
  await drawer.getByLabel('Início de vigência').fill('2026-01-01');
  await drawer.getByLabel('Justificativa auditável').fill(JUSTIFICATIVA);
}

function linhasDo(page: Page, rotulo: string): Locator {
  return page.getByRole('row', { name: escapar(rotulo) });
}

async function filtrarCfop(page: Page): Promise<void> {
  const filtro = page.getByLabel('Operação fiscal (CFOP)');
  await expect(filtro.locator('option', { hasText: '5102' })).toBeAttached();
  await filtro.selectOption({ label: '5102' });
}

async function selecionarLinha(page: Page, rotulo: string): Promise<void> {
  await filtrarCfop(page);
  const linha = linhasDo(page, rotulo).first();
  await expect(linha).toBeVisible({ timeout: 15_000 });
  await linha.click();
}

async function expectSemIdentificadoresTecnicos(page: Page): Promise<void> {
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(UUID);
  expect(texto).not.toMatch(CODIGO_DE_TASK);
  expect(texto).not.toMatch(/Marca/);
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

test.describe('E01-T03 Editor de regras tributárias', () => {
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(300_000);

  test('jornada: rascunho, segregação, versão, comparação e CFOP divergente', async ({ browser, request, baseURL }) => {
    liberarCodigosDaJornada();
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario = await criarCenario(request, cookieA, cookieB, 'Jornada');
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);

    await page.goto('/gestao/dashboard');
    await esperarPainelEstavel(page);
    const aside = await abrirGrupoFiscal(page);
    await expect(aside.getByRole('link', { name: EMPRESAS })).toBeVisible();
    await expect(aside.getByRole('link', { name: ENQUADRAMENTOS })).toBeVisible();
    const linkRegras = aside.getByRole('link', { name: TITULO });
    await expect(linkRegras).toHaveAttribute('href', '/fiscal/regras');
    await Promise.all([
      page.waitForURL(/\/fiscal\/regras$/, { timeout: 60_000 }),
      linkRegras.click(),
    ]);
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await expect(drawer.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible();
    await cadastrarCodigo(page, drawer, 0, CODIGO_BENEFICIO, DESC_BENEFICIO);
    await cadastrarCodigo(page, drawer, 1, CODIGO_CLASSIFICACAO, DESC_CLASSIFICACAO);
    await escolherEnquadramento(drawer, cenario);
    await preencherTributos(drawer);
    const [criada] = await Promise.all([
      page.waitForResponse(
        (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/erp/fiscal/regras',
        { timeout: 30_000 },
      ),
      drawer.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    await exigirPost(page, criada, '/api/erp/fiscal/regras');
    await expect(drawer).toBeHidden();

    await selecionarLinha(page, cenario.rotuloOperacao);
    await expect(page.getByText(/^Código [1-9]\d*$/)).toBeVisible();
    await expect(page.getByText('Situação Rascunho').first()).toBeVisible();
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) {
      await expect(page.getByText(selo).first()).toBeVisible();
    }

    await abrirAcoes(page);
    await expect(page.getByRole('button', { name: 'Submeter', exact: true })).toBeEnabled();
    await page.getByLabel('Motivo da ação').fill('Ação conferida no teste E2E.');
    await page.getByRole('button', { name: 'Submeter', exact: true }).click();
    await expect(page.getByText('Situação Submetida').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toBeEnabled();
    await page.getByLabel('Motivo da ação').fill('Ação conferida no teste E2E.');
    await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await expect(page.getByText(SEGREGACAO)).toBeVisible();
    await expect(page.getByText('Situação Submetida').first()).toBeVisible();

    const pageB = await abrirComo(browser, baseURL!, usuarios.adminB);
    await irParaRegras(pageB);
    await selecionarLinha(pageB, cenario.rotuloOperacao);
    await expect(pageB.getByText('Situação Submetida').first()).toBeVisible();
    await abrirAcoes(pageB);
    await expect(pageB.getByRole('button', { name: 'Aprovar', exact: true })).toBeEnabled();
    await pageB.getByLabel('Motivo da ação').fill('Ação conferida no teste E2E.');
    await pageB.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await expect(pageB.getByText('Situação Aprovada').first()).toBeVisible();
    await expect(pageB.getByRole('button', { name: 'Editar versão' })).toHaveCount(0);

    await expect(pageB.getByRole('button', { name: 'Adicionar versão', exact: true })).toBeEnabled();
    await pageB.getByRole('button', { name: 'Adicionar versão', exact: true }).click();
    const versao = pageB.getByRole('dialog', { name: 'Adicionar versão' });
    await versao.getByLabel('Alíquota da versão').fill('7,00');
    await versao.getByLabel('Início da versão').fill('2027-01-01');
    await versao.getByLabel('Motivo da versão').fill('Versão com alíquota reduzida em 2027.');
    const [novaVersao] = await Promise.all([
      pageB.waitForResponse(
        (item) => item.request().method() === 'POST' && /\/api\/erp\/fiscal\/regras\/[^/]+\/versoes$/.test(new URL(item.url()).pathname),
        { timeout: 30_000 },
      ),
      versao.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    await exigirPost(pageB, novaVersao, '/api/erp/fiscal/regras/versoes');
    await expect(versao).toBeHidden();
    await expect(linhasDo(pageB, cenario.rotuloOperacao)).toHaveCount(2);

    await pageB.getByText('Alíquota (%) 12,00').first().waitFor();
    await abrirAcoes(pageB);
    await pageB.getByRole('button', { name: 'Comparar', exact: true }).click();
    const comparar = pageB.getByRole('dialog', { name: 'Comparar' });
    const opcao = comparar.locator('option', { hasText: new RegExp(`^${cenario.codigoEnquadramento} · Redução de base$`) });
    await expect(opcao).toBeAttached();
    await comparar.getByLabel('Outra versão').selectOption(await opcao.getAttribute('value') ?? '');
    await comparar.getByRole('button', { name: 'Comparar', exact: true }).click();
    await expect(comparar.getByText('Alíquota (%): 12,00 → 7,00')).toBeVisible();
    await comparar.getByRole('button', { name: 'Cancelar' }).click();
    await expect(comparar).toBeHidden();

    await expect(linhasDo(pageB, cenario.rotuloOperacao)).toHaveCount(2);
    await pageB.getByRole('button', { name: '+ Novo registro' }).click();
    const divergente = pageB.getByRole('dialog', { name: 'Novo registro' });
    await escolherEnquadramento(divergente, cenario);
    await divergente.getByLabel('Operação fiscal (CFOP)', { exact: true }).selectOption(cenario.cfopDivergenteId);
    await expect(divergente.getByLabel('Operação fiscal (CFOP)', { exact: true })).toHaveValue(cenario.cfopDivergenteId);
    await preencherTributos(divergente);
    const [recusa] = await Promise.all([
      pageB.waitForResponse(
        (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/erp/fiscal/regras',
        { timeout: 30_000 },
      ),
      divergente.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    const statusRecusa = recusa.status();
    const corpoRecusa = await recusa.text();
    await expect(
      pageB.getByText(DIVERGENTE),
      `POST ${recusa.url()} ${statusRecusa} ${corpoRecusa}`,
    ).toBeVisible();
    pageB.once('dialog', (dialog) => dialog.accept());
    await divergente.getByRole('button', { name: 'Cancelar' }).click();
    await expect(divergente).toBeHidden();
    await expect(linhasDo(pageB, cenario.rotuloOperacao)).toHaveCount(2);
    await expectSemIdentificadoresTecnicos(pageB);
  });

  test('autorização: gestor não vê o item e o administrador mantém o grupo Fiscal', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const gestor = await abrirComo(browser, baseURL!, usuarios.gestor);
    await gestor.goto('/fiscal/regras');
    await expect(gestor.getByText(SEM_PERMISSAO)).toBeVisible({ timeout: 30_000 });
    const asideGestor = gestor.getByRole('complementary', { name: 'Navegação principal' });
    await expect(asideGestor.locator('button[aria-expanded]').first()).toBeVisible();
    await expect(asideGestor.getByRole('link', { name: TITULO })).toHaveCount(0);
    await expect(gestor.getByRole('heading', { name: TITULO, level: 1 })).toHaveCount(0);
    await expectSemIdentificadoresTecnicos(gestor);

    const admin = await abrirComo(browser, baseURL!, usuarios.adminA);
    await admin.goto('/gestao/dashboard');
    await esperarPainelEstavel(admin);
    const asideAdmin = await abrirGrupoFiscal(admin);
    await expect(asideAdmin.getByRole('link', { name: EMPRESAS })).toBeVisible();
    await expect(asideAdmin.getByRole('link', { name: ENQUADRAMENTOS })).toBeVisible();
    await expect(asideAdmin.getByRole('link', { name: TITULO })).toBeVisible();
  });

  test('acessibilidade: nomes, grade por teclado, Escape e retorno de foco', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario: CenarioE01T03 = await criarCenario(request, cookieA, cookieB, 'Acessibilidade');
    await criarRegraApoio(request, cookieA, cenario);
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);
    const principal = page.getByRole('main');

    await irParaRegras(page);
    await filtrarCfop(page);
    await expect(linhasDo(page, cenario.rotuloOperacao)).toBeVisible();
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
    await verificarSobreposicao(
      drawer.getByRole('button', { name: 'Novo código' }).first(),
      page.getByRole('dialog', { name: 'Benefício fiscal' }),
    );
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(novo).toBeFocused();

    const linhaCenario = linhasDo(page, cenario.rotuloOperacao);
    await page.getByLabel('Pesquisar descrição ou referência de negócio').focus();
    let naLinha = false;
    for (let i = 0; i < 40 && !naLinha; i += 1) {
      await page.keyboard.press('Tab');
      naLinha = await linhaCenario.evaluate((el) => el === document.activeElement);
    }
    expect(naLinha, 'o foco deve alcançar a linha da grade só com Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByText(/^Código [1-9]\d*$/)).toBeVisible();
    await expectControlesComNome(principal);
    await expectSemIdentificadoresTecnicos(page);
  });
});
