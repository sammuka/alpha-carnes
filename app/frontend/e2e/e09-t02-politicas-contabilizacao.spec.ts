import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@CiTest123456';

test.describe.configure({ mode: 'serial', timeout: 600_000 });

async function login(page: Page, email: string, password: string, baseURL: string) {
  const resposta = await page.request.post('/api/auth/login', {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(resposta.ok(), `login falhou: ${resposta.status()}`).toBeTruthy();
  const cookies = resposta
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [nameValue] = header.value.split(';');
      const eq = nameValue.indexOf('=');
      return { name: nameValue.slice(0, eq), value: nameValue.slice(eq + 1), url: baseURL };
    });
  await page.context().addCookies(cookies);
}

async function criarSegundoAdministrador(page: Page) {
  const criado = await page.request.post('/api/admin/usuarios', {
    data: {
      nome: 'Contador provisório',
      email: 'contador.provisorio@alphacarnes.local',
      password: 'senha-da-jornada',
      perfis: ['administrador'],
    },
  });
  expect(criado.ok() || criado.status() === 409, `criar administrador: ${criado.status()}`).toBeTruthy();
}

async function criarCentro(page: Page) {
  await page.goto('/erp/contabilidade/plano-de-contas');
  await expect(page.getByRole('heading', { name: 'Plano de contas e centros de custo' })).toBeVisible();
  await page.getByRole('button', { name: '+ Novo registro' }).first().click();
  await page.getByRole('button', { name: 'Pesquisar' }).click();
  const codigoCentro = page.locator('#centro-codigo');
  await expect(codigoCentro).toBeVisible();
  await codigoCentro.fill('CT1');
  await page.locator('#centro-nome').fill('Operação industrial');
  await page.locator('#centro-motivo').fill('abre o centro');
  await page.getByRole('heading', { name: 'Dados principais' }).locator('..').getByRole('button', { name: '+ Novo registro' }).click();
  await expect(page.locator('#conta-centro option', { hasText: 'Operação industrial' })).toHaveCount(1);
}

async function preencherConta(
  page: Page,
  conta: { codigo: string; nome: string; classe: 'sintética' | 'analítica'; natureza: 'Ativo' | 'Passivo'; pai?: string },
  drawerAberto: boolean,
) {
  if (!drawerAberto) {
    await page.getByRole('button', { name: '+ Novo registro' }).first().click();
  }
  await page.locator('#conta-codigo').fill(conta.codigo);
  await page.getByPlaceholder('Informe conta contábil').fill(conta.nome);
  await page.locator('#conta-classe').selectOption({ label: conta.classe });
  await page.locator('#conta-natureza').selectOption({ label: conta.natureza });
  await page.locator('#conta-grupo').fill('Circulante');
  if (conta.pai) {
    await expect(page.locator('#conta-pai option', { hasText: conta.pai })).toHaveCount(1);
    await page.locator('#conta-pai').selectOption({ label: conta.pai });
  }
  await page.locator('#conta-centro').selectOption({ label: 'Operação industrial' });
  await page.locator('#conta-inicio').fill('2026-10-01');
  await page.locator('#review-justification').fill('abre a conta');
  await page.getByRole('heading', { name: 'Dados principais' }).locator('..').getByRole('button', { name: 'Criar' }).click();
  await expect(page.getByRole('cell', { name: conta.nome, exact: true })).toBeVisible();
}

