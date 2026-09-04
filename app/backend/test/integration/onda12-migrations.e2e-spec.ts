import {
  aplicarTagsOnda4,
  closeOnda4Pool,
  migrarAteOnda4,
  onda4Pool,
} from '../helpers/onda4-migrations';

describe('Onda 12 — migrations 0031/0032/0033', () => {
  afterAll(async () => {
    await closeOnda4Pool();
  });

  it('DoD 12.13 aplica expand backfill contract sobre snapshot O11', async () => {
    await migrarAteOnda4('0030_onda11_multicompra_contract');
    const pool = await onda4Pool();

    const { rows: users } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Op O12', 'o12-mig@test.local', 'x')
       RETURNING id`,
    );
    const usuarioId = users[0]!.id;

    const { rows: reps } = await pool.query<{ id: string }>(
      `INSERT INTO representantes (codigo, nome, status)
       VALUES ('REP-O12-UNICO', 'Representante O12 Unico', 'ativo')
       RETURNING id`,
    );
    const representanteId = reps[0]!.id;

    const { rows: caminhoesFrota } = await pool.query<{ id: string }>(
      `INSERT INTO frota_caminhoes (placa, status)
       VALUES ('O12-1A01', 'ativo')
       RETURNING id`,
    );
    const caminhaoFrotaId = caminhoesFrota[0]!.id;

    const { rows: motoristas } = await pool.query<{ id: string }>(
      `INSERT INTO frota_motoristas (nome, documento, status)
       VALUES ('Motorista O12 Unico', 'CNH-O12-1', 'ativo')
       RETURNING id`,
    );
    const motoristaId = motoristas[0]!.id;

    const { rows: rotas } = await pool.query<{ id: string }>(
      `INSERT INTO rotas (codigo, nome, representante_padrao, caminhao_padrao, motorista_padrao)
       VALUES (
         'R-O12',
         'Rota O12',
         'REP-O12-UNICO',
         'O12-1A01',
         'Motorista O12 Unico'
       )
       RETURNING id`,
    );
    const rotaId = rotas[0]!.id;

    const { rows: forns } = await pool.query<{ id: string }>(
      `INSERT INTO fornecedores (codigo, razao_social, documento_fiscal)
       VALUES ('FORN-O12', 'Fornecedor O12 Unico', 'DOC-O12')
       RETURNING id`,
    );
    const fornecedorId = forns[0]!.id;

    await pool.query(
      `INSERT INTO produtos (codigo, nome, unidade_pedido)
       VALUES ('PRD-O12-KG', 'Produto quilo', 'quilo')`,
    );
    await pool.query(
      `INSERT INTO itens_compra (codigo, descricao, unidade_compra)
       VALUES ('ICO-O12', 'Item peca', 'peca')`,
    );
    await pool.query(
      `INSERT INTO itens_comerciais (codigo, descricao, unidade_comercial)
       VALUES ('ICM-O12', 'Item un', 'un')`,
    );

    const { rows: ops } = await pool.query<{ id: string }>(
      `INSERT INTO operacoes (data, dia_semana, rotulo)
       VALUES ('2026-08-30', 0, 'Op O12')
       RETURNING id`,
    );
    const operacaoId = ops[0]!.id;

    const { rows: clientes } = await pool.query<{ id: string }>(
      `INSERT INTO clientes (codigo, razao_social, documento_fiscal)
       VALUES ('CLI-O12', 'Cliente O12', 'DOCC-O12')
       RETURNING id`,
    );
    const clienteId = clientes[0]!.id;

    const { rows: pedidos } = await pool.query<{ id: string }>(
      `INSERT INTO pedidos_venda
         (cliente_id, operacao_id, usuario_criacao_id, rota_prevista)
       VALUES ($1, $2, $3, 'R-O12')
       RETURNING id`,
      [clienteId, operacaoId, usuarioId],
    );
    const pedidoId = pedidos[0]!.id;

    const { rows: caminhoesOp } = await pool.query<{ id: string }>(
      `INSERT INTO caminhoes (placa, motorista, rota, operacao_id)
       VALUES ('OP-O12', 'Motorista O12 Unico', 'Rota O12', $1)
       RETURNING id`,
      [operacaoId],
    );
    const caminhaoOpId = caminhoesOp[0]!.id;

    const { rows: produtos } = await pool.query<{ id: string }>(
      `SELECT id FROM produtos WHERE codigo = 'PRD-O12-KG'`,
    );
    await pool.query(
      `INSERT INTO entradas_itens
         (produto_id, quantidade, fornecedor_nome, destino, registrado_por)
       VALUES ($1, 2, 'FORN-O12', 'estoque', $2)`,
      [produtos[0]!.id, usuarioId],
    );

    await aplicarTagsOnda4([
      '0031_onda12_dominio_expand',
      '0032_onda12_dominio_backfill',
      '0033_onda12_dominio_contract',
    ]);

    const { rows: unidades } = await pool.query<{
      unidade_pedido: string;
      unidade_compra: string;
      unidade_comercial: string;
    }>(
      `SELECT
         (SELECT unidade_pedido FROM produtos WHERE codigo = 'PRD-O12-KG') AS unidade_pedido,
         (SELECT unidade_compra FROM itens_compra WHERE codigo = 'ICO-O12') AS unidade_compra,
         (SELECT unidade_comercial FROM itens_comerciais WHERE codigo = 'ICM-O12') AS unidade_comercial`,
    );
    expect(unidades[0]).toEqual({
      unidade_pedido: 'kg',
      unidade_compra: 'unidade',
      unidade_comercial: 'unidade',
    });

    const { rows: rotaFk } = await pool.query<{
      representante_padrao_id: string | null;
      caminhao_padrao_id: string | null;
      motorista_padrao_id: string | null;
    }>(
      `SELECT representante_padrao_id, caminhao_padrao_id, motorista_padrao_id
         FROM rotas WHERE id = $1`,
      [rotaId],
    );
    expect(rotaFk[0]).toEqual({
      representante_padrao_id: representanteId,
      caminhao_padrao_id: caminhaoFrotaId,
      motorista_padrao_id: motoristaId,
    });

    const { rows: pedidoFk } = await pool.query<{ rota_id: string | null }>(
      `SELECT rota_id FROM pedidos_venda WHERE id = $1`,
      [pedidoId],
    );
    expect(pedidoFk[0]!.rota_id).toBe(rotaId);

    const { rows: cargaFk } = await pool.query<{
      motorista_id: string | null;
      rota_id: string | null;
    }>(
      `SELECT motorista_id, rota_id FROM caminhoes WHERE id = $1`,
      [caminhaoOpId],
    );
    expect(cargaFk[0]).toEqual({
      motorista_id: motoristaId,
      rota_id: rotaId,
    });

    const { rows: entradaFk } = await pool.query<{ fornecedor_id: string | null }>(
      `SELECT fornecedor_id FROM entradas_itens WHERE registrado_por = $1`,
      [usuarioId],
    );
    expect(entradaFk[0]!.fornecedor_id).toBe(fornecedorId);
  }, 180_000);

  it('DoD 12.13b contract recusa unidade histórica desconhecida', async () => {
    await migrarAteOnda4('0030_onda11_multicompra_contract');
    const pool = await onda4Pool();
    await pool.query(
      `INSERT INTO produtos (codigo, nome, unidade_pedido)
       VALUES ('PRD-O12-BAD', 'Produto tonelada', 'tonelada')`,
    );
    await aplicarTagsOnda4(['0031_onda12_dominio_expand']);
    await expect(
      aplicarTagsOnda4([
        '0032_onda12_dominio_backfill',
        '0033_onda12_dominio_contract',
      ]),
    ).rejects.toThrow(/unidade histórica fora de kg\|unidade/);
  }, 180_000);
});
