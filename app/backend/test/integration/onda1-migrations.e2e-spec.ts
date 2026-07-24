import {
  aplicarMigration,
  buscarDivergencia,
  closePool,
  contarDivergenciasComTipoLegado,
  ensurePool,
  expectCheckAceita,
  expectCheckRejeita,
  expectColuna,
  expectColunaAusente,
  expectTabela,
  migrarAte,
  semearDivergenciasLegadas,
} from '../helpers/onda1-migrations';

describe('onda1-migrations', () => {
  afterAll(async () => {
    // DROP ocorre só no DB dedicado (*_migrations); e2e usam DATABASE_URL.
    await migrarAte('0014_onda1_contract');
    await closePool();
  }, 120_000);

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
    const mig = await ensurePool();
    const { rows: recs } = await mig.query<{
      pedido_fornecedor_id: string | null;
      operacao_id: string | null;
      status: string;
    }>(`SELECT pedido_fornecedor_id, operacao_id, status FROM recebimentos`);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.pedido_fornecedor_id).toBeTruthy();
    expect(recs[0]!.operacao_id).toBeTruthy();
    expect(recs[0]!.status).toBe('pesagem_em_andamento');

    const { rows: nfs } = await mig.query<{ payload_json: { migracao?: string } }>(
      `SELECT payload_json FROM notas_fiscais_fornecedor`,
    );
    expect(nfs.length).toBe(1);
    expect(nfs[0]!.payload_json.migracao).toBe('legado_sem_itens_nf');
    const { rows: nfItens } = await mig.query(
      `SELECT id FROM notas_fiscais_fornecedor_itens`,
    );
    expect(nfItens.length).toBe(0);
  });

  it('0014 aperta chk_diverg_receb_tipo ao conjunto final', async () => {
    await migrarAte('0014_onda1_contract');
    // Os 5 tipos v1.1 permanecem aceitos:
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'falta');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'outro');
    // Qualquer tipo legado é rejeitado após o contract (0013 já os remapeou):
    await expectCheckRejeita('divergencias_recebimento', 'tipo', 'inconsistencia_nf_fisico');
    await expectCheckRejeita('divergencias_recebimento', 'tipo', 'quantidade_menor');
  });

  it('0014 pós-contract: information_schema confirma ausência de data_operacao e nfe_*', async () => {
    await migrarAte('0014_onda1_contract');

    const tabelasSemDataOperacao = [
      'compras_programadas',
      'disponibilidades_virtuais',
      'pedidos_venda',
      'recebimentos',
      'caminhoes',
      'faturamentos',
    ] as const;
    for (const tabela of tabelasSemDataOperacao) {
      await expectColunaAusente(tabela, 'data_operacao');
    }

    const colunasNfeCache = [
      'nfe_numero',
      'nfe_serie',
      'nfe_chave',
      'nfe_data_emissao',
      'nfe_peso_bruto',
      'nfe_peso_liquido',
      'nfe_volumes',
    ] as const;
    for (const coluna of colunasNfeCache) {
      await expectColunaAusente('recebimentos', coluna);
    }
  });
});
