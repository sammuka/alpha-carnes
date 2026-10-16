/**
 * E01-T02 — captura de evidências fail-hard (Task 14). Não é regressão contínua:
 * gera os 25 PNG de docs/evidencias/e01-t02, com um elemento-chave visível antes
 * de cada screenshot. Captura cega não passa.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  criarEnquadramento,
  entrarNoFrontend,
  inserirEmpate,
  loginApi,
  prepararUsuarios,
  type CenarioE01T02,
  type UsuarioE2e,
  type UsuariosE01,
} from './helpers/e01-t02-seed';

const TITULO = 'Operações fiscais e enquadramentos';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar operações fiscais e enquadramentos.';
const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
const EMPATE = 'Há mais de um enquadramento vigente para este critério. Nenhum foi escolhido.';
const REGRA_AUSENTE = 'Nenhum enquadramento vigente cobre o critério e não há regra tributária aprovada.';
const BUSCA = 'Buscar';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e01-t02');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E01-T02`;

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
  'app-dialogo-duplicar.png',
  'app-dialogo-cfop.png',
  'app-alerta-empate.png',
  'app-alerta-regra-ausente.png',
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
  { aba: 'Movimentações', arquivo: 'app-movimentacoes.png', chave: 'Etapas e evidências de negócio' },
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'Esta tela não calcula tributo' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Empate de enquadramento' },
  { aba: 'Histórico', arquivo: 'app-historico.png', chave: 'Seed E2E E01-T02' },
  { aba: 'Integrações', arquivo: 'app-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'app-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  await chave.scrollIntoViewIfNeeded();
  // Oculta o indicador do `next dev` (portal "N") sem alterar o produto.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.enquadramentos.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaEnquadramentos(page: Page): Promise<void> {
  await page.goto('/fiscal/enquadramentos');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function filtrarPor(page: Page, termo: string): Promise<void> {
  const busca = page.getByRole('textbox', { name: BUSCA });
  await expect(async () => {
    await busca.fill(termo);
    await expect(busca).toHaveValue(termo, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByRole('row', { name: new RegExp(termo) }).first()).toBeVisible({ timeout: 15_000 });
}

async function abrirAba(page: Page, aba: string, chave: string): Promise<Locator> {
  await page.getByRole('tab', { name: aba, exact: true }).click();
  await expect(page.getByRole('tab', { name: aba, exact: true })).toHaveAttribute('aria-selected', 'true');
  const alvo = page.getByText(chave).first();
  await expect(alvo).toBeVisible({ timeout: 15_000 });
  return alvo;
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

test.describe('E01-T02 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let usuarios: UsuariosE01;
  let principal: CenarioE01T02;
  let ausente: CenarioE01T02;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    principal = await criarEnquadramento(request, cookieA, cookieB, 'Captura');
    ausente = await criarEnquadramento(request, cookieA, cookieB, 'Ausente');
  });

  test('25 capturas com elemento-chave visível', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    if (!baseURL) throw new Error('baseURL do Playwright ausente');
    if (!principal.enquadramentoId) throw new Error('Enquadramento da captura ausente');

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
    await capturar(proto, 'prototipo-drawer.png', drawerProto.getByRole('button', { name: 'Salvar rascunho ilustrativo' }));
    await proto.close();

    const page = await abrirComo(browser, baseURL, usuarios.adminA);
    await irParaEnquadramentos(page);
    await filtrarPor(page, principal.rotuloOperacao);
    await capturar(page, 'app-lista.png', page.getByRole('row', { name: new RegExp(principal.rotuloOperacao) }));

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Salvar rascunho' }));
    await drawer.getByRole('button', { name: 'Novo código' }).first().click();
    const cfop = page.getByRole('dialog', { name: 'Operação fiscal (CFOP)' });
    await capturar(cfop.page(), 'app-dialogo-cfop.png', cfop.getByText('A tabela oficial completa não está carregada'));
    await cfop.getByRole('button', { name: 'Cancelar' }).click();
    await expect(cfop).toBeHidden();
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('row', { name: new RegExp(principal.rotuloOperacao) }).click();
    await capturar(page, 'app-ficha.png', page.getByText('Trilha e responsabilização'));
    for (const item of ABAS_APP) {
      await capturar(page, item.arquivo, await abrirAba(page, item.aba, item.chave));
    }

    await page.getByRole('tab', { name: 'Movimentações', exact: true }).click();
    await page.getByRole('button', { name: 'Duplicar', exact: true }).click();
    const duplicar = page.getByRole('dialog', { name: 'Duplicar perfil' });
    await capturar(page, 'app-dialogo-duplicar.png', duplicar.getByLabel('Motivo da duplicação'));
    await duplicar.getByRole('button', { name: 'Cancelar' }).click();
    await expect(duplicar).toBeHidden();

    inserirEmpate(principal.enquadramentoId);
    await abrirAba(page, 'Exceções', 'Empate de enquadramento');
    await page.getByRole('button', { name: 'Validar', exact: true }).click();
    await capturar(page, 'app-alerta-empate.png', page.getByText(EMPATE));

    await irParaEnquadramentos(page);
    await filtrarPor(page, ausente.rotuloOperacao);
    await page.getByRole('row', { name: new RegExp(ausente.rotuloOperacao) }).click();
    await abrirAba(page, 'Movimentações', 'Inativar');
    await page.getByRole('button', { name: 'Inativar', exact: true }).click();
    const decisao = page.getByRole('dialog', { name: 'Inativar enquadramento' });
    await decisao.getByLabel(/Justificativa/).fill('Evidência visual da inativação.');
    await decisao.getByRole('button', { name: 'Inativar', exact: true }).click();
    await expect(decisao).toBeHidden();
    await page.getByRole('row', { name: new RegExp(ausente.rotuloOperacao) }).click();
    await abrirAba(page, 'Exceções', 'Operação sem regra aprovada');
    await page.getByRole('button', { name: 'Validar', exact: true }).click();
    await capturar(page, 'app-alerta-regra-ausente.png', page.getByText(REGRA_AUSENTE));

    await irParaEnquadramentos(page);
    const busca = page.getByRole('textbox', { name: BUSCA });
    await expect(async () => {
      await busca.fill('zzz-sem-cadastro-e01-t02');
      await expect(busca).toHaveValue('zzz-sem-cadastro-e01-t02', { timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    await capturar(page, 'app-vazio.png', page.getByText(TEXTO_VAZIO));

    await page.route('**/api/erp/fiscal/enquadramentos**', async (route) => {
      const caminho = new URL(route.request().url()).pathname;
      const lista = route.request().method() === 'GET'
        && (caminho.endsWith('/enquadramentos') || caminho.endsWith('/enquadramentos/contagens'));
      if (lista) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: '{}',
        });
        return;
      }
      await route.continue();
    });
    await irParaEnquadramentos(page);
    await capturar(page, 'app-erro-retry.png', page.getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/erp/fiscal/enquadramentos**');

    const gestor = await abrirComo(browser, baseURL, usuarios.gestor);
    await gestor.goto('/fiscal/enquadramentos');
    await capturar(gestor, 'app-403.png', gestor.getByText(SEM_PERMISSAO));

    const pngs = fs.readdirSync(OUT_DIR).filter((nome) => nome.endsWith('.png')).sort();
    expect(pngs).toEqual([...ESPERADOS].sort());
  });
});
