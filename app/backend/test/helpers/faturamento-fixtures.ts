import type { INestApplication } from '@nestjs/common';
import { DRIZZLE } from '../../src/database/database.module';
import * as schema from '../../src/database/schema';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { seedComercialBase } from './comercial-fixtures';
import { montarCenarioPesagem, criarPedido, pesarPeca, fakes } from './pesagem-fixtures';
import {
  criarCaminhao,
  vincularPedido,
  abrirCarga,
  adicionarPecaNaCarga,
  iniciarConferencia,
  concluirConferencia,
  fecharCaminhao,
} from './expedicao-fixtures';
import { eq } from 'drizzle-orm';

type Db = NodePgDatabase<typeof schema>;

/**
 * Cria um cliente com CNPJ válido (14 dígitos) para testes de faturamento.
 * O documento fiscal da NFS-e exige CNPJ/CPF completo; os fixtures genéricos
 * de comercial usam UIDs curtos que não passam na validação de bloqueios.
 */
async function criarClienteComCnpj(app: INestApplication): Promise<string> {
  const { db } = app.get<{ db: Db }>(DRIZZLE);
  // CNPJ de teste válido (14 dígitos); único por instância com timestamp
  const cnpj = String(Date.now()).slice(-14).padStart(14, '0');
  const [cliente] = await db
    .insert(schema.clientes)
    .values({
      codigo: `CLI-FAT-${Date.now()}`,
      razaoSocial: 'Cliente Faturamento Teste',
      documentoFiscal: cnpj,
      dadosFiscaisJson: {
        logradouro: 'Rua Teste',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Osasco',
        uf: 'SP',
        cep: '06000000',
        codigo_ibge: '3534401',
      },
      dadosContatoJson: { email: 'cliente@teste.local' },
    })
    .returning();
  if (!cliente) throw new Error('Falha ao criar cliente com CNPJ');
  return cliente.id;
}

/**
 * Monta um cenário completo de faturamento:
 * compra confirmada → recebimento → pedido de venda → caminhão fechado com 1 peça.
 *
 * Reúsa os helpers de expedicao-fixtures para garantir que o caminhão esteja
 * no status 'fechado' e pronto para consolidar/emitir NFS-e.
 *
 * Retorna os IDs necessários para os testes de faturamento.
 */
export async function criarCaminhaoComCargaFechada(
  app: INestApplication,
  cookies: {
    compras: string;
    recebimento: string;
    comercial: string;
    expedicao: string;
  },
  opts: { dataOperacao?: string } = {},
): Promise<{
  caminhaoId: string;
  pedidoVendaId: string;
  pedidoItemId: string;
  clienteId: string;
  faturamentoContexto: {
    valor: string;
  };
}> {
  const { default: request } = await import('supertest');

  const dataOperacao = opts.dataOperacao ?? `2027-01-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;

  // Configurar hardware fake antes de qualquer operação
  fakes(app).balanca.definirStatus('disponivel');
  fakes(app).balanca.definirPeso('15.000');
  fakes(app).impressora.definirStatus('disponivel');
  fakes(app).leitor.definirStatus('disponivel');

  // Criar base comercial com cliente CNPJ válido
  const base = await seedComercialBase(app, { fator: 1 });

  // Substituir o cliente genérico (CNPJ inválido) por um com CNPJ real de 14 dígitos
  const clienteId = await criarClienteComCnpj(app);

  // Montar cenário de pesagem usando o base comercial
  const cenario = await montarCenarioPesagem(
    app,
    { compras: cookies.compras, recebimento: cookies.recebimento },
    base,
    { dataOperacao, quantidade: 5 },
  );

  // Criar pedido de venda com o cliente de CNPJ válido
  const pedidoRes = await request(app.getHttpServer())
    .post('/comercial/pedidos')
    .set('Cookie', cookies.comercial)
    .send({
      compraProgramadaId: cenario.compraId,
      clienteId,
      dataOperacao,
      itens: [{ itemComercialId: cenario.itemComercialId, quantidadePedida: 2 }],
    });
  if (pedidoRes.status !== 201) {
    throw new Error(`Falha ao criar pedido: ${JSON.stringify(pedidoRes.body)}`);
  }
  const pedidoVendaId = pedidoRes.body.id as string;
  const detalheRes = await request(app.getHttpServer())
    .get(`/comercial/pedidos/${pedidoVendaId}`)
    .set('Cookie', cookies.comercial);
  const pedidoItemId = (detalheRes.body.itens as Array<{ id: string }>)[0]!.id;

  // Pesar e associar uma peça ao pedido
  const pecaId = await pesarPeca(app, cookies.recebimento, {
    recebimentoId: cenario.recebimentoId,
    itemComercialBaseId: cenario.itemComercialId,
  });
  await request(app.getHttpServer())
    .post(`/operacao/pesagem/pecas/${pecaId}/confirmar`)
    .set('Cookie', cookies.recebimento)
    .send({ pedidoVendaItemId: pedidoItemId });
  await request(app.getHttpServer())
    .post(`/operacao/pesagem/pecas/${pecaId}/etiqueta`)
    .set('Cookie', cookies.recebimento)
    .send();

  // Criar e fechar caminhão com a peça
  const caminhaoId = await criarCaminhao(app, cookies.expedicao, { dataOperacao });
  await vincularPedido(app, cookies.expedicao, caminhaoId, pedidoVendaId);
  await abrirCarga(app, cookies.expedicao, caminhaoId);
  await adicionarPecaNaCarga(app, cookies.expedicao, caminhaoId, pecaId);

  // Configurar leitor para conferência
  fakes(app).leitor.definirCodigo(`QR-${pecaId}`);
  await iniciarConferencia(app, cookies.expedicao, caminhaoId);
  await request(app.getHttpServer())
    .post(`/operacao/expedicao/caminhoes/${caminhaoId}/conferencia/registrar-item`)
    .set('Cookie', cookies.expedicao)
    .send({ tipoOrigem: 'peca', modoCaptura: 'automatico' });
  await concluirConferencia(app, cookies.expedicao, caminhaoId);
  await fecharCaminhao(app, cookies.expedicao, caminhaoId);

  return {
    caminhaoId,
    pedidoVendaId,
    pedidoItemId,
    clienteId,
    faturamentoContexto: {
      valor: '1500.00',
    },
  };
}
