import { readFile } from 'node:fs/promises';
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
  const gravada = page.waitForResponse((resposta) => resposta.request().method() === 'POST'
    && new URL(resposta.url()).pathname === '/api/contabilidade/politicas');
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
  // Só depois da resposta a tela recarrega a lista; digitar na busca antes disso corre contra a gravação.
  await gravada;
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
  await expect(page.getByText('Provisório').first()).toBeVisible();
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
  // O modal do DS bloqueia o fundo: fecha antes de trocar de aba.
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();

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
  // A busca volta do sessionStorage; digitar de novo antes da hidratação corre contra a restauração.
  await expect(paginaOutra.getByLabel('Buscar registros da lista')).toHaveValue(plano.debitoNome);
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

test('Exportar visão baixa o CSV com todas as linhas da visão, sem id e com a fórmula neutralizada', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api, true);
    await criarPoliticas(api, propria, 21);
  } finally {
    await api.dispose();
  }
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  const lista = page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/contabilidade/politicas' && url.searchParams.get('q') === propria.debitoNome;
  });
  await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
  expect((await lista).ok()).toBeTruthy();
  await expect(page.locator('.politicas-grade tbody tr')).toHaveCount(20);

  const baixando = page.waitForEvent('download');
  const exportacao = page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/contabilidade/politicas/exportar' && url.searchParams.get('q') === propria.debitoNome
      && !url.searchParams.has('pagina');
  });
  await page.getByRole('button', { name: 'Exportar visão' }).click();
  expect((await exportacao).headers()['content-type']).toContain('text/csv');
  const download = await baixando;
  expect(download.suggestedFilename()).toBe('politicas-de-contabilizacao.csv');
  const bytes = await readFile(await download.path());
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const linhas = bytes.toString('utf8').replace('\uFEFF', '').split('\n');
  expect(linhas).toHaveLength(22);
  expect(linhas[0]).toBe('Competência;Situação;Conta de débito;Conta de crédito;Centro de custo;Tipo de ocorrência');
  const texto = bytes.toString('utf8');
  expect(texto).not.toMatch(/LIQUIDACAO-|[0-9a-f]{8}-[0-9a-f]{4}-/);
  expect(texto).toContain(`;'${propria.debitoNome};`);
  expect(texto).not.toContain(`;${propria.debitoNome};`);
  await admin.close();
});

