import { expect, test, type Page } from '@playwright/test';
import { competenciaUnica, criarPlanoDaJornada, criarPoliticas, type PlanoDaJornada } from './helpers/e09-t02-seed';
import { ADMIN_EMAIL, loginBackend } from './helpers/onda6-seed';

const SENHA_DA_JORNADA = 'senha-da-jornada';

test.describe.configure({ mode: 'serial', timeout: 600_000 });

let plano: PlanoDaJornada;
let senhaAdmin: string;

test.beforeAll(async ({ playwright }) => {
  const api = await playwright.request.newContext();
  try {
    // Mesmo e-mail e mesma lista de senhas do seed: a senha que o backend aceitou é a que a tela usa.
    senhaAdmin = (await loginBackend(api)).password;
    plano = await criarPlanoDaJornada(api);
  } finally {
    await api.dispose();
  }
});

const ONTEM = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

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
      const [nomeValor] = header.value.split(';');
      const igual = nomeValor.indexOf('=');
      return { name: nomeValor.slice(0, igual), value: nomeValor.slice(igual + 1), url: baseURL };
    });
  await page.context().addCookies(cookies);
}

interface ItemApi { codigo: string; situacao: string; aprovadorNome: string | null; simulacaoValor: string | null }

async function politicaPelaApi(page: Page, competencia: string): Promise<ItemApi | undefined> {
  const resposta = await page.request.get(`/api/contabilidade/politicas?pagina=1&q=${encodeURIComponent(plano.debitoNome)}`);
  expect(resposta.ok(), `GET politicas: ${resposta.status()}`).toBeTruthy();
  const corpo = await resposta.json() as { itens: ItemApi[] };
  return corpo.itens.find((item) => item.codigo === `LIQUIDACAO-${competencia}`);
}

function postDaAcao(page: Page, acao: 'simular' | 'aprovar') {
  return page.waitForResponse((resposta) => resposta.request().method() === 'POST'
    && new RegExp(`/api/contabilidade/politicas/[^/]+/${acao}$`).test(new URL(resposta.url()).pathname));
}

async function configurarPolitica(page: Page, competencia: string) {
  await page.getByRole('button', { name: 'Configurar mappings' }).first().click();
  const debito = page.getByLabel('Conta de débito', { exact: true });
  await expect(debito.locator('option', { hasText: plano.debitoNome })).toHaveCount(1);
  await debito.selectOption({ label: plano.debitoNome });
  await page.getByLabel('Conta de crédito', { exact: true }).selectOption({ label: plano.creditoNome });
  await page.getByLabel('Centro de custo', { exact: true }).selectOption({ label: plano.centroNome });
  await page.getByLabel('Tipo de ocorrência', { exact: true }).selectOption({ label: 'Liquidação' });
  await page.getByLabel('Competência', { exact: true }).fill(competencia);
  await page.getByLabel('Início de vigência', { exact: true }).fill(ONTEM);
  await page.getByLabel('Justificativa auditável', { exact: true }).fill('abre a regra');
  await page.getByRole('button', { name: 'Configurar mappings' }).last().click();
}

