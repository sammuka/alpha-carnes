/**
 * E01-T05 — Painel de homologação: jornada, acesso e rótulos.
 * O segundo administrador homologa a regra que o primeiro submeteu.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { BACKEND_URL } from './helpers/onda6-seed';
import {
  criarCenarioHomologacao,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T05,
  type UsuarioE2e,
} from './helpers/e01-t05-seed';

const PAINEL = 'Painel de alterações e homologação de regras';
const DESCRICAO = 'Revisão da versão aprovada para publicação.';
const JUSTIFICATIVA_ABERTURA = 'Abertura da revisão desta versão.';
const JUSTIFICATIVA_DECISAO = 'Decisão de usuário diferente de quem submeteu.';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o painel de alterações e homologação de regras.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const CODIGO_DE_TASK = /E\d{2}-T\d{2}/;
const ITENS_ANTERIORES = [
  'Empresas, estabelecimentos e regime',
  'Operações fiscais e enquadramentos',
  'Editor de regras tributárias',
  'Simulador fiscal e memória de cálculo',
];

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.homologacoes.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function abrirGrupoFiscal(page: Page): Promise<Locator> {
  const aside = page.getByRole('complementary', { name: 'Navegação principal' });
  const grupo = aside.getByRole('button', { name: /FISCAL/ });
  await expect(grupo).toBeVisible();
  if ((await grupo.getAttribute('aria-expanded')) !== 'true') await grupo.click();
  return aside;
}

async function esperarPainelEstavel(page: Page): Promise<void> {
  await expect(page.getByText('Carregando operações…')).toBeHidden({ timeout: 30_000 });
}

async function escolherEnquadramento(page: Page, drawer: Locator, codigo: string): Promise<void> {
  const combo = drawer.getByRole('combobox', { name: 'Enquadramento fiscal' });
  await combo.click();
  await page.getByPlaceholder('Pesquisar enquadramento').fill(codigo);
  const opcao = page.getByRole('option', { name: new RegExp(codigo) });
  await expect(opcao.first()).toBeVisible({ timeout: 90_000 });
  await opcao.first().click();
}

async function abrirRevisao(page: Page, cenario: CenarioE01T05, descricao: string): Promise<void> {
  await page.getByRole('button', { name: '+ Novo registro' }).click();
  const drawer = page.getByRole('dialog', { name: 'Novo registro' });
  await expect(drawer.getByRole('button', { name: 'Cadastrar / revisar' })).toHaveCount(0);
  await escolherEnquadramento(page, drawer, cenario.codigoEnquadramento);
  await drawer.getByLabel('Descrição').fill(descricao);
  await drawer.getByLabel('Justificativa auditável').fill(JUSTIFICATIVA_ABERTURA);
  await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

async function abrirAcoes(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Ações do processo ▾' });
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
}

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

async function expectSemIdentificadoresTecnicos(page: Page): Promise<void> {
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(UUID);
  expect(texto).not.toMatch(CODIGO_DE_TASK);
  expect(texto).not.toMatch(/Marca/);
}

test.describe('E01-T05 Painel de alterações e homologação de regras', () => {
  test.use({ actionTimeout: 20_000 });
  test.setTimeout(540_000);

  test('jornada, segregação e acesso', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const eu = await request.get(`${BACKEND_URL}/auth/me`, { headers: { Cookie: cookieB } });
    expect(eu.ok()).toBeTruthy();
    const nomeB = ((await eu.json()) as { nome: string }).nome;
    const principal = await criarCenarioHomologacao(request, cookieA, cookieB, 'Jornada');
    const doAutor = await criarCenarioHomologacao(request, cookieA, cookieB, 'Autor');

    const page = await abrirComo(browser, baseURL!, usuarios.adminB);
    await page.goto('/gestao/dashboard');
    await esperarPainelEstavel(page);
    const aside = await abrirGrupoFiscal(page);
    for (const item of ITENS_ANTERIORES) {
      await expect(aside.getByRole('link', { name: item })).toBeVisible();
    }
    const link = aside.getByRole('link', { name: PAINEL });
    await expect(link).toHaveAttribute('href', '/fiscal/homologacao');
    await Promise.all([
      page.waitForURL(/\/fiscal\/homologacao$/, { timeout: 60_000 }),
      link.click(),
    ]);
    await expect(page.getByRole('heading', { name: PAINEL, level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cadastrar / revisar' })).toHaveCount(0);

    await abrirRevisao(page, principal, DESCRICAO);
    const ficha = page.getByRole('tabpanel');
    await expect(ficha.getByText('Situação Em revisão').first()).toBeVisible();
    await expect(ficha.getByText('Início de vigência 2026-01-01').first()).toBeVisible();
    await expect(ficha.getByText('Fim de vigência 2026-12-31').first()).toBeVisible();
    await expect(ficha.getByText(/Usuário /).first()).toBeVisible();
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) {
      await expect(page.getByText(selo).first()).toBeVisible();
    }

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Revisar diff' }).click();
    const diff = page.getByRole('dialog', { name: 'Revisar diff' });
    await expect(diff.getByText(/Alíquota \(%\)/).first()).toBeVisible();
    await expect(diff.getByText('12,00').first()).toBeVisible();
    await diff.getByRole('button', { name: 'Cancelar' }).focus();
    await page.keyboard.press('Escape');
    await expect(diff).toBeHidden();

    await ficha.getByRole('button', { name: 'cenários aprovados' }).click();
    const cenario = page.getByRole('dialog', { name: 'cenários aprovados' });
    const memoria = cenario.getByRole('combobox', { name: 'Memória calculada' });
    const opcaoMemoria = memoria.locator('option', { hasText: principal.simulacaoCodigo });
    await expect(opcaoMemoria.first()).toBeAttached({ timeout: 60_000 });
    await memoria.selectOption(await opcaoMemoria.first().getAttribute('value') ?? '');
    await cenario.getByRole('button', { name: 'Vincular' }).click();
    await expect(cenario).toBeHidden({ timeout: 30_000 });

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Aprovar/rejeitar' }).click();
    const decisao = page.getByRole('dialog', { name: 'Aprovar/rejeitar' });
    await expect(decisao.getByLabel('Justificativa auditável')).toHaveValue(JUSTIFICATIVA_DECISAO);
    await decisao.getByRole('button', { name: 'Aprovar' }).click();
    await expect(decisao).toBeHidden({ timeout: 30_000 });
    await expect(ficha.getByText('Situação Aprovada').first()).toBeVisible();
    await expect(ficha.getByText(`Responsável pela aprovação ${nomeB}`).first()).toBeVisible();

    const antes = await page.getByRole('row', { name: DESCRICAO }).count();
    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Publicar e auditar' }).click();
    const publicar = page.getByRole('dialog', { name: 'Publicar e auditar' });
    await publicar.getByRole('button', { name: 'Publicar' }).click();
    await expect(publicar).toBeHidden({ timeout: 30_000 });
    await expect(ficha.getByText('Situação Publicada').first()).toBeVisible();
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.getByText('Alteração publicada').first()).toBeVisible();

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Publicar e auditar' }).click();
    await page.getByRole('dialog', { name: 'Publicar e auditar' }).getByRole('button', { name: 'Publicar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Ação não permitida na situação atual.' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('row', { name: DESCRICAO })).toHaveCount(antes);

    const busca = page.getByLabel('Pesquisar descrição ou referência de negócio');
    await busca.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(ficha).toBeVisible();
    await expectControlesComNome(page.locator('body'));
    await expectSemIdentificadoresTecnicos(page);
    await page.close();

    const autor = await abrirComo(browser, baseURL!, usuarios.adminA);
    await autor.goto('/fiscal/homologacao');
    await expect(autor.getByRole('heading', { name: PAINEL, level: 1 })).toBeVisible();
    await abrirRevisao(autor, doAutor, 'Revisão do autor desta versão.');
    await abrirAcoes(autor);
    await autor.getByRole('button', { name: 'Aprovar/rejeitar' }).click();
    await autor.getByRole('dialog', { name: 'Aprovar/rejeitar' }).getByRole('button', { name: 'Aprovar' }).click();
    await expect(autor.getByRole('alert')).toContainText('A aprovação deve ser feita por usuário diferente de quem submeteu.');
    await autor.close();

    const gestor = await abrirComo(browser, baseURL!, usuarios.gestor);
    await gestor.goto('/gestao/dashboard');
    await esperarPainelEstavel(gestor);
    const menuGestor = gestor.getByRole('complementary', { name: 'Navegação principal' });
    await expect(menuGestor).toBeVisible();
    const grupoFiscal = menuGestor.getByRole('button', { name: /FISCAL/ });
    if (await grupoFiscal.count()) {
      if ((await grupoFiscal.getAttribute('aria-expanded')) !== 'true') await grupoFiscal.click();
    }
    await expect(menuGestor.getByRole('link', { name: PAINEL })).toHaveCount(0);
    await gestor.goto('/fiscal/homologacao');
    await expect(gestor.getByText(SEM_PERMISSAO)).toBeVisible();
    await gestor.close();
  });
});