test('a 760px cada política vira um cartão e a 1280px segue em tabela, com contagem, seleção e ações', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api);
    await criarPoliticas(api, propria, 3);
  } finally {
    await api.dispose();
  }
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
  // A mesma tela redimensionada: a media query troca a tabela pelos cartões sem recarregar.
  for (const largura of [1280, 760]) {
    await page.setViewportSize({ width: largura, height: 900 });
    const linhas = page.locator('.politicas-grade tbody tr');
    await expect(linhas).toHaveCount(3);
    await expect(linhas.first()).toBeVisible();
    await expect(page.getByText('Exibindo 3 de 3', { exact: true })).toBeVisible();
    const estilo = await linhas.first().evaluate((tr) => ({
      display: getComputedStyle(tr).display,
      rotulo: getComputedStyle(tr.querySelector('td[data-rotulo]')!, '::before').content,
      largura: tr.getBoundingClientRect().width,
    }));
    if (largura === 760) {
      expect(estilo.display).toBe('grid');
      expect(estilo.rotulo).toBe('"Competência"');
      expect(estilo.largura).toBeLessThan(760);
      await expect(page.locator('.politicas-grade thead')).toBeHidden();
    } else {
      expect(estilo.display).toBe('table-row');
      await expect(page.getByRole('columnheader', { name: 'Situação', exact: true })).toBeVisible();
    }
    const caixa = linhas.first().getByRole('checkbox');
    await expect(caixa).toBeVisible();
    await caixa.check();
    await expect(caixa).toBeChecked();
    for (const nome of ['+ Novo registro', 'Ações do processo', 'Simular evento', 'Aprovar regra']) {
      await expect(page.getByRole('button', { name: nome, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Exigem decisão humana', { exact: true })).toBeVisible();
    await expect(page.getByText('Não gerar sucesso falso', { exact: true })).toBeVisible();
  }
  await admin.close();
});

test('Pesquisar abre o lookup das contas e do centro e a escolha preenche o formulário', async ({ browser, baseURL }) => {
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
  await expect(page.getByLabel('Conta de débito', { exact: true }).locator('option', { hasText: plano.debitoNome })).toHaveCount(1);
  await expect(page.getByText('Seleção vinculada ao cadastro; sem digitar identificadores.', { exact: true })).toHaveCount(3);
  for (const [rotulo, nome] of [['Conta de débito', plano.debitoNome], ['Conta de crédito', plano.creditoNome], ['Centro de custo', plano.centroNome]] as const) {
    const botao = page.getByRole('button', { name: `Pesquisar ${rotulo.toLowerCase()}`, exact: true });
    await botao.click();
    const lookup = page.getByRole('dialog', { name: `Selecionar ${rotulo}`, exact: true });
    await expect(lookup).toBeVisible();
    await lookup.getByLabel('Pesquisar cadastro', { exact: true }).fill(nome);
    await lookup.getByRole('button', { name: new RegExp(nome) }).click();
    await expect(lookup).toBeHidden();
    await expect(page.getByLabel(rotulo, { exact: true }).locator('option:checked')).toHaveText(nome);
    await expect(botao).toBeFocused();
  }
  await page.getByRole('button', { name: 'Pesquisar conta de débito', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Selecionar Conta de débito', exact: true })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Dados principais' })).toBeVisible();
  await admin.close();
});

test('com a busca da lista preenchida, a escolha do lookup aparece no select e é o código enviado (1280 e 760px)', async ({ browser, baseURL }) => {
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  for (const largura of [1280, 760]) {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
    await page.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
    await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
    const credito = page.getByLabel('Conta de crédito', { exact: true });
    // O select lista o cadastro completo: a busca da lista ("Caixa e bancos…") não esconde a conta de crédito.
    await expect(credito.locator('option', { hasText: plano.creditoNome })).toHaveCount(1);
    for (const [rotulo, nome] of [['Conta de débito', plano.debitoNome], ['Conta de crédito', plano.creditoNome], ['Centro de custo', plano.centroNome]] as const) {
      await page.getByRole('button', { name: `Pesquisar ${rotulo.toLowerCase()}`, exact: true }).click();
      const lookup = page.getByRole('dialog', { name: `Selecionar ${rotulo}`, exact: true });
      await lookup.getByLabel('Pesquisar cadastro', { exact: true }).fill(nome);
      const opcao = lookup.getByRole('button', { name: new RegExp(nome) });
      await expect(opcao).toContainText('Cadastro ativo');
      await opcao.click();
      await expect(page.getByLabel(rotulo, { exact: true }).locator('option:checked')).toHaveText(nome);
    }
    await page.getByLabel('Tipo de ocorrência', { exact: true }).selectOption({ label: 'Liquidação' });
    await page.getByLabel('Competência', { exact: true }).fill(competenciaUnica());
    await page.getByLabel('Início de vigência', { exact: true }).fill(ONTEM);
    await page.getByLabel('Justificativa auditável', { exact: true }).fill('escolhe pelo lookup');
    const gravada = page.waitForRequest((pedido) => pedido.method() === 'POST' && new URL(pedido.url()).pathname === '/api/contabilidade/politicas');
    await page.getByRole('button', { name: 'Configurar mappings' }).last().click();
    const corpo = (await gravada).postDataJSON() as Record<string, string>;
    expect(corpo.contaDebitoCodigo).toBe(`A${plano.sufixo}.1`);
    expect(corpo.contaCreditoCodigo).toBe(`P${plano.sufixo}.1`);
    expect(corpo.centroCodigo).toBe(plano.centroCodigo);
    await expect(page.getByRole('heading', { name: 'Dados principais' })).toBeHidden();
  }
  await admin.close();
});

test('a 760px o seletor "Ordenar por" substitui o cabeçalho e recarrega a lista; a 1280px fica oculto', async ({ browser, baseURL }) => {
  const admin = await browser.newContext({ baseURL });
  const page = await admin.newPage();
  await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
  const ordenarPor = page.getByRole('combobox', { name: 'Ordenar por', exact: true });
  const direcao = page.getByRole('combobox', { name: 'Direção da ordenação', exact: true });
  await expect(ordenarPor).toBeHidden();
  // A busca só consulta depois da hidratação: com a resposta, o select já tem o handler do React.
  const hidratada = page.waitForResponse((resposta) => new URL(resposta.url()).searchParams.get('q') === plano.debitoNome);
  await page.getByLabel('Buscar registros da lista').fill(plano.debitoNome);
  expect((await hidratada).ok()).toBeTruthy();
  await page.setViewportSize({ width: 760, height: 900 });
  await expect(ordenarPor).toBeVisible();
  await expect(direcao).toBeVisible();
  const lista = (ordenar: string, sentido: string) => page.waitForResponse((resposta) => {
    const url = new URL(resposta.url());
    return url.pathname === '/api/contabilidade/politicas' && url.searchParams.get('ordenar') === ordenar && url.searchParams.get('direcao') === sentido;
  });
  const porDebito = lista('contaDebito', 'asc');
  await ordenarPor.selectOption({ label: 'Conta de débito' });
  expect((await porDebito).ok()).toBeTruthy();
  const invertida = lista('contaDebito', 'desc');
  await direcao.selectOption({ label: 'Decrescente' });
  expect((await invertida).ok()).toBeTruthy();
  await expect(page.getByText(/Ordenação por coluna/)).toBeVisible();
  await admin.close();
});

test('duplo clique em Configurar mappings e em Editar versão grava uma vez; em voo Voltar e Escape não fecham o drawer', async ({ browser, baseURL, playwright }) => {
  const api = await playwright.request.newContext();
  let propria: PlanoDaJornada;
  try {
    propria = await criarPlanoDaJornada(api);
  } finally {
    await api.dispose();
  }
  const competencia = competenciaUnica();
  const codigo = `LIQUIDACAO-${competencia}`;
  const admin = await browser.newContext({ baseURL });
  try {
    const page = await admin.newPage();
    await login(page, ADMIN_EMAIL, senhaAdmin, baseURL!);
    const posts: string[] = [];
    page.on('request', (pedido) => {
      if (pedido.method() === 'POST') posts.push(new URL(pedido.url()).pathname);
    });
    // Resposta adiada: o envio fica em voo enquanto os cliques extras chegam.
    const adiar = async (rota: import('@playwright/test').Route) => {
      if (rota.request().method() === 'POST') await new Promise((pronto) => setTimeout(pronto, 1500));
      await rota.continue();
    };
    await page.route('**/api/contabilidade/politicas', adiar);
    await page.route('**/api/contabilidade/politicas/*/editar', adiar);
        const historico = async () => {
      const resposta = await page.request.get(`/api/contabilidade/politicas/${codigo}/historico`);
      expect(resposta.ok(), `GET historico: ${resposta.status()}`).toBeTruthy();
      return (await resposta.json() as unknown[]).length;
    };

    await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
    const hidratada = page.waitForResponse((resposta) => new URL(resposta.url()).searchParams.get('q') === propria.debitoNome);
    await page.getByLabel('Buscar registros da lista').fill(propria.debitoNome);
    expect((await hidratada).ok()).toBeTruthy();

    await page.getByRole('button', { name: 'Configurar mappings' }).first().click();
    const debito = page.getByLabel('Conta de débito', { exact: true });
    await expect(debito.locator('option', { hasText: propria.debitoNome })).toHaveCount(1);
    await debito.selectOption({ label: propria.debitoNome });
    await page.getByLabel('Conta de crédito', { exact: true }).selectOption({ label: propria.creditoNome });
    await page.getByLabel('Centro de custo', { exact: true }).selectOption({ label: propria.centroNome });
    await page.getByLabel('Tipo de ocorrência', { exact: true }).selectOption({ label: 'Liquidação' });
    await page.getByLabel('Competência', { exact: true }).fill(competencia);
    await page.getByLabel('Início de vigência', { exact: true }).fill(ONTEM);
    await page.getByLabel('Justificativa auditável', { exact: true }).fill('abre a regra');
    const dadosPrincipais = page.getByRole('heading', { name: 'Dados principais' });
    const gravar = page.getByRole('button', { name: 'Configurar mappings' }).last();
    await gravar.dblclick();
    await expect(gravar).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Voltar', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dadosPrincipais).toBeVisible();
    await expect(dadosPrincipais).toBeHidden({ timeout: 15_000 });
    await expect(page.getByRole('cell', { name: 'Liquidação', exact: true })).toHaveCount(1);
    await expect(page.getByText('evento duplicado', { exact: true })).toHaveCount(0);
    expect(posts.filter((caminho) => caminho === '/api/contabilidade/politicas')).toHaveLength(1);
    const auditoriasAntes = await historico();

    await page.getByRole('cell', { name: 'Liquidação', exact: true }).click();
    await page.getByRole('button', { name: 'Editar versão', exact: true }).click();
    await page.getByLabel('Justificativa auditável', { exact: true }).fill('ajusta a versão');
    await gravar.dblclick();
    await expect(gravar).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dadosPrincipais).toBeVisible();
    await expect(dadosPrincipais).toBeHidden({ timeout: 15_000 });
    expect(posts.filter((caminho) => caminho === `/api/contabilidade/politicas/${codigo}/editar`)).toHaveLength(1);
    expect(await historico()).toBe(auditoriasAntes + 1);
  } finally {
    await admin.close();
  }
});
