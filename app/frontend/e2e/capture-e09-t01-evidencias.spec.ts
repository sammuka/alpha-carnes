/**
 * E09-T01 — captura de evidências fail-hard. Gera os PNG de docs/evidencias/e09-t01 (app × protótipo),
 * com um elemento-chave visível antes de cada screenshot. Captura cega não passa.
 */
import { test, expect, type APIRequestContext, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarPlanoDaJornada, type PlanoDaJornada } from './helpers/e09-t02-seed';
import { ADMIN_EMAIL, BACKEND_URL, loginBackend } from './helpers/onda6-seed';

const TITULO = 'Plano de contas e centros de custo';
const COMERCIAL_EMAIL = 'comercial.e09.t01@alphacarnes.local';
const COMERCIAL_SENHA = 'Comercial@E09t01';
const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e09-t01');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E09-T01`;

const ABAS_PROTOTIPO: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Movimentações', arquivo: 'prototipo-movimentacoes.png', chave: 'Acontecimentos simulados' },
  { aba: 'Regras e validações', arquivo: 'prototipo-regras.png', chave: 'Caminho de aprovação' },
  { aba: 'Exceções', arquivo: 'prototipo-excecoes.png', chave: 'Simular erro de validação' },
  { aba: 'Histórico', arquivo: 'prototipo-historico.png', chave: 'Cadastro de demonstração preparado' },
  { aba: 'Integrações', arquivo: 'prototipo-integracoes.png', chave: 'Integração fiscal' },
  { aba: 'Aceite e testes', arquivo: 'prototipo-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

const ABAS_APP: Array<{ aba: string; arquivo: string; chave: string }> = [
  { aba: 'Movimentações', arquivo: 'app-movimentacoes.png', chave: 'Etapas e evidências de negócio' },
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'partida dobrada, níveis hierárquicos válidos, competência obrigatória' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Bloqueio / exceção: Conta desativada.' },
  { aba: 'Histórico', arquivo: 'app-historico.png', chave: 'Histórico e justificativas' },
  { aba: 'Integrações', arquivo: 'app-integracoes.png', chave: 'Esta tela não chama serviço externo.' },
  { aba: 'Aceite e testes', arquivo: 'app-aceite.png', chave: 'Matriz de homologação funcional e técnica' },
];

async function capturar(page: Page, arquivo: string, chave: Locator): Promise<void> {
  await expect(chave, `elemento-chave ausente antes de ${arquivo}`).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  // Oculta o indicador do `next dev` (portal "N") e os avisos temporários, sem alterar o produto.
  await page.addStyleTag({ content: 'nextjs-portal, [data-sonner-toaster] { display: none !important; }' });
  await page.screenshot({ path: path.join(OUT_DIR, arquivo), fullPage: true });
}

async function postar(request: APIRequestContext, cookie: string, rota: string, corpo: unknown) {
  const resposta = await request.post(`${BACKEND_URL}${rota}`, { headers: { Cookie: cookie, 'Content-Type': 'application/json' }, data: corpo });
  if (!resposta.ok()) throw new Error(`POST ${rota} -> ${resposta.status()}: ${await resposta.text()}`);
}

async function abrirComo(browser: Browser, baseURL: string, email: string, senha: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => sessionStorage.removeItem('e09-t01-plano'));
  const resposta = await context.request.post('/api/auth/login', { data: { email, password: senha }, headers: { 'Content-Type': 'application/json' } });
  expect(resposta.ok(), `login falhou: ${resposta.status()}`).toBeTruthy();
  const cookies = resposta.headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [par] = header.value.split(';');
      const igual = par.indexOf('=');
      return { name: par.slice(0, igual), value: par.slice(igual + 1), url: baseURL };
    });
  await context.addCookies(cookies);
  return context.newPage();
}

