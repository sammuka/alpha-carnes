import {
  aplicarMigration,
  buscarDivergencia,
  closePool,
  contarDivergenciasComTipoLegado,
  expectCheckAceita,
  expectColuna,
  expectTabela,
  getPool,
  migrarAte,
  semearDivergenciasLegadas,
} from '../helpers/onda1-migrations';

describe('onda1-migrations', () => {
  afterAll(async () => {
    await closePool();
  });

  it('0012 cria estruturas sem remover colunas legadas', async () => {
    await migrarAte('0012_onda1_expand');
    await expectColuna('pedidos_venda', 'operacao_id', { nullable: true });
    await expectColuna('recebimentos', 'pedido_fornecedor_id', { nullable: true });
    await expectTabela('pendencias_overbooking');
    await expectTabela('pedidos_fornecedor');
    await expectTabela('notas_fiscais_fornecedor');
    await expectTabela('conclusoes_conferencia');
    await expectTabela('conclusoes_conferencia_nfs');
    await expectColuna('recebimentos', 'data_operacao', { nullable: false });
  });

  it('0012 amplia CHECKs de status para o superset (aceita legado e novo)', async () => {
    await migrarAte('0012_onda1_expand');
    await expectCheckAceita('pedidos_venda', 'status', 'aguardando_confirmacao_overbooking');
    await expectCheckAceita('pedidos_venda_itens', 'status', 'aguardando_confirmacao_overbooking');
    await expectCheckAceita('recebimentos', 'status', 'pesagem_em_andamento');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'falta');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'produto_nao_previsto');
    await expectCheckAceita('pedidos_venda', 'status', 'reservado');
    await expectCheckAceita('recebimentos', 'status', 'finalizado');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'inconsistencia_nf_fisico');
  });

  it('0013 remapeia os 8 tipos legados de divergência para os 5 v1.1', async () => {
    await migrarAte('0012_onda1_expand');
    const semeados = await semearDivergenciasLegadas([
      'quantidade_menor', 'quantidade_maior', 'item_divergente', 'qualidade_divergente',
      'peso_incompativel', 'item_ausente', 'item_excedente', 'inconsistencia_nf_fisico',
    ]);
    await aplicarMigration('0013_onda1_backfill');
    const mapaEsperado: Record<string, string> = {
      quantidade_menor: 'falta', item_ausente: 'falta',
      quantidade_maior: 'excesso', item_excedente: 'excesso',
      peso_incompativel: 'peso_divergente', item_divergente: 'produto_nao_previsto',
      qualidade_divergente: 'outro', inconsistencia_nf_fisico: 'outro',
    };
    for (const { id, tipoLegado } of semeados) {
      const linha = await buscarDivergencia(id);
      expect(linha.tipo).toBe(mapaEsperado[tipoLegado]);
      expect(linha.descricao).toContain(`[origem_legado=${tipoLegado}]`);
    }
    expect(await contarDivergenciasComTipoLegado()).toBe(0);

    // Backfill preenche FKs e NF legada sem inventar itens
    const { rows: recs } = await getPool().query<{
      pedido_fornecedor_id: string | null;
      operacao_id: string | null;
      status: string;
    }>(`SELECT pedido_fornecedor_id, operacao_id, status FROM recebimentos`);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.pedido_fornecedor_id).toBeTruthy();
    expect(recs[0]!.operacao_id).toBeTruthy();
    expect(recs[0]!.status).toBe('pesagem_em_andamento');

    const { rows: nfs } = await getPool().query<{ payload_json: { migracao?: string } }>(
      `SELECT payload_json FROM notas_fiscais_fornecedor`,
    );
    expect(nfs.length).toBe(1);
    expect(nfs[0]!.payload_json.migracao).toBe('legado_sem_itens_nf');
    const { rows: nfItens } = await getPool().query(
      `SELECT id FROM notas_fiscais_fornecedor_itens`,
    );
    expect(nfItens.length).toBe(0);
  });
});
