import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

function readEnvFile(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) return {};
  const values: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    values[trimmed.slice(0, separator).trim()] = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return values;
}

const ROOT_ENV = readEnvFile(path.join(__dirname, '..', '..', '..', '.env'));
const ADMIN_EMAIL =
  process.env.SEED_ADMIN_EMAIL ?? ROOT_ENV.SEED_ADMIN_EMAIL ?? 'admin@alphacarnes.local';
const ADMIN_PASSWORD =
  process.env.SEED_ADMIN_PASSWORD ?? ROOT_ENV.SEED_ADMIN_PASSWORD ?? 'change-me-admin-password';

const EVIDENCIAS = path.join(__dirname, '..', '..', '..', 'docs', 'evidencias', 'onda12-dominio-campos-ui');

function cookiesFromResponse(
  response: import('@playwright/test').APIResponse,
  baseURL: string,
) {
  return response
    .headersArray()
    .filter((header) => header.name.toLowerCase() === 'set-cookie')
    .map((header) => {
      const [nameValue] = header.value.split(';');
      const separator = nameValue.indexOf('=');
      return {
        name: nameValue.slice(0, separator),
        value: nameValue.slice(separator + 1),
        url: baseURL,
      };
    });
}

async function login(page: Page, request: APIRequestContext, baseURL: string) {
  const loginRes = await request.post('/api/auth/login', {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    headers: { 'content-type': 'application/json' },
  });
  expect(loginRes.ok(), `login falhou: ${loginRes.status()} ${await loginRes.text()}`).toBeTruthy();
  await page.context().addCookies(cookiesFromResponse(loginRes, baseURL));
}

async function shot(page: Page, nome: string) {
  fs.mkdirSync(EVIDENCIAS, { recursive: true });
  await page.screenshot({
    path: path.join(EVIDENCIAS, nome),
    fullPage: true,
  });
}

