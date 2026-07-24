import {
  closePool,
  expectCheckAceita,
  expectColuna,
  expectTabela,
  migrarAte,
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
    // valores novos que o backfill 0013 gravará passam a ser aceitos:
    await expectCheckAceita('pedidos_venda', 'status', 'aguardando_confirmacao_overbooking');
    await expectCheckAceita('pedidos_venda_itens', 'status', 'aguardando_confirmacao_overbooking');
    await expectCheckAceita('recebimentos', 'status', 'pesagem_em_andamento');
    // tipos v1.1 que a Task 5 grava em conferências novas passam a ser aceitos:
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'falta');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'produto_nao_previsto');
    // valores legados continuam aceitos durante a janela expand:
    await expectCheckAceita('pedidos_venda', 'status', 'reservado');
    await expectCheckAceita('recebimentos', 'status', 'finalizado');
    await expectCheckAceita('divergencias_recebimento', 'tipo', 'inconsistencia_nf_fisico');
  });
});
