/**
 * E01-T01 — Empresas, estabelecimentos e regime (/fiscal/empresas): jornada de aprovação com dois
 * administradores, autorização por perfil e acessibilidade. Dois contextos de navegador = dois
 * usuários; o seed (usuários e estabelecimentos de apoio) vai pela API do backend.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import {
  criarEstabelecimentoApi,
  entrarNoFrontend,
  gerarIdentificadores,
  loginApi,
  prepararUsuarios,
  type UsuarioE2e,
} from './helpers/e01-t01-seed';

const TITULO = 'Empresas, estabelecimentos e regime';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar empresas e estabelecimentos.';
const SEGREGACAO = 'A aprovação deve ser feita por usuário diferente de quem submeteu.';
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const CODIGO_DE_TASK = /E\d{2}-T\d{2}/;
const DESC_PRINCIPAL = 'Desenvolvimento de programas de computador sob encomenda';
const DESC_SECUNDARIA = 'Desenvolvimento e licenciamento de programas customizáveis';
const DESC_NOVA = 'Tratamento de dados, provedores de serviços de aplicação';

/** Data civil do navegador (o mesmo critério dos botões "Hoje"/"Ontem" do seletor de data). */
function dataLocal(deslocamentoDias: number): { iso: string; br: string } {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return { iso: `${d.getFullYear()}-${mm}-${dd}`, br: `${dd}/${mm}/${d.getFullYear()}` };
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaEmpresas(page: Page): Promise<void> {
  await page.goto('/fiscal/empresas');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 30_000 });
}

/**
 * Filtra pela busca (o nome é único na rodada) até restar só a linha esperada. A tela restaura a
 * busca salva da sessão logo após hidratar; repetir o preenchimento evita disputa com essa restauração.
 */
