import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { limparPlano } from './limpar-plano';

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

async function criarCentro(page: Page) {
  await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
  await page.getByRole('button', { name: 'Pesquisar centro de custo', exact: true }).click();
  await expect(page.getByText('Nenhum cadastro disponível para seleção. Consulte a área responsável.').first()).toBeVisible();
  await page.getByLabel('Código', { exact: true }).first().fill('CT-E2E');
  await page.getByLabel('Centro de custo', { exact: true }).first().fill('Operação industrial');
  await page.getByLabel('Motivo da alteração', { exact: true }).first().fill('centro da jornada');
  await page.getByRole('button', { name: '+ Novo registro', exact: true }).nth(1).click();
  await expect(page.getByRole('option', { name: 'Operação industrial', exact: true })).toHaveCount(1);
}

async function criarConta(
  page: Page,
  dados: { codigo: string; nome: string; classificacao: 'sintética' | 'analítica'; pai: string | null },
) {
  await page.getByRole('button', { name: '+ Novo registro', exact: true }).first().click();
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
    await expect(page.getByText('Provisório', { exact: true })).toBeVisible();
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
    await page.getByRole('tab', { name: 'Regras e validações', exact: true }).click();
    await expect(page.getByText('partida dobrada, níveis hierárquicos válidos, competência obrigatória', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Exceções', exact: true }).click();
    await expect(page.getByText('Bloqueio / exceção: Conta desativada.')).toBeVisible();
    await expect(page.getByText('Bloqueio / exceção: Mudança de classificação após fechamento.')).toBeVisible();
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
    await page.getByRole('tab', { name: 'Exceções', exact: true }).click();
    await expect(page.getByText('Bloqueio / exceção: Conta desativada.')).toBeVisible();
    await expect(page.getByText('Bloqueio / exceção: Mudança de classificação após fechamento.')).toBeVisible();
    await page.close();
  });
});
