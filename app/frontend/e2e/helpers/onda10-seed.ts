/**
 * Seed HTTP da Onda 10 — monta um caminhão FECHADO com 1 pedido/peça, pronto
 * para a jornada de UI de faturamento (pré-faturamento → notas/XML → seguro
 * manual → liberação). Reusa o padrão de `onda9-seed.ts`.
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

/** Gera um CNPJ (14 dígitos) com dígitos verificadores válidos (mesmo algoritmo do backend). */
function makeCnpj(seed: number): string {
  const baseNumber = 10_000_000 + (Math.abs(seed) % 89_999_999);
  const base12 = `${String(baseNumber).padStart(8, '0')}0001`; // 8 dígitos + filial 0001
  const digitos = base12.split('').map(Number);
  const calcularDigito = (qtd: number): number => {
    let soma = 0;
    let peso = 2;
    for (let i = qtd - 1; i >= 0; i--) {
      soma += (digitos[i] ?? 0) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calcularDigito(12);
  digitos.push(d1);
  const d2 = calcularDigito(13);
  digitos.push(d2);
  return digitos.join('');
}

export interface CenarioOnda10 {
  cookieHeader: string;
  password: string;
  dataOperacao: string;
  caminhaoId: string;
  placa: string;
  motorista: string;
  pecaId: string;
  pedidoVendaId: string;
}

/**
 * Monta: fornecedor/item/regra → compra confirmada → PF enviado → recebimento
 * concluído → cliente CNPJ válido → pedido de venda → peça pesada/associada/
 * etiquetada → caminhão criado, carga aberta+conferida+FECHADA (pronto para
 * consolidar/emitir NFS-e).
 */
export async function seedCaminhaoFechado(request: APIRequestContext): Promise<CenarioOnda10> {
  const { cookieHeader, password } = await loginBackend(request);
  const runId = Date.now().toString(36);
  const suffix = runId.slice(-6);
  const seedNum = Number(String(Date.now()).slice(-9));

  const fornecedor = await api<{ id: string }>(request, cookieHeader, 'POST', '/fornecedores', {
    codigo: `O10F${suffix}`,
    razaoSocial: `Fornecedor Onda10 ${suffix}`,
    documentoFiscal: makeCnpj(seedNum),
  });
  const itemCompra = await api<{ id: string }>(request, cookieHeader, 'POST', '/itens-compra', {
    codigo: `O10IC${suffix}`,
    descricao: 'Boi Onda10',
    unidadeCompra: 'cabeca',
  });
  const itemComercial = await api<{ id: string }>(request, cookieHeader, 'POST', '/itens-comerciais', {
    codigo: `O10TZ${suffix}`,
    descricao: 'Traseiro Onda10',
    unidadeComercial: 'parte',
  });
  await api(request, cookieHeader, 'POST', '/regras-desdobramento', {
    itemCompraId: itemCompra.id,
    itemComercialId: itemComercial.id,
    fatorQuantidade: 2,
    status: 'ativo',
    vigenciaInicio: addDaysISO(-1),
  });

  let compraId = '';
  let dataOperacao = '';
  for (let offset = 0; offset < 60; offset += 1) {
    const candidata = addDaysISO(offset);
    const create = await request.post(`${BACKEND_URL}/comercial/compras-programadas`, {
      headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
      data: {
        dataOperacao: candidata,
        fornecedorId: fornecedor.id,
        numeroInterno: `O10-${runId}-${offset}`,
        itens: [{ itemCompraId: itemCompra.id, quantidadeComprada: 5 }],
      },
    });
    const body = (await create.json().catch(() => ({}))) as { id?: string };
    if (create.status() === 409) continue;
    if (!create.ok() || !body.id) {
      throw new Error(`Criar compra Onda10: ${create.status()} ${JSON.stringify(body)}`);
    }
    await api(request, cookieHeader, 'POST', `/comercial/compras-programadas/${body.id}/confirmar`);
    compraId = body.id;
    dataOperacao = candidata;
    break;
  }
  if (!compraId) throw new Error('Seed Onda 10: sem data livre para compra');

  const pf = await api<{ id: string }>(request, cookieHeader, 'POST', '/operacao/pedidos-fornecedor', {
    compraProgramadaId: compraId,
  });
  await api(request, cookieHeader, 'POST', `/operacao/pedidos-fornecedor/${pf.id}/enviar`);

  const ini = await api<{ recebimento?: { id: string }; id?: string }>(
    request, cookieHeader, 'POST', '/operacao/recebimentos', { pedidoFornecedorId: pf.id },
  );
  const recebimentoId = ini.recebimento?.id ?? ini.id;
  if (!recebimentoId) throw new Error(`Seed Onda10: iniciar recebimento sem id: ${JSON.stringify(ini)}`);

  await api(request, cookieHeader, 'PATCH', `/operacao/recebimentos/${recebimentoId}/nfe`, {
    nfeNumero: `O10${suffix}`,
    nfeSerie: '1',
  });

  type RecebimentoDetalhe = { itens: Array<{ itemComercialId: string; quantidadeEsperada: string | number }> };
  const detalhe = await api<RecebimentoDetalhe>(request, cookieHeader, 'GET', `/operacao/recebimentos/${recebimentoId}`);
  for (const item of detalhe.itens) {
    await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/itens`, {
      itemComercialId: item.itemComercialId,
      quantidadeRecebida: Number(item.quantidadeEsperada),
    });
  }
  await api(request, cookieHeader, 'POST', `/operacao/recebimentos/${recebimentoId}/concluir`);

  // Cliente com CNPJ válido (14 dígitos) — exigência dos bloqueios fiscais de emissão.
  const cliente = await api<{ id: string }>(request, cookieHeader, 'POST', '/clientes', {
    codigo: `O10CLI${suffix}`,
    razaoSocial: `Cliente Onda10 ${suffix}`,
    documentoFiscal: makeCnpj(seedNum + 1),
    dadosFiscaisJson: {
      logradouro: 'Rua Onda10', numero: '10', bairro: 'Centro',
      cidade: 'Osasco', uf: 'SP', cep: '06010000', codigo_ibge: '3534401',
    },
  });
  const pedido = await api<{ id: string }>(request, cookieHeader, 'POST', '/comercial/pedidos', {
    compraProgramadaId: compraId,
    clienteId: cliente.id,
    dataOperacao,
    rotaPrevista: 'Rota Onda10',
    itens: [{ itemComercialId: itemComercial.id, quantidadePedida: 1 }],
  });
  const pedidoDetalhe = await api<{ itens: Array<{ id: string }> }>(
    request, cookieHeader, 'GET', `/comercial/pedidos/${pedido.id}`,
  );
  const pedidoItemId = pedidoDetalhe.itens[0]?.id;
  if (!pedidoItemId) throw new Error('Seed Onda10: pedido sem itens');

  const peca = await api<{ id: string }>(request, cookieHeader, 'POST', '/operacao/pesagem/pecas', {
    recebimentoId,
    itemComercialBaseId: itemComercial.id,
    modoCaptura: 'automatico',
  });
  await api(request, cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/confirmar`, {
    pedidoVendaItemId: pedidoItemId,
  });
  await api(request, cookieHeader, 'POST', `/operacao/pesagem/pecas/${peca.id}/etiqueta`, {});

  const placa = `O10-${suffix}`.toUpperCase();
  const motorista = 'Motorista Onda10';
  const caminhao = await api<{ id: string; placa: string }>(request, cookieHeader, 'POST', '/operacao/expedicao/caminhoes', {
    placa,
    motorista,
    rota: 'Rota Onda10',
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
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/iniciar`, {});
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/registrar-item`, {
    tipoOrigem: 'peca', modoCaptura: 'manual_assistido', codigo: `QR-${peca.id}`, motivo: 'Seed E2E — leitor fake sem endpoint HTTP de configuração',
  });
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/conferencia/concluir`, {});
  await api(request, cookieHeader, 'POST', `/operacao/expedicao/caminhoes/${caminhao.id}/fechar`, {});

  return {
    cookieHeader,
    password,
    dataOperacao,
    caminhaoId: caminhao.id,
    placa: caminhao.placa,
    motorista,
    pecaId: peca.id,
    pedidoVendaId: pedido.id,
  };
}