async function filtrarPor(page: Page, nome: string): Promise<void> {
  const busca = page.getByRole('searchbox', { name: 'Buscar registros da lista' });
  await expect(async () => {
    await busca.fill(nome);
    await expect(busca).toHaveValue(nome, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  // Cabeçalho + a linha do estabelecimento.
  await expect(page.getByRole('row')).toHaveCount(2);
  await expect(page.getByRole('row', { name: new RegExp(nome) })).toBeVisible();
}

/** Filtra pelo nome e seleciona o estabelecimento na grade. */
async function selecionarEstabelecimento(page: Page, nome: string): Promise<void> {
  await filtrarPor(page, nome);
  await page.getByRole('row', { name: new RegExp(nome) }).click();
  await expect(page.getByRole('heading', { name: nome, level: 2, exact: true })).toBeVisible();
}

/**
 * Recarrega a tela e seleciona o estabelecimento outra vez: a ficha de cada usuário reflete o que o
 * outro decidiu sem depender do canal de tempo real (coberto à parte, com outro host de cookie).
 */
async function reabrir(page: Page, nome: string, aba: string): Promise<void> {
  await irParaEmpresas(page);
  await selecionarEstabelecimento(page, nome);
  await abrirAba(page, aba);
}

const detalhe = (page: Page): Locator => page.getByRole('region', { name: 'Detalhamento' });

async function abrirAba(page: Page, aba: string): Promise<void> {
  await page.getByRole('tab', { name: aba }).click();
}

/** Diálogo de decisão: justificativa + confirmação; sem `mensagemErro` espera o diálogo fechar. */
async function decidir(page: Page, rotuloConfirmar: string): Promise<void> {
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Justificativa').fill('Decisão registrada pelo teste E2E.');
  await dialogo.getByRole('button', { name: rotuloConfirmar, exact: true }).click();
}

async function decidirEEsperarFechar(page: Page, rotuloConfirmar: string): Promise<void> {
  await decidir(page, rotuloConfirmar);
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function preencherAtividade(escopo: Locator, indice: number, codigo: string, descricao: string): Promise<void> {
  await escopo.locator(`#cnae-codigo-${indice}`).fill(codigo);
  await escopo.locator(`#cnae-descricao-${indice}`).fill(descricao);
}

/** Proposta de alteração do estabelecimento aprovado: novo nome e uma atividade secundária a mais. */
async function proporAlteracao(page: Page, novoNome: string, codigoCnae: string): Promise<void> {
  await abrirAba(page, 'Ficha e campos');
  await page.getByRole('button', { name: 'Editar versão' }).click();
  const drawer = page.getByRole('dialog', { name: 'Alteração do estabelecimento' });
  await drawer.locator('#fiscal-nome').fill(novoNome);
  await drawer.getByRole('button', { name: 'Adicionar atividade' }).click();
  await preencherAtividade(drawer, 2, codigoCnae, DESC_NOVA);
  await drawer.locator('#alteracao-motivo').fill('Alteração de nome e atividade, E2E.');
  await drawer.getByRole('button', { name: 'Submeter para revisão' }).click();
  // Com next dev frio, a primeira submissão compila rotas antes de fechar o drawer: só este passo ganha folga.
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

async function expectSemIdentificadoresTecnicos(page: Page): Promise<void> {
  const texto = await page.locator('body').innerText();
  expect(texto).not.toMatch(UUID);
  expect(texto).not.toMatch(CODIGO_DE_TASK);
}

/** Nenhum textbox/combobox/button visível sem nome acessível (snapshot de acessibilidade do escopo). */
async function expectControlesComNome(escopo: Locator): Promise<void> {
  const snapshot = await escopo.ariaSnapshot();
  const semNome = snapshot
    .split('\n')
    .filter((linha) => /^\s*- (textbox|combobox|button|searchbox)(\s+\[[^\]]*\])*\s*(:.*)?$/.test(linha));
  expect(semNome, `controles sem nome acessível:\n${semNome.join('\n')}`).toEqual([]);
}

test.describe('E01-T01 Empresas, estabelecimentos e regime', () => {
  // Falha rápida: uma ação travada não pode consumir os 10 minutos do teste.
  test.use({ actionTimeout: 15_000 });
  test.setTimeout(180_000);

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
      for (const rota of ['/gestao/dashboard', '/fiscal/empresas']) {
        await page.goto(rota, { timeout: 120_000 });
        await page.waitForLoadState('networkidle', { timeout: 120_000 });
      }
    } finally {
      await context.close();
    }
  });

  test('jornada: cadastro, regimes por vigência, alteração aprovada e rejeitada', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const ident = gerarIdentificadores('Jornada');
    const nomeNovo = `${ident.nome} Renomeada`;
    const nomeFinal = `${ident.nome} Final`;
    const ontem = dataLocal(-1);
    const hoje = dataLocal(0);

    const a = await abrirComo(browser, baseURL!, usuarios.adminA);
    const b = await abrirComo(browser, baseURL!, usuarios.adminB);

    // Menu FISCAL → tela.
    await a.goto('/gestao/dashboard');
    const aside = a.getByRole('complementary', { name: 'Navegação principal' });
    const grupo = aside.getByRole('button', { name: /FISCAL/ });
    if ((await grupo.getAttribute('aria-expanded')) !== 'true') await grupo.click();
    // O dashboard acrescenta ?operacaoId= após hidratar; um clique anterior a isso é descartado.
    await expect(async () => {
      await aside.getByRole('link', { name: TITULO }).click();
      await expect(a).toHaveURL(/\/fiscal\/empresas$/, { timeout: 5_000 });
    }).toPass({ timeout: 30_000 });
    await expect(a.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();

    // Nova empresa (diálogo aninhado no drawer) e estabelecimento com dois CNAEs.
    await a.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = a.getByRole('dialog', { name: TITULO });
    await drawer.getByRole('button', { name: 'Nova empresa' }).click();
    const dialogoEmpresa = a.getByRole('dialog', { name: 'Nova empresa' });
    await dialogoEmpresa.getByLabel('Razão social').fill(ident.razaoSocial);
    await dialogoEmpresa.getByLabel('CNPJ raiz').fill(ident.cnpj.slice(0, 8));
    await dialogoEmpresa.getByLabel('Motivo da alteração').fill('Cadastro inicial da empresa, E2E.');
    await dialogoEmpresa.getByRole('button', { name: 'Cadastrar empresa' }).click();
    await expect(dialogoEmpresa).toBeHidden();
    await expect(drawer.getByRole('combobox', { name: /^Empresa/ })).toContainText(ident.razaoSocial);

    await drawer.locator('#fiscal-cnpj').fill(ident.cnpj);
    await drawer.locator('#fiscal-nome').fill(ident.nome);
    await drawer.locator('#fiscal-ie').fill(ident.inscricaoEstadual);
    await drawer.locator('#fiscal-im').fill(ident.inscricaoMunicipal);
    await drawer.locator('#fiscal-uf').selectOption('SP');
    await expect(drawer.locator('#fiscal-municipio')).toBeDisabled();
    await expect(drawer.locator('#fiscal-certificado')).toBeDisabled();
    await expect(drawer.getByText('Provisório', { exact: true })).toHaveCount(2);
    await drawer.getByRole('button', { name: 'Adicionar atividade' }).click();
    await preencherAtividade(drawer, 0, '6201501', DESC_PRINCIPAL);
    await drawer.getByRole('button', { name: 'Adicionar atividade' }).click();
    await preencherAtividade(drawer, 1, '6202300', DESC_SECUNDARIA);
    await expect(drawer.locator('#cnae-codigo-0')).toHaveValue('6201-5/01');
    await expect(drawer.locator('#cnae-codigo-1')).toHaveValue('6202-3/00');
    await drawer.locator('#fiscal-motivo').fill('Cadastro inicial do estabelecimento, E2E.');
    await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(drawer).toBeHidden();

    // Ficha: dados, CNAEs, campos provisórios.
    await expect(a.getByRole('heading', { name: ident.nome, level: 2, exact: true })).toBeVisible();
    const ficha = detalhe(a);
    await expect(ficha).toContainText('6201-5/01');
    await expect(ficha).toContainText('6202-3/00');
    for (const campo of ['Município', 'Certificado vinculado']) {
      await expect(ficha.locator('div', { has: a.getByText(campo, { exact: true }) }).last()).toContainText('Provisório');
    }

    // A submete; B aprova.
    await abrirAba(a, 'Movimentações');
    await a.getByRole('button', { name: 'Enviar para revisão', exact: true }).click();
    await decidirEEsperarFechar(a, 'Enviar para revisão');
    await expect(ficha).toContainText('Aguardando revisão');

    await reabrir(b, ident.nome, 'Movimentações');
    await b.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await decidirEEsperarFechar(b, 'Aprovar');
    await expect(detalhe(b)).toContainText('Aprovado');
    await reabrir(a, ident.nome, 'Movimentações');
    await expect(ficha).toContainText('Aprovado');

    // Regime CRT 3 (início ontem): A cria e submete, B aprova.
    await a.getByRole('button', { name: 'Nova versão' }).click();
    const dialogoRegime = a.getByRole('dialog', { name: 'Nova versão de regime' });
    await dialogoRegime.locator('#regime-crt').selectOption('3');
    await dialogoRegime.locator('#regime-inicio').click();
    await a.getByRole('button', { name: 'Ontem' }).click();
    await dialogoRegime.getByLabel('Motivo da alteração').fill('Regime normal desde ontem, E2E.');
    await dialogoRegime.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(dialogoRegime).toBeHidden();
    await a.getByRole('button', { name: /^Submeter regime Regime normal/ }).click();
    await decidirEEsperarFechar(a, 'Enviar para revisão');

    await reabrir(b, ident.nome, 'Movimentações');
    await b.getByRole('button', { name: /^Aprovar regime Regime normal/ }).click();
    await decidirEEsperarFechar(b, 'Aprovar');
    const linhaAnterior = detalhe(b).getByRole('row', { name: /Regime normal/ });
    await expect(linhaAnterior).toContainText('Aprovado');
    await expect(linhaAnterior.getByRole('cell').nth(2)).toHaveText('Sem fim');

    // Nova versão (início hoje) com troca confirmada; ao aprovar, a anterior termina em D−1.
    // A reabre a ficha: com next dev frio, as compilações disparadas por B recarregam a página de A
    // e a seleção (só em memória) se perde.
    await reabrir(a, ident.nome, 'Movimentações');
    await a.getByRole('button', { name: 'Nova versão' }).click();
    await dialogoRegime.locator('#regime-crt').selectOption('1');
    await dialogoRegime.locator('#regime-inicio').click();
    await a.getByRole('button', { name: 'Hoje' }).click();
    await dialogoRegime.getByLabel('Motivo da alteração').fill('Migração para o Simples Nacional, E2E.');
    await dialogoRegime.getByRole('button', { name: 'Salvar rascunho' }).click();
    await expect(dialogoRegime).toBeHidden();
    await a.getByRole('button', { name: /^Submeter regime Simples Nacional/ }).click();
    await decidir(a, 'Enviar para revisão');
    const troca = a.getByRole('alertdialog', { name: 'Troca de regime tributário' });
    await expect(troca).toContainText(`Encerrar o regime atual em ${ontem.br}`);
    await troca.getByRole('button', { name: 'Encerrar e submeter' }).click();
    await expect(a.getByRole('dialog')).toHaveCount(0);

    await reabrir(b, ident.nome, 'Movimentações');
    await b.getByRole('button', { name: /^Aprovar regime Simples Nacional/ }).click();
    await decidirEEsperarFechar(b, 'Aprovar');
    await expect(detalhe(b).getByRole('row', { name: /Regime normal/ }).getByRole('cell').nth(2)).toHaveText(ontem.br);
    await expect(detalhe(b).getByRole('row', { name: /Simples Nacional/ }).getByRole('cell').nth(1)).toHaveText(hoje.br);
    await reabrir(a, ident.nome, 'Movimentações');
    await expect(detalhe(a).getByRole('row', { name: /Regime normal/ }).getByRole('cell').nth(2)).toHaveText(ontem.br);

    // Alteração 1: A propõe (nome + CNAE secundário); a ficha mostra o aprovado e a proposta.
    await proporAlteracao(a, nomeNovo, '6311900');
    await abrirAba(a, 'Ficha e campos');
    const pendente = a.getByRole('region', { name: 'Alteração aguardando revisão' });
    await expect(pendente).toBeVisible();
    // Linha "Campo | Aprovado | Proposto": o aprovado segue com o nome antigo.
    await expect(pendente.getByRole('row', { name: new RegExp(`^Estabelecimento ${ident.nome} ${nomeNovo}$`) })).toBeVisible();
    await expect(pendente).toContainText('6311-9/00');
    await expect(a.getByRole('heading', { name: ident.nome, level: 2, exact: true })).toBeVisible();

    // O mesmo usuário que submeteu não aprova: mensagem de segregação.
    await abrirAba(a, 'Movimentações');
    await a.getByRole('button', { name: 'Aprovar alteração' }).click();
    await decidir(a, 'Aprovar alteração');
    await expect(a.getByRole('dialog').getByRole('alert')).toContainText(SEGREGACAO);
    await a.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await expect(a.getByRole('dialog')).toHaveCount(0);

    // B rejeita: a ficha continua com os valores aprovados.
    await reabrir(b, ident.nome, 'Ficha e campos');
    await expect(b.getByRole('region', { name: 'Alteração aguardando revisão' })).toBeVisible();
    await abrirAba(b, 'Movimentações');
    await b.getByRole('button', { name: 'Rejeitar alteração' }).click();
    await decidirEEsperarFechar(b, 'Rejeitar alteração');
    await abrirAba(b, 'Ficha e campos');
    await expect(b.getByRole('region', { name: 'Alteração aguardando revisão' })).toHaveCount(0);
    await expect(b.getByRole('heading', { name: ident.nome, level: 2, exact: true })).toBeVisible();
    await expect(detalhe(b)).not.toContainText(nomeNovo);
    await expect(detalhe(b)).not.toContainText('6311-9/00');

    // Alteração 2: aprovada por B; a ficha passa a mostrar os valores novos.
    await reabrir(a, ident.nome, 'Ficha e campos');
    await expect(a.getByRole('region', { name: 'Alteração aguardando revisão' })).toHaveCount(0);
    await proporAlteracao(a, nomeFinal, '6311900');
    await reabrir(b, ident.nome, 'Movimentações');
    await b.getByRole('button', { name: 'Aprovar alteração' }).click();
    await decidirEEsperarFechar(b, 'Aprovar alteração');
    await abrirAba(b, 'Ficha e campos');
    await expect(b.getByRole('heading', { name: nomeFinal, level: 2, exact: true })).toBeVisible();
    await expect(detalhe(b)).toContainText('6311-9/00');
    await expect(b.getByRole('region', { name: 'Alteração aguardando revisão' })).toHaveCount(0);
    await reabrir(a, nomeFinal, 'Ficha e campos');
    await expect(detalhe(a)).toContainText('6311-9/00');

    await expectSemIdentificadoresTecnicos(a);
    await expectSemIdentificadoresTecnicos(b);
  });

  test('autorização: gestor não vê o grupo FISCAL e a tela nega o acesso', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const gestor = await abrirComo(browser, baseURL!, usuarios.gestor);

    await gestor.goto('/fiscal/empresas');
    await expect(gestor.getByText(SEM_PERMISSAO)).toBeVisible({ timeout: 30_000 });
    const aside = gestor.getByRole('complementary', { name: 'Navegação principal' });
    await expect(aside.locator('button[aria-expanded]').first()).toBeVisible();
    const grupos = (await aside.locator('button[aria-expanded]').allInnerTexts()).map((t) => t.trim());
    expect(grupos).not.toContain('FISCAL');
    await expect(gestor.getByRole('heading', { name: TITULO, level: 1 })).toHaveCount(0);
    await expectSemIdentificadoresTecnicos(gestor);
  });

  test('acessibilidade: nomes acessíveis, grade por teclado, Escape e retorno de foco', async ({ browser, request, baseURL }) => {
    const usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    const estab = await criarEstabelecimentoApi(request, cookieA, { rotulo: 'Acessibilidade', cookieB });
    const page = await abrirComo(browser, baseURL!, usuarios.adminA);
    const principal = page.getByRole('main');

    await irParaEmpresas(page);
    await filtrarPor(page, estab.nome);
    await expectControlesComNome(principal);

    // Grade só por teclado: Tab até a linha e Enter seleciona.
    await page.getByRole('searchbox', { name: 'Buscar registros da lista' }).focus();
    let naLinha = false;
    for (let i = 0; i < 15 && !naLinha; i++) {
      await page.keyboard.press('Tab');
      naLinha = await page.evaluate(() => document.activeElement?.tagName === 'TR');
    }
    expect(naLinha, 'o foco deve alcançar a linha da grade só com Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: estab.nome, level: 2, exact: true })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(estab.nome) })).toHaveAttribute('aria-selected', 'true');
    await expectControlesComNome(principal);
    await expectSemIdentificadoresTecnicos(page);

    /** Abre pelo botão, valida nomes acessíveis, fecha com Escape e confere o foco de volta no botão. */
    const verificarSobreposicao = async (abridor: Locator, sobreposicao: Locator): Promise<void> => {
      await abridor.click();
      await expect(sobreposicao).toBeVisible();
      await expectControlesComNome(sobreposicao);
      await expectSemIdentificadoresTecnicos(page);
      await page.keyboard.press('Escape');
      await expect(sobreposicao).toBeHidden();
      await expect(abridor).toBeFocused();
    };

    await verificarSobreposicao(
      page.getByRole('button', { name: /Ações do processo/ }),
      page.getByRole('dialog', { name: 'Ações e decisões do processo' }),
    );

    // Drawer de novo registro e o diálogo de nova empresa aninhado.
    const novo = page.getByRole('button', { name: '+ Novo registro' });
    await novo.click();
    const drawerNovo = page.getByRole('dialog', { name: TITULO });
    await expectControlesComNome(drawerNovo);
    await expect(drawerNovo.getByText('Provisório', { exact: true })).toHaveCount(2);
    await verificarSobreposicao(
      drawerNovo.getByRole('button', { name: 'Nova empresa' }),
      page.getByRole('dialog', { name: 'Nova empresa' }),
    );
    await expect(drawerNovo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawerNovo).toBeHidden();
    await expect(novo).toBeFocused();

    await verificarSobreposicao(
      page.getByRole('button', { name: 'Editar empresa' }),
      page.getByRole('dialog', { name: 'Editar empresa' }),
    );

    // Alteração do aprovado: Escape sem edição fecha e devolve o foco; com edição pede confirmação.
    await verificarSobreposicao(
      page.getByRole('button', { name: 'Editar versão' }),
      page.getByRole('dialog', { name: 'Alteração do estabelecimento' }),
    );
    await page.getByRole('button', { name: 'Editar versão' }).click();
    const drawerAlteracao = page.getByRole('dialog', { name: 'Alteração do estabelecimento' });
    await drawerAlteracao.locator('#fiscal-nome').fill(`${estab.nome} X`);
    await page.keyboard.press('Escape');
    const saida = page.getByRole('alertdialog', { name: 'Descartar alterações?' });
    await expect(saida).toBeVisible();
    await expectControlesComNome(saida);
    await page.keyboard.press('Escape');
    await expect(saida).toBeHidden();
    await expect(drawerAlteracao).toBeVisible();
    await drawerAlteracao.getByRole('button', { name: 'Cancelar' }).click();
    await saida.getByRole('button', { name: 'Descartar e sair' }).click();
    await expect(drawerAlteracao).toBeHidden();

    // Movimentações: regime e decisão.
    await abrirAba(page, 'Movimentações');
    await expectControlesComNome(principal);
    await verificarSobreposicao(
      page.getByRole('button', { name: 'Nova versão' }),
      page.getByRole('dialog', { name: 'Nova versão de regime' }),
    );
    await verificarSobreposicao(
      page.getByRole('button', { name: 'Suspender', exact: true }),
      page.getByRole('dialog', { name: 'Suspender estabelecimento' }),
    );
    await expectSemIdentificadoresTecnicos(page);
  });
});
