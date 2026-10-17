/**
 * E09-T02 — captura de evidências fail-hard. Gera os PNG de docs/evidencias/e09-t02 (app × protótipo),
 * com um elemento-chave visível antes de cada screenshot. Captura cega não passa.
 */
import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarPlanoDaJornada, criarPoliticas, type PlanoDaJornada } from './helpers/e09-t02-seed';
import { ADMIN_EMAIL, loginBackend } from './helpers/onda6-seed';

const TITULO = 'Políticas de contabilização';
const OUT_DIR = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'e09-t02');
const PROTO_URL = `${pathToFileURL(path.join(__dirname, '..', '..', '..', 'docs', 'prototipos', 'erp-integrado-v1', 'index.html')).href}#E09-T02`;

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
  { aba: 'Regras e validações', arquivo: 'app-regras.png', chave: 'origem imutável, não lançar sem mapeamento correto, balanceamento exato' },
  { aba: 'Exceções', arquivo: 'app-excecoes.png', chave: 'Bloqueio / exceção: Mapeamento ausente.' },
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

async function abrirComo(browser: Browser, baseURL: string, email: string, senha: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(() => sessionStorage.removeItem('politicas-de-contabilizacao'));
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

test.describe('E09-T02 evidências app × protótipo', () => {
  test.use({ actionTimeout: 20_000, viewport: { width: 1280, height: 800 } });

  let plano: PlanoDaJornada;
  let senhaAdmin: string;

  test.beforeAll(async ({ request }) => {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    senhaAdmin = (await loginBackend(request)).password;
    plano = await criarPlanoDaJornada(request);
    await criarPoliticas(request, plano, 3);
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
    await page.goto('/erp/contabilidade/politicas-de-contabilizacao');
    await expect(page.getByRole('heading', { name: TITULO, level: 1 })).toBeVisible({ timeout: 60_000 });
    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(plano.debitoNome);
    await expect(page.locator('.politicas-grade tbody tr')).toHaveCount(3, { timeout: 30_000 });
    await expect(page.getByText('Carregando…', { exact: true })).toBeHidden({ timeout: 30_000 });
    await capturar(page, 'app-lista.png', page.locator('.politicas-grade').getByText('Rascunho', { exact: true }).first());
    // Abaixo de 800px cada linha vira cartão (Task 6): a mesma lista a 760px.
    await page.setViewportSize({ width: 760, height: 800 });
    await capturar(page, 'app-lista-760.png', page.locator('.politicas-grade tbody tr').first());
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('.politicas-grade tbody tr').nth(1).click();
    await capturar(page, 'app-ficha.png', page.getByRole('tabpanel').getByText('Trilha e responsabilização'));
    for (const item of ABAS_APP) {
      await page.getByRole('tab', { name: item.aba, exact: true }).click();
      await expect(page.getByRole('tab', { name: item.aba, exact: true })).toHaveAttribute('aria-selected', 'true');
      await capturar(page, item.arquivo, page.getByRole('tabpanel').getByText(item.chave).first());
    }
    await page.getByRole('tab', { name: 'Ficha e campos', exact: true }).click();

    await page.getByRole('button', { name: '+ Novo registro', exact: true }).click();
    const drawer = page.getByRole('dialog', { name: TITULO, exact: true });
    await expect(drawer.getByLabel('Conta de débito', { exact: true }).locator('option', { hasText: plano.debitoNome })).toHaveCount(1);
    await capturar(page, 'app-drawer.png', drawer.getByRole('button', { name: 'Configurar mappings', exact: true }));
    await drawer.getByRole('button', { name: 'Pesquisar conta de débito', exact: true }).click();
    const lookup = page.getByRole('dialog', { name: 'Selecionar Conta de débito', exact: true });
    await lookup.getByLabel('Pesquisar cadastro', { exact: true }).fill(plano.sufixo);
    await capturar(page, 'app-lookup.png', lookup.getByRole('button', { name: new RegExp(plano.debitoNome) }));
    await lookup.getByRole('button', { name: 'Fechar', exact: true }).click();
    await drawer.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: 'Ações do processo', exact: true }).click();
    const processo = page.getByRole('dialog', { name: 'Ações e decisões do processo' });
    await capturar(page, 'app-processo.png', processo.getByText('Comandos de negócio'));
    await page.keyboard.press('Escape');
    await expect(processo).toBeHidden();

    await page.getByRole('button', { name: 'Simular evento', exact: true }).click();
    const modal = page.getByRole('dialog', { name: /Ação do domínio: Simular evento/ });
    await capturar(page, 'app-modal.png', modal.getByLabel('Valor', { exact: true }));
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(modal).toBeHidden();

    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(`sem-resultado-${plano.sufixo}`);
    await capturar(page, 'app-vazio.png', page.getByText(/Nenhum resultado para o período, filtro ou situação escolhidos/));

    await page.route('**/api/contabilidade/politicas?*', (rota) => rota.fulfill({
      status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Serviço de contabilidade indisponível.' }),
    }));
    await page.getByLabel('Buscar registros da lista', { exact: true }).fill(plano.debitoNome);
    await capturar(page, 'app-erro-retry.png', page.getByRole('alert').getByRole('button', { name: 'Tentar novamente' }));
    await page.unroute('**/api/contabilidade/politicas?*');
    await page.context().close();
  });
});
