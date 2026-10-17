import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { limparPlano } from './limpar-plano';
import { criarPlanoDaJornada } from './helpers/e09-t02-seed';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CiTest123456';
const COMERCIAL_EMAIL = 'comercial.e09.t01@alphacarnes.local';
const COMERCIAL_SENHA = 'Comercial@E09t01';

async function cookiesDoLogin(
  contexto: BrowserContext,
  baseURL: string,
  email: string,
  senha: string,
) {
  const resposta = await contexto.request.post('/api/auth/login', {
    data: { email, password: senha },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(resposta.ok(), `login falhou: ${resposta.status()}`).toBeTruthy();
  const cookies = resposta
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [par] = header.value.split(';');
      const igual = par.indexOf('=');
      return { name: par.slice(0, igual), value: par.slice(igual + 1), url: baseURL };
    });
  await contexto.addCookies(cookies);
}

async function abrirPlano(page: Page) {
  await page.goto('/gestao/dashboard');
  await expect(page.getByText('Carregando operações…')).toBeHidden({ timeout: 15_000 });
  const seletor = page.getByLabel('Selecionar operação', { exact: true });
  if (await seletor.count()) {
    await expect(page).toHaveURL(/operacaoId=/, { timeout: 15_000 });
  }
  const grupo = page.getByRole('button', { name: 'CONTABILIDADE', exact: true });
  if ((await grupo.count()) && (await grupo.getAttribute('aria-expanded')) !== 'true') {
    await grupo.click();
  }
  await page.getByRole('link', { name: 'Plano de contas e centros de custo', exact: true }).click();
  await expect(page).toHaveURL(/\/erp\/contabilidade\/plano-de-contas$/);
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
}

async function preencherInicioVigencia(page: Page, iso: string) {
  const campo = page.getByLabel('Início de vigência', { exact: true });
  const tag = await campo.evaluate((elemento) => elemento.tagName.toLowerCase());
  if (tag === 'input') {
    await campo.fill(iso);
    return;
  }
  await campo.click();
  const popover = page.locator('[data-slot="popover-content"]');
  await expect(popover).toBeVisible();
  const [ano, mes, dia] = iso.split('-').map(Number);
  const hoje = new Date();
  const diffMeses = (ano - hoje.getFullYear()) * 12 + (mes - 1 - hoje.getMonth());
  const navegacao = popover.getByRole('button', {
    name: diffMeses >= 0 ? 'Go to next month' : 'Go to previous month',
  });
  for (let i = 0; i < Math.abs(diffMeses); i += 1) await navegacao.click();
  const diaCell = popover
    .getByRole('gridcell', { name: String(dia), exact: true })
    .and(popover.locator(':not(.text-fg-faint)'));
  await diaCell.click();
  await expect(popover).toBeHidden();
}

/** Drawer do formulário (Sheet modal do DS): enquanto aberto, o fundo da tela não recebe clique. */
const formulario = (page: Page) => page.getByRole('dialog', { name: 'Plano de contas e centros de custo', exact: true });