async function abrirPrototipo(page: Page): Promise<void> {
  await page.goto('about:blank');
  await page.goto(PROTO_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible();
}

test.describe('E09-T01 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let plano: PlanoDaJornada;
  let senhaAdmin: string;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const login = await loginBackend(request);
    senhaAdmin = login.password;
    plano = await criarPlanoDaJornada(request);
    // Variedade de situação na grade e nos KPIs: uma conta em revisão, uma suspensa (bloqueada) e um rascunho.
    const base = { classificacao: 'sintetica', natureza: 'DESPESA', grupo: 'Despesas operacionais', contaPaiCodigo: null, centroCodigo: plano.centroCodigo, vigenciaInicio: '2026-10-01', vigenciaFim: null };
    await postar(request, login.cookieHeader, '/contabilidade/plano', { ...base, codigo: `D${plano.sufixo}`, nome: `Despesas gerais ${plano.sufixo}`, justificativa: 'abre a conta' });
    await postar(request, login.cookieHeader, `/contabilidade/plano/D${plano.sufixo}/revisar-competencia`, { numero: 1, vigenciaInicio: '2026-10-01', vigenciaFim: null, justificativa: 'revisa a competência' });
    await postar(request, login.cookieHeader, '/contabilidade/plano', { ...base, codigo: `R${plano.sufixo}`, nome: `Receitas a classificar ${plano.sufixo}`, natureza: 'RECEITA', justificativa: 'abre a conta' });
    await postar(request, login.cookieHeader, `/contabilidade/plano/P${plano.sufixo}.1/bloquear`, { numero: 1, justificativa: 'bloqueia a conta para a captura' });
    const usuario = await request.post(`${BACKEND_URL}/usuarios`, {
      headers: { Cookie: login.cookieHeader, 'Content-Type': 'application/json' },
      data: { nome: 'Comercial da jornada', email: COMERCIAL_EMAIL, password: COMERCIAL_SENHA, perfis: ['comercial'] },
    });
    expect(usuario.ok() || usuario.status() === 409, `criar comercial: ${usuario.status()}`).toBeTruthy();
  });

  test('capturas com elemento-chave visível', async ({ browser, baseURL }) => {
    test.setTimeout(420_000);
    if (!baseURL) throw new Error('baseURL do Playwright ausente');

    const proto = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await abrirPrototipo(proto);
    await capturar(proto, 'prototipo-lista.png', proto.locator('tr[data-row]').first());
    await capturar(proto, 'prototipo-ficha.png', proto.getByText('Trilha e responsabilização'));
    await proto.setViewportSize({ width: 760, height: 800 });
    await capturar(proto, 'prototipo-lista-760.png', proto.locator('tr[data-row]').first());
    await proto.setViewportSize({ width: 1280, height: 800 });
    for (const item of ABAS_PROTOTIPO) {
      await abrirPrototipo(proto);
      await proto.getByRole('tab', { name: item.aba, exact: true }).click();
      await capturar(proto, item.arquivo, proto.getByText(item.chave).first());
    }
    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: '+ Novo registro' }).click();
    await capturar(proto, 'prototipo-drawer.png', proto.getByRole('dialog', { name: `Formulário de ${TITULO}` }).getByRole('button', { name: 'Salvar rascunho ilustrativo' }));
    await abrirPrototipo(proto);
    await proto.getByRole('button', { name: /Ações do processo/ }).click();
    await capturar(proto, 'prototipo-processo.png', proto.getByRole('dialog', { name: 'Ações do processo' }).getByText('Comandos de negócio'));
    await proto.close();

    const page = await abrirComo(browser, baseURL, ADMIN_EMAIL, senhaAdmin);
    await page.goto('/erp/contabilidade/plano-de-contas');
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(plano.sufixo);
    await expect(page.locator('.plano-grade tbody tr')).toHaveCount(6, { timeout: 30_000 });
    await capturar(page, 'app-lista.png', page.locator('.plano-grade').getByText('Suspenso', { exact: true }));
    // Abaixo de 800px cada linha vira cartão (Task 6): a mesma lista a 760px.
    await page.setViewportSize({ width: 760, height: 800 });
    await capturar(page, 'app-lista-760.png', page.locator('.plano-grade tbody tr').first());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.getByRole('cell', { name: `Despesas gerais ${plano.sufixo}`, exact: true }).click();
    await capturar(page, 'app-ficha.png', page.getByRole('tabpanel').getByText('Trilha e responsabilização'));
    for (const item of ABAS_APP) {
      await page.getByRole('tab', { name: item.aba, exact: true }).click();
      await expect(page.getByRole('tab', { name: item.aba, exact: true })).toHaveAttribute('aria-selected', 'true');
      await capturar(page, item.arquivo, page.getByRole('tabpanel').getByText(item.chave).first());
    }
    await page.getByRole('tab', { name: 'Ficha e campos', exact: true }).click();

    await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: TITULO, exact: true });
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Criar', exact: true }));
    await drawer.getByRole('button', { name: 'Pesquisar conta contábil', exact: true }).click();
    const lookup = page.getByRole('dialog', { name: 'Selecionar Conta contábil', exact: true });
    await capturar(page, 'app-lookup.png', lookup.getByRole('button', { name: new RegExp(`Grupo do ativo ${plano.sufixo}`) }));
    await lookup.getByRole('button', { name: 'Fechar', exact: true }).click();
    await drawer.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Ações do processo', exact: true }).click();
    const processo = page.getByRole('dialog', { name: 'Ações e decisões do processo' });
    await capturar(page, 'app-processo.png', processo.getByRole('button', { name: 'Abrir decisão →', exact: true }));
    await page.keyboard.press('Escape');
    await expect(processo).toBeHidden();

    await page.getByRole('button', { name: 'Revisar competência', exact: true }).click();
    const modal = page.getByRole('dialog', { name: /Ação do domínio: Revisar competência/ });
    await capturar(page, 'app-modal.png', modal.getByLabel('Justificativa / observação', { exact: true }));
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(modal).toBeHidden();

    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(`sem-resultado-${plano.sufixo}`);
    await capturar(page, 'app-vazio.png', page.getByText(/Nenhum resultado para o período, filtro ou situação escolhidos/));

    await page.route('**/api/contabilidade/plano?*', (rota) => rota.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Serviço de contabilidade indisponível.' }),
    }));
    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(plano.sufixo);
    await capturar(page, 'app-erro-retry.png', page.getByRole('alert').getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/contabilidade/plano?*');
    await page.context().close();

    const comercial = await abrirComo(browser, baseURL, COMERCIAL_EMAIL, COMERCIAL_SENHA);
    await comercial.goto('/erp/contabilidade/plano-de-contas');
    await capturar(comercial, 'app-403.png', comercial.getByText('Acesso não permitido', { exact: true }));
    await comercial.context().close();
  });
});
