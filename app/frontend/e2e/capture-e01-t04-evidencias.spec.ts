/**
 * E01-T04 — captura de evidências fail-hard. Gera os 25 PNG de docs/evidencias/e01-t04,
 * com um elemento-chave visível antes de cada screenshot. Captura cega não passa.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  criarCenario,
  criarSimulacaoApoio,
  entrarNoFrontend,
  loginApi,
  prepararUsuarios,
  type CenarioE01T04,
  type UsuarioE2e,
  type UsuariosE01,
} from './helpers/e01-t04-seed';
import { BACKEND_URL } from './helpers/onda6-seed';

const TITULO = 'Simulador fiscal e memória de cálculo';
const SEM_PERMISSAO = 'Você não tem permissão para visualizar o simulador fiscal e a memória de cálculo.';
const TEXTO_VAZIO = 'Nenhum resultado para o período, filtro ou situação escolhidos. Limpe os filtros ou cadastre um novo registro.';
const FALTA = 'Não há regra tributária aprovada vigente nesta competência para o enquadramento selecionado.';
const FRASE_IPI = 'Esta regra não guarda alíquota deste tributo; nenhum valor é calculado.';
const MOTIVO = 'Simulação da competência de outubro de 2026.';

const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e01-t04');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E01-T04`;

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
  'app-comparar.png',
  'app-base-difere.png',
  'app-falta-referencia.png',
  'app-explicacao.png',
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
  { aba: 'Movimentações', arquivo: 'app-movimentacoes.png', chave: 'Nenhuma simulação gera lançamento fiscal nem documento.' },
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'nenhum valor gerado vira lançamento fiscal sem documento; Decimal exato' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Falta referência legal' },
  { aba: 'Histórico', arquivo: 'app-historico.png', chave: 'payloads sigilosos' },
  { aba: 'Integrações', arquivo: 'app-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'app-aceite.png', chave: 'não registra aceite contratual' },
];

const painel = (page: Page): Locator => page.getByRole('tabpanel');

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  await chave.scrollIntoViewIfNeeded();
  // Oculta o indicador do `next dev` (portal "N") sem alterar o produto.
  await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function abrirComo(browser: Browser, baseURL: string, usuario: UsuarioE2e): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => sessionStorage.removeItem('fiscal.simulador.lista'));
  await entrarNoFrontend(context, baseURL, usuario);
  return context.newPage();
}

async function irParaSimulador(page: Page): Promise<void> {
  await page.goto('/fiscal/simulador');
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
}

async function filtrarCliente(page: Page, nome: string): Promise<void> {
  const busca = page.getByLabel('Buscar cliente', { exact: true });
  await expect(async () => {
    await busca.fill(nome);
    await expect(busca).toHaveValue(nome, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
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

test.describe('E01-T04 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let usuarios: UsuariosE01;
  let cenario: CenarioE01T04;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    usuarios = await prepararUsuarios(request);
    const cookieA = await loginApi(request, usuarios.adminA);
    const cookieB = await loginApi(request, usuarios.adminB);
    cenario = await criarCenario(request, cookieA, cookieB, 'Captura');
    await criarSimulacaoApoio(request, cookieA, cenario);
    const lista = await request.get(
      `${BACKEND_URL}/fiscal/simulacoes?search=${encodeURIComponent(cenario.clienteNome)}&pageSize=20`,
      { headers: { Cookie: cookieA } },
    );
    const linhas = (await lista.json()) as { data: Array<{ id: string }> };
    const id = linhas.data[0]?.id;
    if (!id) throw new Error('A simulação de apoio não apareceu na lista');
    const detalheRes = await request.get(`${BACKEND_URL}/fiscal/simulacoes/${id}`, { headers: { Cookie: cookieA } });
    const detalhe = await detalheRes.json() as {
      versao: number;
      estabelecimentoId: string;
      operacaoId: string;
      clienteId: string;
      produtoId: string;
      ncmId: string;
      quantidade: string;
      pesoNf: string;
      valor: string;
      competencia: string;
      enquadramentoId: string;
    };
    const versao = await request.post(`${BACKEND_URL}/fiscal/simulacoes/${id}/versoes`, {
      headers: { Cookie: cookieA, 'Content-Type': 'application/json' },
      data: {
        estabelecimentoId: detalhe.estabelecimentoId,
        operacaoId: detalhe.operacaoId,
        clienteId: detalhe.clienteId,
        produtoId: detalhe.produtoId,
        ncmId: detalhe.ncmId,
        quantidade: detalhe.quantidade,
        pesoNf: detalhe.pesoNf,
        valor: detalhe.valor,
        desconto: '100,00',
        competencia: detalhe.competencia,
        enquadramentoId: detalhe.enquadramentoId,
        justificativa: 'Versão com desconto para a evidência.',
        versao: detalhe.versao,
      },
    });
    if (!versao.ok()) throw new Error(`POST versão ${versao.status()} ${await versao.text()}`);
  });

  test('25 capturas com elemento-chave visível', async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
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

    const page = await abrirComo(browser, baseURL, usuarios.adminA);
    await irParaSimulador(page);
    await filtrarCliente(page, cenario.clienteNome);
    const linhas = page.getByRole('row', { name: new RegExp(cenario.clienteNome) });
    await expect(linhas).toHaveCount(2);
    await capturar(page, 'app-lista.png', linhas.first());

    await linhas.filter({ hasNotText: '900,00' }).click();
    await capturar(page, 'app-ficha.png', painel(page).getByText('Situação Calculada').first());
    await capturar(page, 'app-base-difere.png', painel(page).getByRole('status'));

    await painel(page).getByRole('button', { name: 'Explicar tributos' }).click();
    await capturar(page, 'app-explicacao.png', painel(page).getByText(FRASE_IPI).first());

    for (const item of ABAS_APP) {
      await abrirAbaApp(page, item.aba, item.chave);
      await capturar(page, item.arquivo, painel(page).getByText(item.chave).first());
    }

    await page.getByText('Ações do processo', { exact: true }).click();
    await page.getByRole('button', { name: 'Comparar versões', exact: true }).click();
    const comparar = page.getByRole('dialog', { name: 'Comparar versões' });
    const outra = comparar.getByLabel('Outra versão', { exact: true });
    await expect(outra.locator('option')).toHaveCount(2);
    await outra.selectOption((await outra.locator('option').nth(1).getAttribute('value')) ?? '');
    await comparar.getByRole('button', { name: 'Comparar versões', exact: true }).click();
    await capturar(page, 'app-comparar.png', comparar.getByText('ICMS: 70,00 → 63,00'));
    await comparar.getByRole('button', { name: 'Cancelar' }).click();
    await expect(comparar).toBeHidden();

    await page.getByRole('button', { name: '+ Novo registro' }).click();
    const drawer = page.getByRole('dialog', { name: 'Novo registro' });
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Salvar rascunho' }));
    const combo = drawer.getByLabel('Enquadramento fiscal', { exact: true });
    await expect(combo.locator(`option[value="${cenario.enquadramentoId}"]`)).toBeAttached();
    await combo.selectOption(cenario.enquadramentoId);
    await drawer.getByLabel('Quantidade', { exact: true }).fill('10,000');
    await drawer.getByLabel('Peso informado na nota (kg)', { exact: true }).fill('982,000');
    await drawer.getByLabel('Valor', { exact: true }).fill('1.000,00');
    await drawer.getByLabel('Desconto', { exact: true }).fill('0,00');
    await drawer.getByLabel('Competência', { exact: true }).fill('2027-01');
    await drawer.getByLabel('Motivo da alteração', { exact: true }).fill(MOTIVO);
    await drawer.getByRole('button', { name: 'Salvar rascunho' }).click();
    await capturar(page, 'app-falta-referencia.png', drawer.locator('p[role=alert]').filter({ hasText: FALTA }));
    page.once('dialog', (dialog) => { void dialog.accept(); });
    await drawer.getByRole('button', { name: 'Cancelar' }).click();
    await expect(drawer).toBeHidden();

    await filtrarCliente(page, 'zzz-sem-cadastro-e01-t04');
    await capturar(page, 'app-vazio.png', page.getByText(TEXTO_VAZIO));

    await page.route('**/api/erp/fiscal/simulacoes**', async (route) => {
      const url = new URL(route.request().url());
      const listaGet = route.request().method() === 'GET' && /\/simulacoes$/.test(url.pathname);
      if (listaGet) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"falha"}' });
        return;
      }
      await route.continue();
    });
    await page.reload();
    await capturar(page, 'app-erro-retry.png', page.getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/erp/fiscal/simulacoes**');

    const gestor = await abrirComo(browser, baseURL, usuarios.gestor);
    await gestor.goto('/fiscal/simulador');
    await capturar(gestor, 'app-403.png', gestor.getByText(SEM_PERMISSAO));

    const pngs = fs.readdirSync(OUT_DIR).filter((nome) => nome.endsWith('.png')).sort();
    expect(pngs).toEqual([...ESPERADOS].sort());
  });
});
