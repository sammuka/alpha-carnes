/**
 * E01-T04 — Simulador fiscal: jornada, autorização e acessibilidade.
 * A competência é input type=month (AAAA-MM). O calendário de dia, quando
 * aparecer num popover, só é escolhido por gridcell com nome exato.
 */
import * as fs from 'node:fs';
import { test, expect, type Browser, type Locator, type Page, type Response } from '@playwright/test';
import {
  criarCenario,
  criarSimulacaoApoio,
  criarSimulacoesEmLote,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T04,
  type UsuarioE2e,
} from './helpers/e01-t04-seed';

import { acaoDoProcesso, escolherCombo, paginacao, valorCampo } from './helpers/fiscal-ui';

const TITULO = 'Simulador fiscal e memória de cálculo';
const EMPRESAS = 'Empresas, estabelecimentos e regime';
const ENQUADRAMENTOS = 'Operações fiscais e enquadramentos';
const REGRAS = 'Editor de regras tributárias';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o simulador fiscal e a memória de cálculo.';
const FALTA = 'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.';
const FRASE_IPI = 'Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.';
const MOTIVO = 'Simulação da competência de outubro de 2026.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const CODIGO_DE_TASK = /E\d{2}-T\d{2}/;

function escapar(texto: string): RegExp {
  return new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.simulador.lista'));
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

/** O seletor do painel troca `?operacaoId` e cancela o clique do menu se os dois coincidem. */
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

async function exigirPost(resposta: Response, rota: string, escopo: Locator): Promise<void> {
  if (resposta.ok()) return;
  const corpo = await resposta.text();
  const alerta = (await escopo.locator('p[role=alert]').allTextContents()).join(' | ');
  throw new Error(`POST ${rota} ${resposta.status()} url=${resposta.url()} corpo=${corpo} alerta=${alerta || '(nenhum)'}`);
}

/** `type=month` recebe AAAA-MM. Se o navegador abrir um calendário, o mês sai do gridcell. */
async function preencherCompetencia(page: Page, campo: Locator, anoMes: string): Promise<void> {
  await campo.fill(anoMes);
  if ((await campo.inputValue()) === anoMes) return;
  await campo.click();
  const popover = page.locator('[data-slot="popover-content"]');
  const mes = Number(anoMes.slice(5));
  const celula = popover.getByRole('gridcell', { name: String(mes), exact: true });
  await expect(celula).toBeVisible();
  await celula.click();
  await expect(campo).toHaveValue(anoMes);
}

async function escolherEnquadramento(page: Page, drawer: Locator, cenario: CenarioE01T04): Promise<void> {
  await escolherCombo(page, drawer, 'sim-enq', 'Buscar enquadramento', cenario.codigoEnquadramento, new RegExp(`^${cenario.codigoEnquadramento} · `));
  await expect(drawer.locator('#sim-op')).toContainText(cenario.rotuloOperacao, { timeout: 15_000 });
  await expect(drawer.locator('#sim-cli')).toContainText(cenario.clienteNome);
  await expect(drawer.locator('#sim-ncm')).toContainText('0201.30.00');
}

async function preencherSimulacao(page: Page, drawer: Locator, cenario: CenarioE01T04, competencia: string): Promise<void> {
  await escolherEnquadramento(page, drawer, cenario);
  await drawer.getByLabel('Quantidade', { exact: true }).fill('10,000');
  await drawer.getByLabel('Peso informado na nota (kg)', { exact: true }).fill('982,000');
  await drawer.getByLabel('Valor', { exact: true }).fill('1.000,00');
  await drawer.getByLabel('Desconto', { exact: true }).fill('0,00');
  await preencherCompetencia(page, drawer.getByLabel('Competência', { exact: true }), competencia);
  await drawer.getByLabel('Motivo da alteração', { exact: true }).fill(MOTIVO);
}

function linhasDo(page: Page, rotulo: string): Locator {
  return page.getByRole('row', { name: escapar(rotulo) });
}

async function filtrarCliente(page: Page, nome: string): Promise<void> {
  const busca = page.getByLabel('Buscar cliente', { exact: true });
  await expect(async () => {
    await busca.fill(nome);
    await expect(busca).toHaveValue(nome, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

async function expectSemIdentificadoresTecnicos(page: Page): Promise<void> {
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(UUID);
  expect(texto).not.toMatch(CODIGO_DE_TASK);
  expect(texto).not.toMatch(/Marca/);
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

test.describe('E01-T04 Simulador fiscal e memória de cálculo', () => {
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(300_000);

  test('jornada: simulação, memória, versão, comparação e competência sem regra', async ({ browser, request, baseURL }) => {
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
    await expect(aside.getByRole('link', { name: REGRAS })).toBeVisible();
    const link = aside.getByRole('link', { name: TITULO });
    await expect(link).toHaveAttribute('href', '/fiscal/simulador');
    await Promise.all([
      page.waitForURL(/\/fiscal\/simulador$/, { timeout: 60_000 }),
      link.click(),
    ]);
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await expect(drawer.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible();
    await preencherSimulacao(page, drawer, cenario, '2026-10');
    const [criada] = await Promise.all([
      page.waitForResponse(
        (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/erp/fiscal/simulacoes',
        { timeout: 30_000 },
      ),
      drawer.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    await exigirPost(criada, '/api/erp/fiscal/simulacoes', drawer);
    await expect(drawer).toBeHidden();
    await filtrarCliente(page, cenario.clienteNome);
    const linhas = linhasDo(page, cenario.clienteNome);
    await expect(linhas).toHaveCount(1);

    await linhas.click();
    const ficha = page.getByRole('tabpanel');
    await expect(valorCampo(ficha, 'Situação')).toHaveText('Calculada');
    await expect(valorCampo(ficha, 'Valor líquido (calculado)')).toHaveText('R$ 1.000,00');
    await expect(valorCampo(ficha, 'Base tributável (calculada)')).toHaveText('R$ 583,30');
    await expect(valorCampo(ficha, 'Criado em')).toHaveText(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    await expect(valorCampo(ficha, 'Classificação fiscal (NCM)')).toContainText('0201.30.00');
    await expect(ficha.getByRole('status').first()).toHaveText('Base tributável difere de valor bruto');
    for (const selo of ['H-E01-10', 'H-E01-11', 'H-E01-12']) {
      await expect(page.getByText(selo).first()).toBeVisible();
    }

    await ficha.getByRole('button', { name: 'Explicar tributos' }).click();
    await expect(ficha.getByText('ICMS: 70,00').first()).toBeVisible();
    await expect(ficha.getByText(/Redução de base do ICMS \(%\)/).first()).toBeVisible();
    const ipi = ficha.locator('li', { hasText: 'Tratamento IPI' });
    await expect(ipi).toContainText(FRASE_IPI);
    await expect(ipi).not.toContainText('0,00');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      ficha.getByRole('button', { name: 'Exportar memória' }).click(),
    ]);
    expect(fs.readFileSync(await download.path(), 'utf8')).toContain('Campo;Valor');

    await ficha.getByRole('button', { name: 'Consultar histórico' }).click();
    await expect(page.getByRole('tab', { name: 'Histórico' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} • /).first()).toBeVisible();

    await acaoDoProcesso(page, 'Nova versão');
    const versao = page.getByRole('dialog', { name: 'Nova versão' });
    await versao.getByLabel('Desconto da versão', { exact: true }).fill('100,00');
    await versao.getByLabel('Motivo da alteração', { exact: true }).fill('Versão com desconto de cem reais.');
    const [nova] = await Promise.all([
      page.waitForResponse(
        (item) => item.request().method() === 'POST' && /\/api\/erp\/fiscal\/simulacoes\/[^/]+\/versoes$/.test(new URL(item.url()).pathname),
        { timeout: 30_000 },
      ),
      versao.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    await exigirPost(nova, '/api/erp/fiscal/simulacoes/versoes', versao);
    await expect(versao).toBeHidden();
    await expect(linhas).toHaveCount(2);
    // A ficha abre a versão criada.
    await expect(valorCampo(page, 'Versão')).toHaveText('2');
    await expect(valorCampo(page, 'Valor líquido (calculado)')).toHaveText('R$ 900,00');

    await linhas.filter({ hasNotText: '900,00' }).click();
    await expect(valorCampo(page, 'Versão')).toHaveText('1');
    await page.getByRole('button', { name: 'Comparar versões', exact: true }).click();
    const comparar = page.getByRole('dialog', { name: 'Comparar versões' });
    const outra = comparar.getByLabel('Outra versão', { exact: true });
    await expect(outra.locator('option')).toHaveCount(2);
    await expect(outra.locator('option').nth(1)).toHaveText(/ · versão 2 · Calculada · Outubro de 2026$/);
    await outra.selectOption((await outra.locator('option').nth(1).getAttribute('value')) ?? '');
    await comparar.getByRole('button', { name: 'Comparar versões', exact: true }).click();
    await expect(comparar.getByText('ICMS: 70,00 → 63,00')).toBeVisible();
    await comparar.getByRole('button', { name: 'Fechar' }).click();
    await expect(comparar).toBeHidden();
    await expect(linhas).toHaveCount(2);

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const semRegra = page.getByRole('dialog', { name: 'Novo registro' });
    await preencherSimulacao(page, semRegra, cenario, '2027-01');
    const [recusa] = await Promise.all([
      page.waitForResponse(
        (item) => item.request().method() === 'POST' && new URL(item.url()).pathname === '/api/erp/fiscal/simulacoes',
        { timeout: 30_000 },
      ),
      semRegra.getByRole('button', { name: 'Salvar rascunho' }).click(),
    ]);
    expect(recusa.status(), await recusa.text()).toBe(422);
    await expect(semRegra.locator('p[role=alert]')).toContainText(FALTA);
    await semRegra.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Descartar e sair' }).click();
    await expect(semRegra).toBeHidden();
    await expect(linhas).toHaveCount(2);
    await expectSemIdentificadoresTecnicos(page);
  });

  test('lista com mais de 20 linhas: paginação, ordenação e exportação no servidor', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario = await criarCenario(request, cookieA, cookieB, 'Paginacao');
    await criarSimulacoesEmLote(request, cookieA, cenario, 21);
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);

    await page.goto('/fiscal/simulador');
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 30_000 });
    await filtrarCliente(page, cenario.clienteNome);
    const navegacao = paginacao(page);
    await expect(navegacao).toContainText('Exibindo 20 de 21 registros');
    await expect(navegacao).toContainText('Página 1 de 2');
    await expect(linhasDo(page, cenario.clienteNome)).toHaveCount(20);
    await navegacao.getByRole('button', { name: 'Próxima' }).click();
    await expect(navegacao).toContainText('Exibindo 1 de 21 registros');
    await expect(navegacao).toContainText('Página 2 de 2');
    await expect(linhasDo(page, cenario.clienteNome)).toHaveCount(1);
    await expect(navegacao.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await page.getByRole('button', { name: 'Valor', exact: true }).click();
    await expect(navegacao).toContainText('Página 1 de 2');
    await expect(page.getByRole('columnheader', { name: 'Valor', exact: true })).toHaveAttribute('aria-sort', 'ascending');

    const exportacao = page.waitForResponse(
      (item) => new URL(item.url()).pathname === '/api/erp/fiscal/simulacoes/exportacao',
      { timeout: 30_000 },
    );
    await page.getByRole('button', { name: 'Exportar visão' }).click();
    const resposta = await exportacao;
    expect(resposta.ok()).toBe(true);
    const consulta = new URL(resposta.url()).searchParams;
    expect(consulta.get('search')).toBe(cenario.clienteNome);
    expect(consulta.get('sort')).toBe('valor');
  });

  test('autorização: gestor não vê o item e o administrador mantém o grupo Fiscal', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const gestor = await abrirComo(browser, baseURL!, usuarios.gestor);
    await gestor.goto('/fiscal/simulador');
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
    await expect(asideAdmin.getByRole('link', { name: REGRAS })).toBeVisible();
    await expect(asideAdmin.getByRole('link', { name: TITULO })).toBeVisible();
  });

  test('acessibilidade: nomes, grade por teclado, Escape e retorno de foco', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const cenario = await criarCenario(request, cookieA, cookieB, 'Acessibilidade');
    await criarSimulacaoApoio(request, cookieA, cenario);
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);
    const principal = page.getByRole('main');

    await page.goto('/fiscal/simulador');
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 30_000 });
    await filtrarCliente(page, cenario.clienteNome);
    const linha = linhasDo(page, cenario.clienteNome);
    await expect(linha).toBeVisible();
    await expectControlesComNome(principal);

    const novo = page.getByRole('button', { name: '+ Novo registro' });
    await novo.click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await expect(drawer).toBeVisible();
    await expectControlesComNome(drawer);
    await expectSemIdentificadoresTecnicos(page);
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
    await expect(novo).toBeFocused();

    await page.getByLabel('Buscar cliente', { exact: true }).focus();
    let naLinha = false;
    for (let i = 0; i < 40 && !naLinha; i += 1) {
      await page.keyboard.press('Tab');
      naLinha = await linha.evaluate((el) => el === document.activeElement);
    }
    expect(naLinha, 'o foco deve alcançar a linha da grade só com Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(valorCampo(page, 'Situação')).toHaveText('Calculada');
    await expectControlesComNome(principal);

    const novaVersao = page.getByRole('button', { name: 'Nova versão', exact: true });
    await novaVersao.click();
    const dialogo = page.getByRole('dialog', { name: 'Nova versão' });
    await expect(dialogo).toBeVisible();
    await expectControlesComNome(dialogo);
    await page.keyboard.press('Escape');
    await expect(dialogo).toBeHidden();
    await expect(novaVersao).toBeFocused();
    await expectSemIdentificadoresTecnicos(page);
  });
});
