import {
  aplicarTagsOnda4,
  closeOnda4Pool,
  migrarAteOnda4,
  onda4Pool,
} from '../helpers/onda4-migrations';

const COMPRA_A = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const COMPRA_B = '88888888-8888-4888-8888-888888888888';
const COMPRA_C = '00000000-0000-4000-8000-000000000001';

describe('Onda 11 — migrations 0028/0029/0030 (AD-14)', () => {
  afterAll(async () => {
    await closeOnda4Pool();
  });

  it('numera por created_at,id; pedido legado nullable; peca NOT NULL e imutavel', async () => {
    await migrarAteOnda4('0027_onda_frota_dados_legado');
    const pool = await onda4Pool();

    const { rows: users } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Op O11', 'o11-mig@test.local', 'x')
       RETURNING id`,
    );
    const usuarioId = users[0]!.id;

    const { rows: forns } = await pool.query<{ id: string }>(
      `INSERT INTO fornecedores (codigo, razao_social, documento_fiscal)
       VALUES ('FORN-O11', 'Fornecedor O11', 'DOC-O11-MIG')
       RETURNING id`,
    );
    const fornecedorId = forns[0]!.id;

    const { rows: ops } = await pool.query<{ id: string }>(
      `INSERT INTO operacoes (data, dia_semana, rotulo)
       VALUES ('2026-08-01', 6, 'Op O11 sequencial')
       RETURNING id`,
    );
    const operacaoId = ops[0]!.id;

    await pool.query(
      `INSERT INTO compras_programadas
         (id, operacao_id, fornecedor_id, status, usuario_criacao_id, created_at)
       VALUES
         ($1, $4, $5, 'cancelada', $6, '2026-08-01 08:00:00+00'),
         ($2, $4, $5, 'cancelada', $6, '2026-08-01 09:00:00+00'),
         ($3, $4, $5, 'rascunho',  $6, '2026-08-01 10:00:00+00')`,
      [COMPRA_A, COMPRA_B, COMPRA_C, operacaoId, fornecedorId, usuarioId],
    );

    await aplicarTagsOnda4([
      '0028_onda11_multicompra_expand',
      '0029_onda11_multicompra_backfill',
      '0030_onda11_multicompra_contract',
    ]);

    const { rows: sequenciais } = await pool.query<{
      id: string;
      numero_sequencial: number;
    }>(
      `SELECT id, numero_sequencial
         FROM compras_programadas
        WHERE id = ANY($1::uuid[])
        ORDER BY numero_sequencial, id`,
      [[COMPRA_A, COMPRA_B, COMPRA_C]],
    );
    expect(sequenciais).toEqual([
      { id: COMPRA_A, numero_sequencial: 1 },
      { id: COMPRA_B, numero_sequencial: 2 },
      { id: COMPRA_C, numero_sequencial: 3 },
    ]);

    await aplicarTagsOnda4(['0029_onda11_multicompra_backfill']);
    const { rows: sequenciaisIdem } = await pool.query<{
      id: string;
      numero_sequencial: number;
    }>(
      `SELECT id, numero_sequencial
         FROM compras_programadas
        WHERE id = ANY($1::uuid[])
        ORDER BY numero_sequencial, id`,
      [[COMPRA_A, COMPRA_B, COMPRA_C]],
    );
    expect(sequenciaisIdem).toEqual(sequenciais);

    const { rows: clientes } = await pool.query<{ id: string }>(
      `INSERT INTO clientes (codigo, razao_social, documento_fiscal)
       VALUES ('CLI-O11', 'Cliente O11', 'DOCC-O11')
       RETURNING id`,
    );
    const clienteId = clientes[0]!.id;

    const { rows: pedidosNull } = await pool.query<{
      compra_programada_id: string | null;
    }>(
      `INSERT INTO pedidos_venda
         (compra_programada_id, cliente_id, operacao_id, usuario_criacao_id)
       VALUES (NULL, $1, $2, $3)
       RETURNING compra_programada_id`,
      [clienteId, operacaoId, usuarioId],
    );
    expect(pedidosNull[0]!.compra_programada_id).toBeNull();

    const { rows: pecaNullable } = await pool.query<{ is_nullable: string }>(
      `SELECT is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pecas'
          AND column_name = 'compra_programada_id'`,
    );
    expect(pecaNullable[0]!.is_nullable).toBe('NO');

    await expect(
      pool.query(
        `INSERT INTO pecas
           (compra_programada_id, recebimento_id, item_comercial_base_id,
            peso_original, modo_captura_peso)
         VALUES (NULL, '00000000-0000-4000-8000-000000000099',
                 '00000000-0000-4000-8000-000000000098', 1.000, 'automatico')`,
      ),
    ).rejects.toMatchObject({ code: '23502' });

    const { rows: opsPeca } = await pool.query<{ id: string }>(
      `INSERT INTO operacoes (data, dia_semana, rotulo)
       VALUES ('2026-08-02', 0, 'Op O11 peca')
       RETURNING id`,
    );
    const operacaoPecaId = opsPeca[0]!.id;

    const { rows: comprasPeca } = await pool.query<{
      id: string;
      numero_sequencial: number;
    }>(
      `INSERT INTO compras_programadas
         (operacao_id, numero_sequencial, fornecedor_id, status, usuario_criacao_id)
       VALUES
         ($1, 1, $2, 'rascunho', $3),
         ($1, 2, $2, 'rascunho', $3)
       RETURNING id, numero_sequencial`,
      [operacaoPecaId, fornecedorId, usuarioId],
    );
    const compraOrigemId = comprasPeca.find((c) => c.numero_sequencial === 1)!.id;
    const compraDestinoId = comprasPeca.find((c) => c.numero_sequencial === 2)!.id;

    const { rows: itens } = await pool.query<{ id: string }>(
      `INSERT INTO itens_comerciais (codigo, descricao, unidade_comercial)
       VALUES ('IC-O11', 'Item O11', 'parte')
       RETURNING id`,
    );
    const itemComercialId = itens[0]!.id;

    const { rows: pfs } = await pool.query<{ id: string }>(
      `INSERT INTO pedidos_fornecedor
         (numero, fornecedor_id, operacao_id, compra_programada_id, status)
       VALUES ('PF-O11', $1, $2, $3, 'enviado')
       RETURNING id`,
      [fornecedorId, operacaoPecaId, compraOrigemId],
    );
    const pedidoFornecedorId = pfs[0]!.id;

    const { rows: recs } = await pool.query<{ id: string }>(
      `INSERT INTO recebimentos
         (fornecedor_id, operacao_id, pedido_fornecedor_id, responsavel_recebimento_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [fornecedorId, operacaoPecaId, pedidoFornecedorId, usuarioId],
    );
    const recebimentoId = recs[0]!.id;

    const { rows: pecas } = await pool.query<{ id: string }>(
      `INSERT INTO pecas
         (compra_programada_id, recebimento_id, item_comercial_base_id,
          peso_original, modo_captura_peso)
       VALUES ($1, $2, $3, 12.500, 'automatico')
       RETURNING id`,
      [compraOrigemId, recebimentoId, itemComercialId],
    );
    const pecaId = pecas[0]!.id;

    await expect(
      pool.query(
        `UPDATE pecas SET compra_programada_id = $1 WHERE id = $2`,
        [compraDestinoId, pecaId],
      ),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        'pecas.compra_programada_id is immutable (AD-14)',
      ),
    });

    const updated = await pool.query(
      `UPDATE pecas SET peso_original = peso_original WHERE id = $1 RETURNING id`,
      [pecaId],
    );
    expect(updated.rowCount).toBe(1);
  }, 180_000);
});