test('administrador configura, simula e outra pessoa aprova', async ({ browser, baseURL }) => {
  const competencia = competenciaUnica();
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);

  // O seed foi feito direto no backend; o BFF da tela precisa enxergar o mesmo sistema.
  const opcoes = await page.request.get('/api/contabilidade/politicas/opcoes');
  expect(opcoes.ok()).toBeTruthy();
  expect(JSON.stringify(await opcoes.json()), 'a tela e o seed falam com backends diferentes').toContain(plano.debitoNome);

  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await expect(page).not.toHaveURL(/e\d{2}-t\d{2}/i);
  await expect(page.getByRole('heading', { name: 'Políticas de contabilização' })).toBeVisible();
  await expect(page.getByText('Provisório')).toBeVisible();
  await configurarPolitica(page, competencia);
  // O banco acumula políticas de outras execuções: a busca isola as linhas desta jornada.
  await page.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  await expect(page.getByRole('cell', { name: 'Liquidação', exact: true })).toHaveCount(1);
  await expect(page.getByRole('cell', { name: 'Liquidação', exact: true })).toBeVisible();
  await expect(page.getByText('LIQUIDACAO')).toHaveCount(0);

  const simulada = postDaAcao(page, 'simular');
  await page.getByRole('button', { name: 'Simular evento' }).click();
  await page.getByLabel('Valor', { exact: true }).fill('10,10');
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('simula o evento');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  expect((await simulada).ok()).toBeTruthy();
  expect((await politicaPelaApi(page, competencia))?.simulacaoValor).toBe('10.10');

  const negada = postDaAcao(page, 'aprovar');
  await page.getByRole('button', { name: 'Aprovar regra' }).click();
  await page.getByLabel('Justificativa / observação', { exact: true }).fill('o autor tenta aprovar');
  await page.getByRole('button', { name: 'Confirmar' }).click();
  expect((await negada).status()).toBe(422);
  await expect(page.getByText('aprovador diferente do autor', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Aprovado', exact: true })).toHaveCount(0);
  await expect(page.getByText('concluído com evidência', { exact: true })).toHaveCount(0);
  expect((await politicaPelaApi(page, competencia))?.situacao).toBe('DRAFT');

  await page.getByRole('tab', { name: 'Regras e validações' }).click();
  await expect(page.getByText('origem imutável, não lançar sem mapeamento correto, balanceamento exato')).toBeVisible();
  await page.getByRole('tab', { name: 'Exceções' }).click();
  await expect(page.locator('p', { hasText: /^Bloqueio \/ exceção: Mapeamento ausente\.$/ })).toHaveCount(1);
  await expect(page.locator('p', { hasText: /^Bloqueio \/ exceção: Evento duplicado\.$/ })).toHaveCount(1);

  const emailOutra = `contador.${plano.sufixo}@alphacarnes.local`;
  const criado = await page.request.post('/api/admin/usuarios', {
    data: { nome: 'Contador provisório', email: emailOutra, password: SENHA_DA_JORNADA, perfis: ['administrador'] },
  });
  expect(criado.ok(), `criar administrador: ${criado.status()}`).toBeTruthy();
  const outra = await browser.newContext({ baseURL });
  const paginaOutra = await outra.newPage();
  await login(paginaOutra, emailOutra, SENHA_DA_JORNADA, baseURL!);
  await paginaOutra.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await paginaOutra.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  await expect(paginaOutra.getByRole('cell', { name: 'Liquidação', exact: true })).toHaveCount(1);
  await paginaOutra.getByRole('cell', { name: 'Liquidação', exact: true }).click();
  const aprovada = postDaAcao(paginaOutra, 'aprovar');
  await paginaOutra.getByRole('button', { name: 'Aprovar regra' }).click();
  await paginaOutra.getByLabel('Justificativa / observação', { exact: true }).fill('outra pessoa aprova');
  await paginaOutra.getByRole('button', { name: 'Confirmar' }).click();
  expect((await aprovada).ok()).toBeTruthy();
  await expect(paginaOutra.getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
  await expect(paginaOutra.getByText('concluído com evidência', { exact: true })).toBeVisible();
  const confirmada = await politicaPelaApi(paginaOutra, competencia);
  expect(confirmada?.situacao).toBe('APPROVED');
  expect(confirmada?.aprovadorNome).toBe('Contador provisório');
  await paginaOutra.reload();
  await paginaOutra.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  await expect(paginaOutra.getByRole('cell', { name: 'Liquidação', exact: true })).toHaveCount(1);
  await expect(paginaOutra.getByRole('cell', { name: 'Aprovado', exact: true })).toBeVisible();
  await admin.close();
  await outra.close();
});

test('competência repetida mostra evento duplicado e não grava a segunda', async ({ browser, baseURL }) => {
  const competencia = competenciaUnica();
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await configurarPolitica(page, competencia);
  await expect(page.getByRole('heading', { name: 'Dados principais' })).toBeHidden();
  await configurarPolitica(page, competencia);
  await expect(page.getByText('evento duplicado', { exact: true })).toBeVisible();
  expect((await politicaPelaApi(page, competencia))?.codigo).toBe(`LIQUIDACAO-${competencia}`);
  await admin.close();
});

test('com mais de 20 políticas a página 2 é alcançada pela tela e a posição sobrevive ao reload', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api);
    await criarPoliticas(api, propria, 21);
  } finally {
    await api.dispose();
  }
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  const linhas = page.locator('.politicas-grade tbody tr');
  const listaDaBusca = (pagina: string) => page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return resposta.request().method() === 'GET' && url.pathname === '/api/contabilidade/politicas'
      && url.searchParams.get('pagina') === pagina && url.searchParams.get('q') === propria.debitoNome;
  });
  const primeira = listaDaBusca('1');
  await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
  expect((await primeira).ok()).toBeTruthy();
  await expect(linhas).toHaveCount(20);
  await expect(page.getByText('Página 1 de 2', { exact: true })).toBeVisible();
  await expect(page.getByText('Exibindo 20 de 21', { exact: true })).toBeVisible();

  const segunda = listaDaBusca('2');
  await page.getByRole('link', { name: 'Próxima página' }).click();
  expect((await segunda).ok()).toBeTruthy();
  await expect(linhas).toHaveCount(1);
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText('Página 2 de 2', { exact: true })).toBeVisible();
  await expect(linhas).toHaveCount(1);
  await admin.close();
});
