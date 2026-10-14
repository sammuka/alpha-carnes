/**
 * E01-T01 — captura de evidências fail-hard (Task 14). Não é regressão contínua:
 * gera os 27 PNG de docs/evidencias/e01-t01, com um elemento-chave visível antes
 * de cada screenshot. Captura cega não passa.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  criarEstabelecimentoApi,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type EstabelecimentoSeed,
  type UsuarioE2e,
  type UsuariosE01,
} from './helpers/e01-t01-seed';

const TITULO = 'Empresas, estabelecimentos e regime';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar empresas e estabelecimentos.';
const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos.';
const BUSCA = 'Buscar registros da lista';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e01-t01');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E01-T01`;

const ESPERADOS = [
  'app-lista.png',
  'prototipo-lista.png',
  'app-ficha.png',
  'prototipo-ficha.png',
  'app-movimentacoes.png',
  'prototipo-movimentacoes.png',
  'app-regras.png',
  'prototipo-regras.png',
  'app-excecoes.png',
  'prototipo-excecoes.png',
  'app-historico.png',
  'prototipo-historico.png',
  'app-integracoes.png',
  'prototipo-integracoes.png',
  'app-aceite.png',
  'prototipo-aceite.png',
  'app-drawer-cadastro.png',
  'prototipo-drawer-cadastro.png',
  'app-dialogo-regime.png',
  'prototipo-dialogo-regime.png',
  'app-dialogo-decisao.png',
  'prototipo-dialogo-decisao.png',
  'app-vazio.png',
  'app-erro-retry.png',
  'app-403.png',
  'app-alteracao-pendente.png',
  'app-cnae-duplicado.png',
];

/** Abas do protótipo e o texto que só existe com aquela aba aberta. */
const ABAS_PROTOTIPO: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Ficha e campos', arquivo: 'prototipo-ficha.png', chave: 'Trilha e responsabilização' },
  { aba: 'Movimentações', arquivo: 'prototipo-movimentacoes.png', chave: 'Acontecimentos simulados' },
  { aba: 'Regras e validações', arquivo: 'prototipo-regras.png', chave: 'Caminho de aprovação' },
  { aba: 'Exceções', arquivo: 'prototipo-excecoes.png', chave: 'Simular erro de validação' },
  { aba: 'Histórico', arquivo: 'prototipo-historico.png', chave: 'Cadastro de demonstração preparado' },
  { aba: 'Integrações', arquivo: 'prototipo-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'prototipo-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

const detalhe = (page: Page): Locator => page.getByRole('region', { name: 'Detalhamento' });

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  await chave.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaEmpresas(page: Page): Promise<void> {
  await page.goto('/fiscal/empresas');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
}

/**
 * A busca da grade restaura o texto da sessão depois de hidratar. Repetir o
 * preenchimento até o valor permanecer evita a disputa com essa restauração.
 */
async function preencherBusca(page: Page, texto: string): Promise<void> {
  const busca = page.getByRole('searchbox', { name: BUSCA });
  await expect(async () => {
    await busca.fill(texto);
    await expect(busca).toHaveValue(texto, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

async function filtrarPor(page: Page, nome: string): Promise<void> {
  await preencherBusca(page, nome);
  await expect(page.getByRole('row')).toHaveCount(2, { timeout: 15_000 });
  await expect(page.getByRole('row', { name: new RegExp(nome) })).toBeVisible();
}

async function selecionarEstabelecimento(page: Page, nome: string): Promise<void> {
  await filtrarPor(page, nome);
  await page.getByRole('row', { name: new RegExp(nome) }).click();
  await expect(page.getByRole('heading', { name: nome, level: 2, exact: true })).toBeVisible();
}

async function abrirAbaApp(page: Page, aba: string, chave: string): Promise<void> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(detalhe(page).getByText(chave).first()).toBeVisible();
}

async function abrirPrototipo(page: Page): Promise<void> {
  // O mesmo file:// com hash não recarrega; about:blank garante estado novo do objeto S.
  await page.goto('about:blank');
  await page.goto(PROTO_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();
}

async function abaPrototipo(page: Page, aba: string, chave: string): Promise<Locator> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  const alvo = page.getByText(chave).first();
  await expect(alvo).toBeVisible({ timeout: 15_000 });
  return alvo;
}

test.describe('E01-T01 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000 });

  let usuarios: UsuariosE01;
  let estab: EstabelecimentoSeed;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    estab = await criarEstabelecimentoApi(request, cookieA, { rotulo: 'Cap', cookieB });
  });

  test('27 capturas com elemento-chave visível', async ({ browser, baseURL }) => {
    if (!baseURL) throw new Error('baseURL do Playwright ausente');

    const proto = await browser.newPage();
    await abrirPrototipo(proto);
    await capturar(proto, 'prototipo-lista.png', proto.locator('tr[data-row]').first());

    await proto.locator('tr[data-row="1"]').click();
    await expect(proto.locator('tr[data-row="1"]')).toHaveClass(/selected/);
    await capturar(proto, 'prototipo-ficha.png', proto.getByText('Trilha e responsabilização'));

    for (const item of ABAS_PROTOTIPO) {
      if (item.arquivo === 'prototipo-ficha.png') continue;
      await abrirPrototipo(proto);
      await capturar(proto, item.arquivo, await abaPrototipo(proto, item.aba, item.chave));
    }

    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: '+ Novo registro' }).click();
    const drawerProto = proto.getByRole('dialog', { name: `Formulário de ${TITULO}` });
    await capturar(proto, 'prototipo-drawer-cadastro.png', drawerProto.getByRole('button', { name: 'Salvar rascunho ilustrativo' }));

    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: 'Ativar regime por vigência', exact: true }).click();
    const regimeProto = proto.getByRole('dialog').filter({ hasText: 'Ação do domínio: ativar regime por vigência' });
    await capturar(proto, 'prototipo-dialogo-regime.png', regimeProto.getByText('Justificativa / observação'));

    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: 'Aprovar alteração', exact: true }).click();
    const decisaoProto = proto.getByRole('dialog').filter({ hasText: 'Ação do domínio: aprovar alteração' });
    await capturar(proto, 'prototipo-dialogo-decisao.png', decisaoProto.locator('#action-reason'));
    await proto.close();

    const page = await abrirComo(browser, baseURL, usuarios.adminA);
    await irParaEmpresas(page);
    await filtrarPor(page, estab.nome);
    await capturar(page, 'app-lista.png', page.getByRole('row', { name: new RegExp(estab.nome) }));

    await page.getByRole('row', { name: new RegExp(estab.nome) }).click();
    const tituloFicha = page.getByRole('heading', { name: estab.nome, level: 2, exact: true });
    await expect(tituloFicha).toBeVisible();
    await capturar(page, 'app-ficha.png', detalhe(page).getByText('Informações do registro selecionado'));

    await abrirAbaApp(page, 'Movimentações', 'Versões de regime tributário');
    await capturar(page, 'app-movimentacoes.png', detalhe(page).getByText('Versões de regime tributário'));

    await abrirAbaApp(page, 'Regras e validações', 'Regras de negócio documentadas');
    await capturar(page, 'app-regras.png', detalhe(page).getByText('Regras de negócio documentadas'));

    await abrirAbaApp(page, 'Exceções', 'Catálogo de erros e respostas da interface');
    await capturar(page, 'app-excecoes.png', detalhe(page).getByText('Catálogo de erros e respostas da interface'));

    await abrirAbaApp(page, 'Histórico', 'Histórico e justificativas');
    await capturar(page, 'app-historico.png', detalhe(page).getByText('Seed E2E E01-T01').first());

    await abrirAbaApp(page, 'Integrações', 'Dependências e conexões do domínio');
    await capturar(page, 'app-integracoes.png', detalhe(page).getByText('Dependências e conexões do domínio'));

    await abrirAbaApp(page, 'Aceite e testes', 'Matriz de homologação funcional e técnica');
    await capturar(page, 'app-aceite.png', detalhe(page).getByText('Matriz de homologação funcional e técnica'));

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: TITULO });
    await capturar(page, 'app-drawer-cadastro.png', drawer.getByText('Novo estabelecimento (salvo como rascunho)'));
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('tab', { name: 'Movimentações', exact: true }).click();
    await page.getByRole('button', { name: 'Nova versão' }).click();
    const regime = page.getByRole('dialog', { name: 'Nova versão de regime' });
    await capturar(page, 'app-dialogo-regime.png', regime.getByLabel('Regime tributário'));
    await regime.getByRole('button', { name: 'Cancelar' }).click();
    await expect(regime).toBeHidden();

    await page.getByRole('button', { name: 'Suspender', exact: true }).click();
    const decisao = page.getByRole('dialog', { name: 'Suspender estabelecimento' });
    await capturar(page, 'app-dialogo-decisao.png', decisao.getByLabel('Justificativa'));
    await decisao.getByRole('button', { name: 'Cancelar' }).click();
    await expect(decisao).toBeHidden();

    await irParaEmpresas(page);
    await preencherBusca(page, 'zzz-sem-cadastro-e01-t01');
    await capturar(page, 'app-vazio.png', page.getByText(TEXTO_VAZIO));

    await irParaEmpresas(page);
    await selecionarEstabelecimento(page, estab.nome);
    await page.route('**/api/erp/fiscal/estabelecimentos/*/historico', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );
    await page.getByRole('tab', { name: 'Histórico', exact: true }).click();
    const retry = detalhe(page).getByRole('button', { name: 'Tentar novamente' });
    await expect(detalhe(page).getByText('Serviço indisponível no momento. Tente novamente.')).toBeVisible();
    await capturar(page, 'app-erro-retry.png', retry);
    await page.unroute('**/api/erp/fiscal/estabelecimentos/*/historico');

    await irParaEmpresas(page);
    await selecionarEstabelecimento(page, estab.nome);
    await page.getByRole('tab', { name: 'Ficha e campos', exact: true }).click();
    await page.getByRole('button', { name: 'Editar versão' }).click();
    const alteracao = page.getByRole('dialog', { name: 'Alteração do estabelecimento' });
    const nomeProposto = `${estab.nome} Alt`;
    await alteracao.locator('#fiscal-nome').fill(nomeProposto);
    await alteracao.locator('#alteracao-motivo').fill('Alteração de nome para a evidência visual.');
    await alteracao.getByRole('button', { name: 'Submeter para revisão' }).click();
    await expect(alteracao).toBeHidden();
    await capturar(page, 'app-alteracao-pendente.png', page.getByRole('heading', { name: 'Alteração aguardando revisão' }));

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const editor = page.getByRole('dialog', { name: TITULO });
    await editor.getByRole('combobox', { name: /Empresa/ }).click();
    await page.getByPlaceholder('Pesquisar pelo nome').fill(estab.sufixo);
    await page.getByRole('option', { name: estab.razaoSocial }).click();
    await expect(editor.getByRole('combobox', { name: /Empresa/ })).toContainText(estab.razaoSocial);
    await editor.locator('#fiscal-cnpj').fill(estab.cnpj);
    await editor.locator('#fiscal-nome').fill(`${estab.nome} dup`);
    await editor.locator('#fiscal-ie').fill(estab.inscricaoEstadual);
    await editor.locator('#fiscal-im').fill(estab.inscricaoMunicipal);
    await editor.locator('#fiscal-uf').selectOption('SP');
    await editor.getByRole('button', { name: 'Adicionar atividade' }).click();
    await editor.getByRole('button', { name: 'Adicionar atividade' }).click();
    await editor.locator('#cnae-codigo-0').fill('6201501');
    await editor.locator('#cnae-descricao-0').fill('Atividade principal de demonstração');
    await editor.locator('#cnae-codigo-1').fill('6201501');
    await editor.locator('#cnae-descricao-1').fill('Atividade repetida de demonstração');
    await editor.locator('#fiscal-motivo').fill('Conferir duplicidade de CNAE.');
    await editor.getByRole('button', { name: 'Verificar dados' }).click();
    await capturar(page, 'app-cnae-duplicado.png', editor.getByText('Código de CNAE repetido.'));

    const gestor = await abrirComo(browser, baseURL, usuarios.gestor);
    await gestor.goto('/fiscal/empresas');
    await capturar(gestor, 'app-403.png', gestor.getByText(SEM_PERMISSAO));

    const pngs = fs.readdirSync(OUT_DIR).filter((nome) => nome.endsWith('.png')).sort();
    expect(pngs).toEqual([...ESPERADOS].sort());
  });
});