async function criarCentro(page: Page) {
  await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
  await page.getByRole('button', { name: 'Pesquisar centro de custo', exact: true }).click();
  await expect(page.getByText('Nenhum cadastro disponível para seleção. Consulte a área responsável.').first()).toBeVisible();
  await page.getByLabel('Código', { exact: true }).first().fill('CT-E2E');
  await page.getByLabel('Centro de custo', { exact: true }).first().fill('Operação industrial');
  await page.getByLabel('Motivo da alteração', { exact: true }).first().fill('centro da jornada');
  await formulario(page).getByRole('button', { name: '+ Novo registro', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Operação industrial', exact: true })).toHaveCount(1);
}

async function criarConta(
  page: Page,
  dados: { codigo: string; nome: string; classificacao: 'sintética' | 'analítica'; pai: string | null },
) {
  if (!(await formulario(page).isVisible())) await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
  await page.getByLabel('Código', { exact: true }).last().fill(dados.codigo);
  await page.getByPlaceholder('Informe conta contábil').fill(dados.nome);
  await page.getByLabel('Conta sintética/analítica', { exact: true }).selectOption({ label: dados.classificacao });
  await page.getByLabel('Natureza da conta', { exact: true }).selectOption({ label: 'Ativo' });
  await page.getByLabel('Grupo', { exact: true }).fill('Circulante');
  if (dados.pai) {
    await page.getByRole('button', { name: 'Pesquisar conta contábil', exact: true }).click();
    const lookup = page.getByRole('dialog', { name: 'Selecionar Conta contábil', exact: true });
    await lookup.getByLabel('Pesquisar cadastro', { exact: true }).fill('Grupo do ativo');
    await lookup.getByRole('button', { name: /Grupo do ativo/ }).click();
    await expect(lookup).toBeHidden();
    await expect(page.getByPlaceholder('Selecione conta contábil').locator('option:checked')).toHaveText('Grupo do ativo');
  }
  await page.getByLabel('Centro de custo', { exact: true }).last().selectOption({ label: 'Operação industrial' });
  await preencherInicioVigencia(page, '2026-10-01');
  await page.getByLabel('Motivo da alteração', { exact: true }).last().fill('abre a conta');
  await page.getByRole('button', { name: 'Criar', exact: true }).last().click();
  await expect(page.getByRole('cell', { name: dados.nome, exact: true })).toBeVisible({ timeout: 15_000 });
}

async function confirmarEContar(page: Page, linhas: number) {
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.plano-grade tbody tr')).toHaveCount(linhas);
}

async function revisarEAprovar(page: Page, linhas: number) {
  await page.getByRole('button', { name: 'Revisar competência', exact: true }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).last().fill('revisa a competência');
  await confirmarEContar(page, linhas);
  await page.getByRole('button', { name: 'Aprovar', exact: true }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).last().fill('aprova a conta');
  await confirmarEContar(page, linhas);
  await expect(page.locator('.plano-grade').getByText('Aprovado', { exact: true }).first()).toBeVisible();
}

test.describe('Plano de contas', () => {
  test.describe.configure({ mode: 'serial' });

  let adminContext: BrowserContext;
  let comercialContext: BrowserContext;

  test.beforeAll(async ({ browser, baseURL }) => {
    adminContext = await browser.newContext({ baseURL });
    await cookiesDoLogin(adminContext, baseURL!, ADMIN_EMAIL, ADMIN_PASSWORD);
    const criado = await adminContext.request.post('/api/admin/usuarios', {
      data: {
        nome: 'Comercial da jornada',
        email: COMERCIAL_EMAIL,
        password: COMERCIAL_SENHA,
        perfis: ['comercial'],
      },
    });
    expect(criado.ok() || criado.status() === 409, `criar comercial: ${criado.status()}`).toBeTruthy();
    comercialContext = await browser.newContext({ baseURL });
    await cookiesDoLogin(comercialContext, baseURL!, COMERCIAL_EMAIL, COMERCIAL_SENHA);
  });

  test.afterAll(async () => {
    await comercialContext?.close();
    await adminContext?.close();
  });

  test.beforeEach(() => {
    limparPlano();
  });

  test('comercial não abre o plano', async () => {
    const page = await comercialContext.newPage();
    await page.goto('/gestao/dashboard');
    await expect(page.getByRole('link', { name: 'Plano de contas e centros de custo', exact: true })).toHaveCount(0);
    await page.goto('/erp/contabilidade/plano-de-contas');
    await expect(page.getByText('Acesso não permitido', { exact: true })).toBeVisible();
    await page.close();
  });

  test('grade ordena cinco colunas e situação fica só no cabeçalho', async () => {
    const page = await adminContext.newPage();
    await abrirPlano(page);
    await expect(page.getByRole('heading', { name: 'Plano de contas e centros de custo', exact: true })).toBeVisible();
    for (const rotulo of ['Conta contábil', 'Natureza da conta', 'Centro de custo', 'Início de vigência', 'Fim de vigência']) {
      await expect(page.getByRole('button', { name: `Ordenar por ${rotulo}`, exact: true })).toBeVisible();
    }
    const situacao = page.getByRole('columnheader', { name: 'Situação', exact: true });
    await expect(situacao).toBeVisible();
    await expect(situacao.getByRole('button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ordenar por Situação' })).toHaveCount(0);
    await expect(page.getByLabel('Buscar registros da lista', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Filtrar situação', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab')).toHaveCount(7);
    await page.getByRole('button', { name: 'Bloquear conta e mapear lançamentos', exact: true }).click();
    await expect(page.getByLabel('Justificativa / observação', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.close();
  });

  test('administrador cria conta analítica, bloqueia e vê a conta desativada', async () => {
    const page = await adminContext.newPage();
    await abrirPlano(page);
    await expect(page.getByRole('heading', { name: 'Plano de contas e centros de custo', exact: true })).toBeVisible();
    await expect(page.getByText('Provisório', { exact: true }).first()).toBeVisible();
    await criarCentro(page);
    await criarConta(page, { codigo: '1', nome: 'Grupo do ativo', classificacao: 'sintética', pai: null });
    await revisarEAprovar(page, 1);
    await page.getByRole('cell', { name: 'Grupo do ativo', exact: true }).click();
    await criarConta(page, { codigo: '1.1.01', nome: 'Caixa e bancos', classificacao: 'analítica', pai: '1' });
    await revisarEAprovar(page, 2);
    await expect(page.getByRole('cell', { name: 'Caixa e bancos', exact: true })).toBeVisible();
    await expect(page.getByText(/[0-9a-f]{8}-[0-9a-f]{4}-7/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Bloquear conta e mapear lançamentos', exact: true }).click();
    await page.getByLabel('Justificativa / observação', { exact: true }).fill('bloqueia a conta');
    await confirmarEContar(page, 2);
    await page.getByRole('button', { name: 'Ações do processo', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir decisão →', exact: true }).click();
    await page.getByLabel('Justificativa / observação', { exact: true }).fill('tenta mapear');
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('conta desativada', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('tab', { name: 'Regras e validações', exact: true }).click();
    await expect(page.getByText('partida dobrada, níveis hierárquicos válidos, competência obrigatória', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Exceções', exact: true }).click();
    await expect(page.getByText('Bloqueio / exceção: Conta desativada.')).toBeVisible();
    await expect(page.getByText('Bloqueio / exceção: Mudança de classificação após fechamento.')).toBeVisible();
    await page.close();
  });

  test('Exportar visão baixa o CSV com o BOM UTF-8 e o nome do arquivo', async () => {
    const page = await adminContext.newPage();
    await abrirPlano(page);
    await criarCentro(page);
    await criarConta(page, { codigo: '1', nome: 'Grupo do ativo', classificacao: 'sintética', pai: null });
    const baixando = page.waitForEvent('download');
    const exportacao = page.waitForResponse((resposta) => new URL(resposta.url()).pathname === '/api/contabilidade/plano/exportar');
    await page.getByRole('button', { name: 'Exportar visão', exact: true }).click();
    const resposta = await exportacao;
    expect(resposta.headers()['content-type']).toContain('text/csv');
    expect(resposta.headers()['content-disposition']).toBe('attachment; filename="plano-de-contas.csv"');
    const download = await baixando;
    expect(download.suggestedFilename()).toBe('plano-de-contas.csv');
    const bytes = await readFile(await download.path());
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toContain('Grupo do ativo');
    await page.close();
  });

  test('a 760px cada conta vira um cartão e a 1280px segue em tabela, com contagem, seleção e ações', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    try {
      await criarPlanoDaJornada(api);
    } finally {
      await api.dispose();
    }
    const page = await adminContext.newPage();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/erp/contabilidade/plano-de-contas');
    // A mesma tela redimensionada: a media query troca a tabela pelos cartões sem recarregar.
    for (const largura of [1280, 760]) {
      await page.setViewportSize({ width: largura, height: 900 });
      const linhas = page.locator('.plano-grade tbody tr');
      await expect(linhas).toHaveCount(4);
      await expect(linhas.first()).toBeVisible();
      await expect(page.getByText('Exibindo 4 de 4', { exact: true })).toBeVisible();
      const estilo = await linhas.first().evaluate((tr) => ({
        display: getComputedStyle(tr).display,
        rotulo: getComputedStyle(tr.querySelector('td[data-rotulo]')!, '::before').content,
        largura: tr.getBoundingClientRect().width,
      }));
      if (largura === 760) {
        expect(estilo.display).toBe('grid');
        expect(estilo.rotulo).toBe('"Conta contábil"');
        expect(estilo.largura).toBeLessThan(760);
        await expect(page.locator('.plano-grade thead')).toBeHidden();
        // Sem cabeçalho, a ordenação por coluna passa ao seletor "Ordenar por" + direção.
        const ordenada = page.waitForResponse((resposta) => {
          const url = new URL(resposta.url());
          return url.pathname === '/api/contabilidade/plano' && url.searchParams.get('direcao') === 'desc';
        });
        await page.getByRole('combobox', { name: 'Direção da ordenação', exact: true }).selectOption({ label: 'Decrescente' });
        expect((await ordenada).ok()).toBeTruthy();
        await expect(page.getByRole('combobox', { name: 'Ordenar por', exact: true })).toBeVisible();
      } else {
        expect(estilo.display).toBe('table-row');
        await expect(page.getByRole('columnheader', { name: 'Situação', exact: true })).toBeVisible();
        await expect(page.getByRole('combobox', { name: 'Ordenar por', exact: true })).toBeHidden();
      }
      const caixa = linhas.first().getByRole('checkbox');
      await expect(caixa).toBeVisible();
      await caixa.check();
      await expect(caixa).toBeChecked();
      for (const nome of ['+ Novo registro', 'Ações do processo', 'Versionar', 'Aprovar']) {
        await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
      }
      await expect(page.getByText('Exigem decisão humana', { exact: true })).toBeVisible();
      await expect(page.getByText('Não gerar sucesso falso', { exact: true })).toBeVisible();
    }
    await page.close();
  });

  test('editar mostra no select o centro de custo gravado, antes de Pesquisar (1280 e 760px)', async ({ playwright }) => {
    const api = await playwright.request.newContext();
    let plano: Awaited<ReturnType<typeof criarPlanoDaJornada>>;
    try {
      plano = await criarPlanoDaJornada(api);
    } finally {
      await api.dispose();
    }
    const page = await adminContext.newPage();
    for (const largura of [1280, 760]) {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto('/erp/contabilidade/plano-de-contas');
      await page.locator('.plano-grade tbody tr').first().click();
      await page.getByRole('button', { name: 'Editar versão', exact: true }).click();
      await expect(page.locator('#conta-centro option:checked')).toHaveText(plano.centroNome);
      await page.getByRole('button', { name: 'Pesquisar conta contábil', exact: true }).click();
      const lookup = page.getByRole('dialog', { name: 'Selecionar Conta contábil', exact: true });
      await expect(lookup.getByRole('button').filter({ hasText: 'Cadastro ativo' }).first()).toBeVisible();
      await lookup.getByRole('button', { name: 'Fechar', exact: true }).click();
      await page.getByRole('button', { name: 'Voltar', exact: true }).click();
    }
    await page.close();
  });

  test('conta sintética aprovada não recebe mapeamento', async () => {
    const page = await adminContext.newPage();
    await abrirPlano(page);
    await criarCentro(page);
    await criarConta(page, { codigo: '1', nome: 'Grupo do ativo', classificacao: 'sintética', pai: null });
    await revisarEAprovar(page, 1);
    await page.getByRole('button', { name: 'Ações do processo', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir decisão →', exact: true }).click();
    await page.getByLabel('Justificativa / observação', { exact: true }).fill('tenta mapear a sintética');
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
    await expect(page.getByText('Conta sintética não recebe mapeamento de lançamentos', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('tab', { name: 'Exceções', exact: true }).click();
    await expect(page.getByText('Bloqueio / exceção: Conta desativada.')).toBeVisible();
    await expect(page.getByText('Bloqueio / exceção: Mudança de classificação após fechamento.')).toBeVisible();
    await page.close();
  });
});