function dvCnpj(nums: number[], fatores: number[]): number {
  const soma = nums.reduce((acc, n, i) => acc + n * fatores[i]!, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cnpjDeSemente(semente: number): string {
  const base = semente.toString().padStart(12, '1').slice(-12);
  const nums = base.split('').map(Number);
  const d1 = dvCnpj(nums, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dvCnpj([...nums, d1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${d1}${d2}`;
}

async function postJson(request: APIRequestContext, url: string, body: unknown) {
  const res = await request.post(url, {
    data: body,
    headers: { 'content-type': 'application/json' },
  });
  const texto = await res.text();
  expect(res.ok(), `${url} ${res.status()} ${texto}`).toBeTruthy();
  return texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
}

async function abrirEFiltrar(page: Page, nome: string | RegExp, busca: string, placeholder: string | RegExp) {
  await page.getByRole('combobox', { name: nome, exact: true }).click();
  await page.getByPlaceholder(placeholder).fill(busca);
}

async function assertOpcao(page: Page, label: string, presente: boolean) {
  const opcao = page.getByRole('option', { name: label, exact: true });
  if (presente) {
    await expect(opcao).toBeVisible();
  } else {
    await expect(opcao).toHaveCount(0);
  }
}

test.describe('Onda 12 — domínio de campos na UI', () => {
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(async ({ page, request, baseURL }) => {
    await login(page, request, baseURL!);
  });

  test('DoD 12.1 redirects de cliente e busca representante/rota', async ({ page }) => {
    await page.goto('/cadastros/clientes', { waitUntil: 'domcontentloaded' });
    expect(page.url()).toContain('/comercial/clientes');
    await page.goto('/comercial/clientes', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await expect(page.getByRole('combobox', { name: 'Representante' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Itinerário / Rota' })).toBeVisible();
    await shot(page, '01-clientes.png');
  });

  test('DoD 12.10 cliente mantém Nome Fantasia/Marca e UF', async ({ page }) => {
    await page.goto('/comercial/clientes', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await expect(page.getByLabel('Nome Fantasia/Marca')).toBeVisible();
    await expect(page.getByLabel(/^Marca$/)).toHaveCount(0);
    await page.getByRole('tab', { name: 'Dados Fiscais & Endereço' }).click();
    await expect(page.getByLabel('UF')).toBeVisible();
    await shot(page, '01b-clientes-ad13.png');
  });

  test('DoD 12.9 cliente UF controlada e DoD 12.2 unidade controlada', async ({ page }) => {
    await page.goto('/cadastros/produtos', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo Produto' }).click();
    await page.getByRole('tab', { name: 'Operacional' }).click();
    await expect(page.getByLabel('Unidade do pedido')).toBeVisible();
    await shot(page, '02-produtos.png');

    const itensCompra = await page.goto('/cadastros/itens-compra', { waitUntil: 'domcontentloaded' });
    expect(itensCompra?.status()).toBe(404);
    await expect(page.getByLabel('Unidade de Compra')).toHaveCount(0);
    await shot(page, '03-produtos.png');

    const itensComerciais = await page.goto('/cadastros/itens-comerciais', { waitUntil: 'domcontentloaded' });
    expect(itensComerciais?.status()).toBe(404);
    await expect(page.getByLabel('Unidade Comercial')).toHaveCount(0);
    await shot(page, '04-produtos.png');
  });

  test('DoD 12.5 pedido busca produto e rota herdada', async ({ page }) => {
    await page.goto('/comercial/pedidos', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Novo Pedido' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Produto' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Rota', exact: true })).toBeVisible();
    await shot(page, '05-pedido.png');
  });

  test('DoD 12.4 compras e espelho pesquisáveis', async ({ page }) => {
    await page.goto('/gestao/compras', { waitUntil: 'load' });
    await expect(page.getByRole('combobox', { name: 'Fornecedor' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Item de compra' })).toBeVisible();
    await shot(page, '06-compras.png');

    await page.goto('/comercial/espelho', { waitUntil: 'load' });
    await expect(page.getByRole('combobox', { name: 'Vendedor / representante' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Rota' })).toBeVisible();
    await shot(page, '07-espelho.png');
  });

  test('DoD 12.6 rota três padrões e frota UF', async ({ page }) => {
    await page.goto('/cadastros/rotas', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo' }).click();
    await expect(page.getByRole('combobox', { name: 'Representante padrão' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Caminhão padrão' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Motorista padrão' })).toBeVisible();
    await shot(page, '08-rotas.png');

    await page.goto('/cadastros/caminhoes', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo Caminhão' }).click();
    await expect(page.getByRole('combobox', { name: 'Rota padrão' })).toBeVisible();
    await expect(page.getByLabel('Certificado (UF)')).toBeVisible();
    await shot(page, '09-caminhoes.png');

    await page.goto('/cadastros/motoristas', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo Motorista' }).click();
    await expect(page.getByRole('combobox', { name: 'Caminhão padrão' })).toBeVisible();
    await shot(page, '10-motoristas.png');
  });

  test('DoD 12.7 carga sugere motorista/rota', async ({ page }) => {
    await page.goto('/carga/planejamento', { waitUntil: 'load' });
    await expect(page.getByRole('combobox', { name: 'Caminhão da frota' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Motorista' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Rota', exact: true })).toBeVisible();
    await shot(page, '11-carga.png');
  });

  test('DoD 12.8 estoque fornecedor pesquisável', async ({ page }) => {
    await page.goto('/estoque/entrada-itens', { waitUntil: 'load' });
    await expect(page.getByRole('combobox', { name: 'Fornecedor/origem' })).toBeVisible();
    await shot(page, '12-estoque.png');
  });

  test('DoD 12.3 pré-faturamento placa sem UUID', async ({ page }) => {
    await page.goto('/faturamento/pre-faturamento', { waitUntil: 'load' });
    await expect(page.getByText('Selecione uma carga abaixo para consultar a consolidação.')).toBeVisible();
    await expect(page.getByLabel('ID do Caminhão')).toHaveCount(0);
    await expect(page.getByPlaceholder('UUID do caminhão')).toHaveCount(0);
    await shot(page, '13-pre-faturamento.png');
  });

  test('DoD 12.4 auditoria usuário e etiquetas recebimento', async ({ page }) => {
    await page.goto('/admin/auditoria', { waitUntil: 'load' });
    await expect(page.getByRole('combobox', { name: 'Usuário' })).toBeVisible();
    await shot(page, '14-auditoria.png');

    await page.goto('/recebimento/etiquetas', { waitUntil: 'load' });
    await expect(page.locator('#etiqueta-recebimento')).toBeVisible();
    await shot(page, '15-etiquetas.png');
  });

  test('DoD 12.11 regra criar e ver codigo+nome', async ({ page, request }) => {
    const suffix = `r${Date.now().toString(36).slice(-6)}`;
    const compra = {
      codigo: `CR${suffix}`,
      nome: `Compra Regra ${suffix}`,
      label: `CR${suffix} — Compra Regra ${suffix}`,
    };
    const comercial = {
      codigo: `MR${suffix}`,
      nome: `Comercial Regra ${suffix}`,
      label: `MR${suffix} — Comercial Regra ${suffix}`,
    };
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoCompra=true', {
      codigo: compra.codigo,
      nome: compra.descricao,
      unidadePedido: 'unidade',
      status: 'ativo',
    });
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoVenda=true', {
      codigo: comercial.codigo,
      nome: comercial.descricao,
      unidadePedido: 'kg',
      status: 'ativo',
    });

    await page.goto('/cadastros/regras-transformacao', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Nova regra' }).click();
    await abrirEFiltrar(page, 'Item de compra', compra.codigo, 'Buscar item de compra...');
    await page.getByRole('option', { name: compra.label, exact: true }).click();
    await abrirEFiltrar(page, 'Item comercial', comercial.codigo, 'Buscar item comercial...');
    await page.getByRole('option', { name: comercial.label, exact: true }).click();
    await page.getByRole('button', { name: 'Salvar regra' }).click();
    await expect(page.getByText(comercial.label, { exact: true })).toBeVisible();
    await expect(page.getByText(compra.label, { exact: true })).toBeVisible();
    await shot(page, '16-regras.png');
  });

  test('DoD 12.12 fornecedor parâmetros sobrevivem', async ({ page, request }) => {
    const suffix = Date.now().toString(36).slice(-6);
    const codigo = `FP${suffix}`;
    const razao = `Fornecedor Params ${suffix}`;
    const criado = await postJson(request, '/api/cadastros/fornecedores', {
      codigo,
      razaoSocial: razao,
      documentoFiscal: cnpjDeSemente(Date.now()),
      status: 'ativo',
      parametrosOperacionaisJson: {
        horarioLimiteRecebimento: '14:30',
        capacidadeMaximaKg: 18000,
        toleranciaDivergenciaPercentual: 2.5,
        notaQualidade: 'A',
      },
    });
    const id = String(criado.id);

    await page.goto(`/cadastros/fornecedores/${id}/editar`, { waitUntil: 'load' });
    await expect(page.getByLabel('Horário Limite Recebimento')).toHaveValue('14:30');
    await expect(page.getByLabel('Capacidade Max. Caminhão (kg)')).toHaveValue('18000');
    await expect(page.getByLabel('Tolerância de Divergência (%)')).toHaveValue('2.5');
    await expect(page.getByLabel('Nota de Qualidade')).toHaveValue('A');
    await page.getByLabel('Horário Limite Recebimento').fill('16:45');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await page.waitForURL('**/cadastros/fornecedores', { timeout: 20_000 });

    await page.goto(`/cadastros/fornecedores/${id}/editar`, { waitUntil: 'load' });
    await expect(page.getByLabel('Horário Limite Recebimento')).toHaveValue('16:45');
    await expect(page.getByLabel('Capacidade Max. Caminhão (kg)')).toHaveValue('18000');
    await expect(page.getByLabel('Tolerância de Divergência (%)')).toHaveValue('2.5');
    await expect(page.getByLabel('Nota de Qualidade')).toHaveValue('A');

    await page.goto('/cadastros/fornecedores', { waitUntil: 'load' });
    await page.getByPlaceholder('Buscar...').fill(codigo);
    await page.getByPlaceholder('Buscar...').press('Enter');
    await page.getByRole('button', { name: new RegExp(razao) }).click();
    await expect(page.getByLabel('Horário Limite Recebimento')).toHaveValue('16:45');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alterações salvas.')).toBeVisible();
    await shot(page, '17-fornecedores.png');
  });

  test('DoD 12.4 todas as superfícies SAM-160 oferecem pesquisa', async ({ page }) => {
    const superficies: Array<[string, string | RegExp, (() => Promise<void>) | undefined]> = [
      ['/comercial/clientes', 'Representante', async () => {
        await page.getByRole('button', { name: 'Novo cliente' }).click();
      }],
      ['/comercial/pedidos', 'Buscar cliente', async () => {
        await page.getByRole('button', { name: 'Novo pedido' }).click();
        await expect(page.getByRole('heading', { name: 'Novo Pedido' })).toBeVisible();
      }],
      ['/gestao/compras', 'Fornecedor', undefined],
      ['/comercial/espelho', 'Rota', undefined],
      ['/cadastros/rotas', 'Representante padrão', async () => {
        await page.getByRole('button', { name: 'Novo' }).click();
      }],
      ['/carga/planejamento', 'Motorista', undefined],
      ['/estoque/entrada-itens', 'Fornecedor/origem', undefined],
      ['/admin/auditoria', 'Usuário', undefined],
    ];
    for (const [rota, nome, preparar] of superficies) {
      await page.goto(rota, { waitUntil: 'load' });
      if (preparar) await preparar();
      await expect(page.getByRole('combobox', { name: nome }).first()).toBeVisible();
    }
  });

  test('DoD 12.4b criação nunca oferece cadastro inativo', async ({ page, request }) => {
    const suffix = Date.now().toString(36).slice(-6);
    const inativo = {
      rota: { codigo: `ZI${suffix}`, nome: `Rota Inativa ${suffix}`, label: `ZI${suffix} — Rota Inativa ${suffix}` },
      fornecedor: {
        codigo: `FI${suffix}`,
        razaoSocial: `Fornecedor Inativo ${suffix}`,
        label: `FI${suffix} — Fornecedor Inativo ${suffix}`,
      },
      itemCompra: {
        codigo: `CI${suffix}`,
        nome: `Compra Inativa ${suffix}`,
        label: `CI${suffix} — Compra Inativa ${suffix}`,
      },
      itemComercial: {
        codigo: `MI${suffix}`,
        nome: `Comercial Inativo ${suffix}`,
        label: `MI${suffix} — Comercial Inativo ${suffix}`,
      },
    };
    const ativo = {
      rota: { codigo: `ZA${suffix}`, nome: `Rota Ativa ${suffix}`, label: `ZA${suffix} — Rota Ativa ${suffix}` },
      fornecedor: {
        codigo: `FA${suffix}`,
        razaoSocial: `Fornecedor Ativo ${suffix}`,
        label: `FA${suffix} — Fornecedor Ativo ${suffix}`,
      },
      itemCompra: {
        codigo: `CA${suffix}`,
        nome: `Compra Ativa ${suffix}`,
        label: `CA${suffix} — Compra Ativa ${suffix}`,
      },
      itemComercial: {
        codigo: `MA${suffix}`,
        nome: `Comercial Ativo ${suffix}`,
        label: `MA${suffix} — Comercial Ativo ${suffix}`,
      },
    };

    await postJson(request, '/api/cadastros/rotas', {
      codigo: inativo.rota.codigo,
      nome: inativo.rota.nome,
      status: 'inativo',
      paradas: [],
      diasAtendimento: [],
    });
    await postJson(request, '/api/cadastros/rotas', {
      codigo: ativo.rota.codigo,
      nome: ativo.rota.nome,
      status: 'ativo',
      paradas: [],
      diasAtendimento: [],
    });
    await postJson(request, '/api/cadastros/fornecedores', {
      codigo: inativo.fornecedor.codigo,
      razaoSocial: inativo.fornecedor.razaoSocial,
      documentoFiscal: cnpjDeSemente(Date.now() + 1),
      status: 'inativo',
    });
    await postJson(request, '/api/cadastros/fornecedores', {
      codigo: ativo.fornecedor.codigo,
      razaoSocial: ativo.fornecedor.razaoSocial,
      documentoFiscal: cnpjDeSemente(Date.now() + 2),
      status: 'ativo',
    });
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoCompra=true', {
      codigo: inativo.itemCompra.codigo,
      nome: inativo.itemCompra.descricao,
      unidadePedido: 'unidade',
      status: 'inativo',
    });
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoCompra=true', {
      codigo: ativo.itemCompra.codigo,
      nome: ativo.itemCompra.descricao,
      unidadePedido: 'unidade',
      status: 'ativo',
    });
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoVenda=true', {
      codigo: inativo.itemComercial.codigo,
      nome: inativo.itemComercial.descricao,
      unidadePedido: 'kg',
      status: 'inativo',
    });
    await postJson(request, '/api/cadastros/produtos?page=1&pageSize=100&status=ativo&ativoVenda=true', {
      codigo: ativo.itemComercial.codigo,
      nome: ativo.itemComercial.descricao,
      unidadePedido: 'kg',
      status: 'ativo',
    });

    await page.goto('/comercial/clientes', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo cliente' }).click();
    await abrirEFiltrar(page, 'Itinerário / Rota', suffix, 'Buscar rota');
    await assertOpcao(page, inativo.rota.label, false);
    await assertOpcao(page, ativo.rota.label, true);
    await page.keyboard.press('Escape');

    await page.goto('/comercial/pedidos', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Novo pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Novo Pedido' })).toBeVisible();
    await abrirEFiltrar(page, 'Rota', suffix, 'Buscar rota...');
    await assertOpcao(page, inativo.rota.label, false);
    await assertOpcao(page, ativo.rota.label, true);
    await page.keyboard.press('Escape');
    await abrirEFiltrar(page, 'Produto', suffix, 'Buscar produto...');
    await assertOpcao(page, inativo.itemComercial.label, false);
    await assertOpcao(page, ativo.itemComercial.label, true);
    await page.keyboard.press('Escape');

    await page.goto('/estoque/entrada-itens', { waitUntil: 'load' });
    await abrirEFiltrar(page, 'Fornecedor/origem', suffix, 'Buscar fornecedor…');
    await assertOpcao(page, inativo.fornecedor.label, false);
    await assertOpcao(page, ativo.fornecedor.label, true);
    await page.keyboard.press('Escape');

    await page.goto('/gestao/compras', { waitUntil: 'load' });
    await abrirEFiltrar(page, 'Item de compra', suffix, 'Buscar item de compra...');
    await assertOpcao(page, inativo.itemCompra.label, false);
    await assertOpcao(page, ativo.itemCompra.label, true);
    await page.keyboard.press('Escape');

    await page.goto('/cadastros/regras-transformacao', { waitUntil: 'load' });
    await page.getByRole('button', { name: 'Nova regra' }).click();
    await abrirEFiltrar(page, 'Item de compra', suffix, 'Buscar item de compra...');
    await assertOpcao(page, inativo.itemCompra.label, false);
    await assertOpcao(page, ativo.itemCompra.label, true);
    await page.keyboard.press('Escape');
    await abrirEFiltrar(page, 'Item comercial', suffix, 'Buscar item comercial...');
    await assertOpcao(page, inativo.itemComercial.label, false);
    await assertOpcao(page, ativo.itemComercial.label, true);
  });
});