async function revisarEAprovar(page: Page, nome: string) {
  await page.getByRole('cell', { name: nome, exact: true }).click();
  await page.getByRole('button', { name: 'Revisar competência' }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('revisa a competência');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('cell', { name: nome, exact: true }).click();
  await page.getByRole('button', { name: 'Aprovar' }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('aprova a conta');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByRole('row').filter({ hasText: nome }).getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
}

async function prepararContasPelaTelaDoPlano(page: Page) {
  await criarCentro(page);
  const contas: { codigo: string; nome: string; classe: 'sintética' | 'analítica'; natureza: 'Ativo' | 'Passivo'; pai?: string }[] = [
    { codigo: '1', nome: 'Grupo do ativo', classe: 'sintética', natureza: 'Ativo' },
    { codigo: '1.1.01', nome: 'Caixa e bancos', classe: 'analítica', natureza: 'Ativo', pai: 'Grupo do ativo' },
    { codigo: '2', nome: 'Grupo do passivo', classe: 'sintética', natureza: 'Passivo' },
    { codigo: '2.1.01', nome: 'Fornecedores', classe: 'analítica', natureza: 'Passivo', pai: 'Grupo do passivo' },
  ];
  for (const [indice, conta] of contas.entries()) {
    await preencherConta(page, conta, indice === 0);
    await revisarEAprovar(page, conta.nome);
  }
}

async function configurarPolitica(page: Page, competencia: string) {
  await page.getByRole('button', { name: 'Configurar mappings' }).click();
  const debito = page.getByLabel('Conta de débito', { exact: true });
  await expect(debito.locator('option', { hasText: 'Caixa e bancos' })).toHaveCount(1);
  await debito.selectOption({ label: 'Caixa e bancos' });
  await page.getByLabel('Conta de crédito', { exact: true }).selectOption({ label: 'Fornecedores' });
  await page.getByLabel('Centro de custo', { exact: true }).selectOption({ label: 'Operação industrial' });
  await page.getByLabel('Tipo de ocorrência', { exact: true }).selectOption({ label: 'Liquidação' });
  await page.getByLabel('Competência', { exact: true }).fill(competencia);
  await page.getByLabel('Início de vigência', { exact: true }).fill('2026-10-01');
  await page.getByLabel('Justificativa auditável', { exact: true }).fill('abre a regra');
  await page.getByRole('button', { name: 'Configurar mappings' }).last().click();
}

test('administrador configura, simula e outra pessoa aprova', async ({ browser, baseURL }) => {
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await expect(page).toHaveURL(/\/erp\/contabilidade\/politicas-de-contabilizacao$/);
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
  await expect(page.getByRole('heading', { name: 'Políticas de contabilização' })).toBeVisible();
  await expect(page.getByText('Provisório')).toBeVisible();
  await prepararContasPelaTelaDoPlano(page);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await configurarPolitica(page, '2026-10');
  await expect(page.getByRole('cell', { name: 'Liquidação', exact: true })).toBeVisible();
  await expect(page.getByText('LIQUIDACAO')).toHaveCount(0);
  await page.getByRole('button', { name: 'Simular evento' }).click();
  await page.getByLabel('Valor', { exact: true }).fill('10,10');
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('simula o evento');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.getByRole('button', { name: 'Aprovar regra' }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('o autor tenta aprovar');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page.getByText('aprovador diferente do autor', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Regras e validações' }).click();
  await expect(page.getByText('origem imutável, não lançar sem mapeamento correto, balanceamento exato')).toBeVisible();
  await page.getByRole('tab', { name: 'Exceções' }).click();
  await expect(page.getByText('Mapeamento ausente')).toBeVisible();
  await expect(page.getByText('Evento duplicado')).toBeVisible();
  await criarSegundoAdministrador(page);
  const outra = await browser.newContext({ baseURL });
  const paginaOutra = await outra.newPage();
  await login(paginaOutra, 'contador.provisorio@alphacarnes.local', 'senha-da-jornada', baseURL!);
  await paginaOutra.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await paginaOutra.getByRole('cell', { name: 'Liquidação', exact: true }).click();
  await paginaOutra.getByRole('button', { name: 'Aprovar regra' }).click();
  await paginaOutra.getByLabel('Justificativa / observação', { exact: true }).fill('outra pessoa aprova');
  await paginaOutra.getByRole('button', { name: 'Confirmar' }).click();
  await expect(paginaOutra.getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
  await expect(paginaOutra.getByText('concluído com evidência', { exact: true })).toBeVisible();
  await admin.close();
  await outra.close();
});

test('competência repetida mostra evento duplicado', async ({ browser, baseURL }) => {
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await configurarPolitica(page, '2026-11');
  await expect(page.getByRole('heading', { name: 'Dados principais' })).toBeHidden();
  await configurarPolitica(page, '2026-10');
  await expect(page.getByText('evento duplicado', { exact: true })).toBeVisible();
  await admin.close();
});
