/**
 * Seed HTTP da Onda 9 — monta um caminhão com 1 peça elegível carregada,
 * pronto para a jornada de UI (planejamento → conferência → enviar faturamento).
 *
 * Reusa o padrão de `onda6-seed.ts` (login admin via API, sem E2E_* externo).
 */
import type { APIRequestContext } from '@playwright/test';
import { BACKEND_URL, loginBackend } from './onda6-seed';

async function api<T>(
  request: APIRequestContext,
  cookieHeader: string,
  method: 'GET' | 'POST' | 'PATCH',
  route: string,
  body?: unknown,
): Promise<T> {
  const res = await request.fetch(`${BACKEND_URL}${route}`, {
    method,
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
    data: body,
  });
  const data = (await res.json().catch(async () => ({ raw: await res.text() }))) as T | { message?: unknown };
  if (!res.ok()) {
    throw new Error(`${method} ${route} → ${res.status()}: ${JSON.stringify(data)}`);
  }
  return data as T;
}

function addDaysISO(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function makeCpf(seed: number): string {
  const baseNumber = 100_000_000 + (Math.abs(seed) % 899_999_999);
  const digits = String(baseNumber).padStart(9, '0').split('').map(Number);
  const digit = (count: number) => {
    let sum = 0;
    for (let i = 0; i < count; i += 1) sum += (digits[i] ?? 0) * (count + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  digits.push(digit(9));
  digits.push(digit(10));
  return digits.join('');
}

export interface CenarioOnda9 {
  cookieHeader: string;
  password: string;
  dataOperacao: string;
  caminhaoId: string;
  placa: string;
  pecaId: string;
  etiqueta: string;
  pedidoVendaId: string;
}

/**
 * Monta: fornecedor/item/regra → compra confirmada → PF enviado → recebimento
 * concluído → pedido de venda → peça pesada/associada/etiquetada → caminhão
 * criado, carga aberta, peça adicionada (status em_carga, pronto p/ conferência).
 */
export async function seedCargaPronta(request: APIRequestContext): Promise<CenarioOnda9> {
  const { cookieHeader, password } = await loginBackend(request);
  const runId = Date.now().toString(36);
  const suffix = runId.slice(-6);
  const seedNum = Number(String(Date.now()).slice(-9));

  const fornecedor = await api<{ id: string }>(request, cookieHeader, 'POST', '/fornecedores', {
    codigo: `O9F${suffix}`,
    razaoSocial: `Fornecedor Onda9 ${suffix}`,
    documentoFiscal: makeCpf(seedNum + 1),
  });
  const itemCompra = await api<{ id: string }>(request, cookieHeader, 'POST', '/produtos', {
    codigo: `O9IC${suffix}`,
    nome: 'Boi Onda9',
    unidadePedido: 'unidade',
  });
  const itemComercial = await api<{ id: string }>(request, cookieHeader, 'POST', '/produtos', {
    codigo: `O9TZ${suffix}`,
    nome: 'Traseiro Onda9',
    unidadePedido: 'kg',
  });
  await api(request, cookieHeader, 'POST', '/regras-desdobramento', {
    produtoOrigemId: itemCompra.id,
    produtoDestinoId: itemComercial.id,
    fatorQuantidade: 2,
    status: 'ativo',
    vigenciaInicio: addDaysISO(-1),
  });

  let compraId = '';
  let dataOperacao = '';
  // offset 0 (hoje) primeiro — a UI de planejamento fixa a data em "hoje" (D9.7, sem seletor).
  for (let offset = 0; offset < 60; offset += 1) {
    const candidata = addDaysISO(offset);
    const create = await request.post(`${BACKEND_URL}/comercial/compras-programadas`, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        dataOperacao: candidata,
        fornecedorId: fornecedor.id,
        numeroInterno: `O9-${runId}-${offset}`,
        itens: [{ produtoId: itemCompra.id, quantidadeComprada: 5 }],
      },
    });
    const body = (await create.json().catch(() => ({}))) as { id?: string };
    if (create.status() === 409) continue;
    if (!create.ok() || !body.id) {
      throw new Error(`Criar compra Onda9: ${create.status()} ${JSON.stringify(body)}`);
    }
    await api(request, cookieHeader, 'POST', `/comercial/compras-programadas/${body.id}/confirmar`);
    compraId = body.id;
    dataOperacao = candidata;
    break;
  }
  if (!compraId) throw new Error('Seed Onda 9: sem data livre para compra');

  const pf = await api<{ id: string }>(request, cookieHeader, 'POST', '/operacao/pedidos-fornecedor', {
    compraProgramadaId: compraId,
  });
  await api(request, cookieHeader, 'POST', `/operacao/pedidos-fornecedor/${pf.id}/enviar`);

  const ini = await api<{ recebimento?: { id: string }; id?: string }>(
    request, cookieHeader, 'POST', '/operacao/recebimentos', { pedidoFornecedorId: pf.id },
  );
  const recebimentoId = ini.recebimento?.id ?? ini.id;
  if (!recebimentoId) throw new Error(`Seed Onda9: iniciar recebimento sem id: ${JSON.stringify(ini)}`);

  await api(request, cookieHeader, 'PATCH', `/operacao/recebimentos/${recebimentoId}/nfe`, {
    nfeNumero: `O9${suffix}`,
    nfeSerie: '1',
  });

  type RecebimentoDetalhe = { itens: Array<{ produtoId: string; quantidadeEsperada: string | number }> };
  const detalhe = await api<RecebimentoDetalhe>(request, cookieHeader, 'GET', `/operacao/recebimentos/${recebimentoId}`);
  for (const item of detalhe.itens) {
    await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/itens`, {
      produtoId: item.produtoId,
      quantidadeRecebida: Number(item.quantidadeEsperada),
    });
  }
  await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/concluir`);

  // Cliente + pedido de venda
  const cliente = await api<{ id: string }>(request, cookieHeader, 'POST', '/clientes', {
    codigo: `O9CLI${suffix}`,
    razaoSocial: `Cliente Onda9 ${suffix}`,
    documentoFiscal: makeCpf(seedNum + 2),
  });
  const pedido = await api<{ id: string }>(request, cookieHeader, 'POST', '/comercial/pedidos', {
    compraProgramadaId: compraId,
    clienteId: cliente.id,
    dataOperacao,
    rotaPrevista: 'Rota Onda9',
    prioridade: 3,
    itens: [{ produtoId: itemComercial.id, quantidadePedida: 1 }],
  });
  const pedidoDetalhe = await api<{ itens: Array<{ id: string }> }>(
    request, cookieHeader, 'GET', `/comercial/pedidos/${pedido.id}`,
  );
  const pedidoItemId = pedidoDetalhe.itens[0]?.id;
  if (!pedidoItemId) throw new Error('Seed Onda9: pedido sem itens');

  // Peça pesada, associada, etiquetada.
  const peca = await api<{ id: string }>(request, cookieHeader, 'POST', '/operacao/pesagem/pecas', {
    recebimentoId,
    produtoBaseId: itemComercial.id,
    modoCaptura: 'automatico',
  });
  await api(request, cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/confirmar`, {
    pedidoVendaItemId: pedidoItemId,
  });
  await api(request, cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/etiqueta`, {});

  // Caminhão + carga aberta + item carregado.
  const motoristaCadastro = await api<{ id: string }>(request, cookieHeader, 'POST', '/frota/motoristas', {
    nome: 'Motorista Onda9',
    documento: `O9M${suffix}`,
  });
  const caminhao = await api<{ id: string; placa: string }>(request, cookieHeader, 'POST', '/operacao/expedicao/caminhoes', {
    placa: `O9-${suffix}`.toUpperCase(),
    motoristaId: motoristaCadastro.id,
    dataOperacao,
  });
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/pedidos`, {
    pedidoVendaId: pedido.id,
  });
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/abrir-carga`, {});
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/itens`, {
    tipoOrigem: 'peca',
    id: peca.id,
  });

  return {
    cookieHeader,
    password,
    dataOperacao,
    caminhaoId: caminhao.id,
    placa: caminhao.placa,
    pecaId: peca.id,
    etiqueta: `QR-${peca.id}`,
    pedidoVendaId: pedido.id,
  };
}
