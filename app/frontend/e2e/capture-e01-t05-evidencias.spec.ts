/**
 * E01-T05 — captura de evidências fail-hard. Gera os 25 PNG de docs/evidencias/e01-t05,
 * com um elemento-chave visível antes de cada screenshot. Captura cega não passa.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  criarCenarioHomologacao,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T05,
  type UsuarioE2e,
  type UsuariosE01,
} from './helpers/e01-t05-seed';

const TITULO = 'Painel de alterações e homologação de regras';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o painel de alterações e homologação de regras.';
const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
const DESCRICAO = 'Revisão da versão aprovada para captura.';
const DESCRICAO_AUTOR = 'Revisão do autor para captura.';
const JUSTIFICATIVA = 'Abertura da revisão desta versão.';
const SEGREGACAO = 'A aprovação deve ser feita por usuário diferente de quem submeteu.';
const AUSENTE = 'A publicação exige ao menos um cenário de regressão.';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e01-t05');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E01-T05`;

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
  'app-drawer.png',
  'prototipo-drawer.png',
  'app-vazio.png',
  'app-erro-retry.png',
  'app-403.png',
  'app-diff.png',
  'app-segregacao.png',
  'app-cenario-ausente.png',
  'app-publicada.png',
];

const ABAS_PROTOTIPO: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Ficha e campos', arquivo: 'prototipo-ficha.png', chave: 'Trilha e responsabilização' },
  { aba: 'Movimentações', arquivo: 'prototipo-movimentacoes.png', chave: 'Acontecimentos simulados' },
  { aba: 'Regras e validações', arquivo: 'prototipo-regras.png', chave: 'Caminho de aprovação' },
  { aba: 'Exceções', arquivo: 'prototipo-excecoes.png', chave: 'Simular erro de validação' },
  { aba: 'Histórico', arquivo: 'prototipo-historico.png', chave: 'Cadastro de demonstração preparado' },
  { aba: 'Integrações', arquivo: 'prototipo-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'prototipo-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

const ABAS_APP: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Movimentações', arquivo: 'app-movimentacoes.png', chave: 'Preparação → Verificação → Autorização → Conclusão' },
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'aprovador diferente do autor; cenários de regressão obrigatórios' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Atualização normativa em meio à operação' },
  { aba: 'Histórico', arquivo: 'app-historico.png', chave: 'payloads sigilosos' },
  { aba: 'Integrações', arquivo: 'app-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'app-aceite.png', chave: 'não registra aceite contratual' },
];

const painel = (page: Page): Locator => page.getByRole('tabpanel');

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  await chave.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.homologacoes.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaPainel(page: Page): Promise<void> {
  await page.goto('/fiscal/homologacao');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function abrirDrawer(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: '+ Novo registro' }).click();
  const drawer = page.getByRole('dialog', { name: 'Novo registro' });
  await expect(drawer.getByRole('button', { name: 'Salvar rascunho' })).toBeVisible();
  return drawer;
}

async function preencherESalvar(page: Page, drawer: Locator, cenario: CenarioE01T05, descricao: string): Promise<void> {
  await drawer.getByRole('combobox', { name: 'Enquadramento fiscal' }).click();
  await page.getByPlaceholder('Pesquisar enquadramento').fill(cenario.codigoEnquadramento);
  const opcao = page.getByRole('option', { name: new RegExp(cenario.codigoEnquadramento) });
  await expect(opcao.first()).toBeVisible({ timeout: 90_000 });
  await opcao.first().click();
  await drawer.getByLabel('Descrição').fill(descricao);
  await drawer.getByLabel('Justificativa auditável').fill(JUSTIFICATIVA);
  await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

async function abrirAcoes(page: Page): Promise<void> {
  const menu = page.getByRole('button', { name: 'Ações do processo ▾' });
  if ((await menu.getAttribute('aria-expanded')) !== 'true') await menu.click();
}

async function abrirPrototipo(page: Page): Promise<void> {
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

async function abrirAbaApp(page: Page, aba: string, chave: string): Promise<void> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(painel(page).getByText(chave).first()).toBeVisible();
}

test.describe('E01-T05 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let usuarios: UsuariosE01;
  let principal: CenarioE01T05;
  let doAutor: CenarioE01T05;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    principal = await criarCenarioHomologacao(request, cookieA, cookieB, 'CapturaP');
    doAutor = await criarCenarioHomologacao(request, cookieA, cookieB, 'CapturaA');
  });

  test('25 capturas com elemento-chave visível', async ({ browser, baseURL }) => {
    test.setTimeout(420_000);
    if (!baseURL) throw new Error('baseURL do Playwright ausente');

    const proto = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
    await capturar(proto, 'prototipo-drawer.png', drawerProto.getByRole('button', { name: 'Salvar rascunho ilustrativo' }));
    await proto.close();

    const page = await abrirComo(browser, baseURL, usuarios.adminB);
    await irParaPainel(page);
    const drawer = await abrirDrawer(page);
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Salvar rascunho' }));
    await preencherESalvar(page, drawer, principal, DESCRICAO);
    await capturar(page, 'app-lista.png', page.getByRole('row', { name: new RegExp(DESCRICAO) }).first());
    await capturar(page, 'app-ficha.png', painel(page).getByText('Situação Em revisão').first());
    for (const item of ABAS_APP) {
      await abrirAbaApp(page, item.aba, item.chave);
      await capturar(page, item.arquivo, painel(page).getByText(item.chave).first());
    }
    await page.getByRole('tab', { name: 'Ficha e campos', exact: true }).click();

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Revisar diff' }).click();
    const diff = page.getByRole('dialog', { name: 'Revisar diff' });
    await capturar(page, 'app-diff.png', diff.getByText(/Alíquota \(%\)/).first());
    await page.keyboard.press('Escape');
    await expect(diff).toBeHidden();

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Aprovar/rejeitar' }).click();
    const decisao = page.getByRole('dialog', { name: 'Aprovar/rejeitar' });
    await decisao.getByRole('button', { name: 'Aprovar' }).click();
    await expect(decisao).toBeHidden({ timeout: 30_000 });
    await expect(painel(page).getByText('Situação Aprovada').first()).toBeVisible();

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Publicar e auditar' }).click();
    const publicar = page.getByRole('dialog', { name: 'Publicar e auditar' });
    await publicar.getByRole('button', { name: 'Publicar' }).click();
    await capturar(page, 'app-cenario-ausente.png', page.getByRole('alert').filter({ hasText: AUSENTE }).first());
    await page.keyboard.press('Escape');
    await expect(publicar).toBeHidden();

    await painel(page).getByRole('button', { name: 'cenários aprovados' }).click();
    const cenario = page.getByRole('dialog', { name: 'cenários aprovados' });
    const memoria = cenario.getByRole('combobox', { name: 'Memória calculada' });
    const opcaoMemoria = memoria.locator('option', { hasText: principal.simulacaoCodigo });
    await expect(opcaoMemoria.first()).toBeAttached({ timeout: 60_000 });
    await memoria.selectOption((await opcaoMemoria.first().getAttribute('value')) ?? '');
    await cenario.getByRole('button', { name: 'Vincular' }).click();
    await expect(cenario).toBeHidden({ timeout: 30_000 });

    await abrirAcoes(page);
    await page.getByRole('button', { name: 'Publicar e auditar' }).click();
    await page.getByRole('dialog', { name: 'Publicar e auditar' }).getByRole('button', { name: 'Publicar' }).click();
    await capturar(page, 'app-publicada.png', painel(page).getByText('Situação Publicada').first());

    await page.getByLabel('Pesquisar descrição ou referência de negócio').fill('zzz-sem-cadastro-e01-t05');
    await capturar(page, 'app-vazio.png', page.getByText(TEXTO_VAZIO));

    await page.route('**/api/erp/fiscal/homologacoes**', async (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() === 'GET' && /\/homologacoes$/.test(url.pathname)) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"falha"}' });
        return;
      }
      await route.continue();
    });
    await page.reload();
    await capturar(page, 'app-erro-retry.png', page.getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/erp/fiscal/homologacoes**');
    await page.close();

    const autor = await abrirComo(browser, baseURL, usuarios.adminA);
    await irParaPainel(autor);
    const drawerAutor = await abrirDrawer(autor);
    await preencherESalvar(autor, drawerAutor, doAutor, DESCRICAO_AUTOR);
    await abrirAcoes(autor);
    await autor.getByRole('button', { name: 'Aprovar/rejeitar' }).click();
    await autor.getByRole('dialog', { name: 'Aprovar/rejeitar' }).getByRole('button', { name: 'Aprovar' }).click();
    await capturar(autor, 'app-segregacao.png', autor.getByRole('alert').filter({ hasText: SEGREGACAO }).first());
    await autor.close();

    const gestor = await abrirComo(browser, baseURL, usuarios.gestor);
    await gestor.goto('/fiscal/homologacao');
    await capturar(gestor, 'app-403.png', gestor.getByText(SEM_PERMISSAO));

    const pngs = fs.readdirSync(OUT_DIR).filter((nome) => nome.endsWith('.png')).sort();
    expect(pngs).toEqual([...ESPERADOS].sort());
  });
});
