/**
 * E01-T05 — Painel de homologação: jornada, acesso e rótulos.
 * O segundo administrador homologa a regra que o primeiro submeteu.
 */
import * as fs from 'node:fs';
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { BACKEND_URL } from './helpers/onda6-seed';
import {
  criarCenarioHomologacao,
  criarHomologacoesEmLote,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T05,
  type UsuarioE2e,
} from './helpers/e01-t05-seed';
import { acaoDoProcesso, escolherCombo, paginacao, valorCampo } from './helpers/fiscal-ui';

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
  await escolherCombo(page, drawer, 'hom-regra', 'Buscar enquadramento', codigo, new RegExp(`^${codigo} · versão \\d+$`));
}

async function abrirRevisao(page: Page, cenario: CenarioE01T05, descricao: string): Promise<void> {
  await page.getByRole('button', { name: '+ Novo registro' }).click();
  const drawer = page.getByRole('dialog', { name: 'Novo registro' });
  await expect(drawer.getByRole('button', { name: 'Cadastrar / revisar' })).toHaveCount(0);
  await escolherEnquadramento(page, drawer, cenario.codigoEnquadramento);
  await expect(valorCampo(drawer, 'Início de vigência')).toHaveText('01/01/2026', { timeout: 15_000 });
  await expect(valorCampo(drawer, 'Fim de vigência')).toHaveText('31/12/2026');
  await expect(valorCampo(drawer, 'Responsável pela aprovação')).toHaveText('Pendente');
  await drawer.getByLabel('Descrição').fill(descricao);
  await drawer.getByLabel('Justificativa auditável').fill(JUSTIFICATIVA_ABERTURA);
  await drawer.getByRole('button', { name: 'Verificar dados' }).click();
  await expect(drawer.getByText('Dados verificados.')).toBeVisible();
  await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

/** Abre o diálogo de uma ação da aba Movimentações (o botão mantém o foco de retorno). */
async function abrirAcaoDaFicha(page: Page, botao: string): Promise<Locator> {
  await page.getByRole('tab', { name: 'Movimentações' }).click();
  await page.getByRole('button', { name: botao, exact: true }).click();
  return page.getByRole('dialog', { name: botao });
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
    await expect(valorCampo(ficha, 'Situação')).toContainText('Em revisão');
    await expect(valorCampo(ficha, 'Início de vigência')).toContainText('01/01/2026');
    await expect(valorCampo(ficha, 'Fim de vigência')).toContainText('31/12/2026');
    await expect(valorCampo(ficha, 'Usuário')).not.toBeEmpty();
    await expect(valorCampo(ficha, 'Responsável pela aprovação')).toHaveText('Pendente');
    await expect(valorCampo(ficha, 'Criado em')).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) {
      await expect(page.getByText(selo).first()).toBeVisible();
    }

    // Consultar histórico ativa a aba, com "quando • quem".
    await ficha.getByRole('button', { name: 'Consultar histórico' }).click();
    await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} • /).first()).toBeVisible();
    await page.getByRole('tab', { name: 'Ficha e campos' }).click();

    const diff = await abrirAcaoDaFicha(page, 'Revisar diff');
    await expect(diff.getByText(/Alíquota \(%\)/).first()).toBeVisible();
    await expect(diff.getByText('novo').first()).toBeVisible();
    await expect(diff.getByText('01/01/2026').first()).toBeVisible();
    await diff.getByRole('button', { name: 'Fechar' }).focus();
    await page.keyboard.press('Escape');
    await expect(diff).toBeHidden();
    await expect(page.getByRole('button', { name: 'Revisar diff', exact: true }), 'foco volta ao controle que abriu o diálogo').toBeFocused();

    await page.getByRole('tab', { name: 'Ficha e campos' }).click();
    await ficha.getByRole('button', { name: 'cenários aprovados' }).click();
    const cenario = page.getByRole('dialog', { name: 'cenários aprovados' });
    await escolherCombo(page, cenario, 'hom-memoria', 'Buscar memória calculada', principal.simulacaoCodigo, new RegExp(principal.simulacaoCodigo));
    await cenario.getByRole('button', { name: 'Vincular' }).click();
    await expect(cenario.getByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeVisible();
    await cenario.getByLabel('Justificativa auditável').fill('Vínculo da memória desta versão.');
    await cenario.getByRole('button', { name: 'Vincular' }).click();
    await expect(cenario).toBeHidden({ timeout: 30_000 });
    await expect(ficha.getByText(new RegExp(`${principal.simulacaoCodigo} · versão 1`))).toBeVisible();

    await acaoDoProcesso(page, 'Aprovar/rejeitar');
    const decisao = page.getByRole('dialog', { name: 'Aprovar/rejeitar' });
    await expect(decisao.getByLabel('Justificativa auditável')).toHaveValue('');
    await decisao.getByRole('button', { name: 'Aprovar' }).click();
    await expect(decisao.getByText('Informe a justificativa (mínimo de 3 caracteres).')).toBeVisible();
    await decisao.getByLabel('Justificativa auditável').fill(JUSTIFICATIVA_DECISAO);
    await decisao.getByRole('button', { name: 'Aprovar' }).click();
    await expect(decisao).toBeHidden({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Ficha e campos' }).click();
    await expect(valorCampo(ficha, 'Situação')).toContainText('Aprovada');
    await expect(valorCampo(ficha, 'Responsável pela aprovação')).toHaveText(nomeB);

    await page.getByRole('tab', { name: 'Movimentações' }).click();
    await expect(page.getByRole('button', { name: 'Aprovar/rejeitar', exact: true }), 'já decidida').toBeDisabled();
    const antes = await page.getByRole('row', { name: DESCRICAO }).count();
    const publicar = await abrirAcaoDaFicha(page, 'Publicar e auditar');
    await expect(publicar.getByLabel('Justificativa auditável')).toHaveValue('');
    await publicar.getByLabel('Justificativa auditável').fill('Publicação com a memória desta versão.');
    await publicar.getByRole('button', { name: 'Publicar' }).click();
    await expect(publicar).toBeHidden({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Ficha e campos' }).click();
    await expect(valorCampo(ficha, 'Situação')).toContainText('Publicada');
    await page.getByRole('tab', { name: 'Histórico' }).click();
    await expect(page.getByText('Alteração publicada').first()).toBeVisible();

    await page.getByRole('tab', { name: 'Movimentações' }).click();
    await expect(page.getByRole('button', { name: 'Publicar e auditar', exact: true }), 'publicada não publica de novo').toBeDisabled();
    await expect(page.getByRole('row', { name: DESCRICAO })).toHaveCount(antes);

    // Recarrega para esvaziar a seleção: só o Enter na linha pode reabrir a ficha.
    await page.reload();
    await expect(page.getByRole('heading', { name: PAINEL, level: 1 })).toBeVisible();
    await expect(page.getByRole('row').nth(1)).toBeVisible({ timeout: 30_000 });
    await expect(ficha).toHaveCount(0);
    const linhaPrimeira = page.getByRole('row').nth(1);
    await page.getByLabel('Pesquisar descrição ou referência de negócio').focus();
    let naLinha = false;
    for (let i = 0; i < 40 && !naLinha; i += 1) {
      await page.keyboard.press('Tab');
      naLinha = await linhaPrimeira.evaluate((el) => el === document.activeElement);
    }
    expect(naLinha, 'o foco deve alcançar a linha da grade só com Tab').toBe(true);
    await expect(ficha).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(ficha).toBeVisible();
    await expectControlesComNome(page.locator('body'));
    await expectSemIdentificadoresTecnicos(page);
    await page.close();

    const autor = await abrirComo(browser, baseURL!, usuarios.adminA);
    await autor.goto('/fiscal/homologacao');
    await expect(autor.getByRole('heading', { name: PAINEL, level: 1 })).toBeVisible();
    await abrirRevisao(autor, doAutor, 'Revisão do autor desta versão.');
    const decisaoAutor = await abrirAcaoDaFicha(autor, 'Aprovar/rejeitar');
    await decisaoAutor.getByLabel('Justificativa auditável').fill('Tentativa do autor da regra.');
    await decisaoAutor.getByRole('button', { name: 'Aprovar' }).click();
    await expect(decisaoAutor.getByRole('alert')).toContainText('A aprovação deve ser feita por usuário diferente de quem submeteu.');
    await expect(autor.getByRole('alert')).toHaveCount(1);
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

  test('lista com mais de 20 linhas: paginação, ordenação e exportação no servidor', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario = await criarCenarioHomologacao(request, cookieA, cookieB, 'Paginacao');
    const descricao = `Lote de revisões ${cenario.codigoEnquadramento}-${Date.now()}`;
    await criarHomologacoesEmLote(request, cookieA, cookieB, cenario, 21, descricao);
    const page = await abrirComo(browser, baseURL!, usuarios.adminB);

    await page.goto('/fiscal/homologacao');
    await expect(page.getByRole('heading', { name: PAINEL, level: 1 })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Pesquisar descrição ou referência de negócio').fill(descricao);
    const navegacao = paginacao(page);
    await expect(navegacao).toContainText('Exibindo 20 de 21 registros');
    await expect(navegacao).toContainText('Página 1 de 2');
    await expect(page.getByRole('row', { name: descricao })).toHaveCount(20);
    await navegacao.getByRole('button', { name: 'Próxima' }).click();
    await expect(navegacao).toContainText('Exibindo 1 de 21 registros');
    await expect(navegacao).toContainText('Página 2 de 2');
    await expect(navegacao.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await page.getByRole('button', { name: 'Descrição', exact: true }).click();
    await expect(navegacao).toContainText('Página 1 de 2');
    await expect(page.getByRole('columnheader', { name: 'Descrição' })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByLabel('Situação').selectOption('REJEITADA');
    await expect(navegacao).toContainText('Exibindo 20 de 20 registros');

    const exportacao = page.waitForResponse(
      (item) => new URL(item.url()).pathname === '/api/erp/fiscal/homologacoes/exportacao',
      { timeout: 30_000 },
    );
    const [arquivo] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar visão' }).click(),
    ]);
    const resposta = await exportacao;
    expect(resposta.ok()).toBe(true);
    const consulta = new URL(resposta.url()).searchParams;
    expect(consulta.get('search')).toBe(descricao);
    expect(consulta.get('situacao')).toBe('REJEITADA');
    expect(consulta.get('sort')).toBe('descricao');
    expect(fs.readFileSync(await arquivo.path(), 'utf8')).toMatch(/;01\/01\/2026;/);
  });
});
