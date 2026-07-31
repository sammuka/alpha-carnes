import {
  aplicarTagsOnda4,
  closeOnda4Pool,
  migrarAteOnda4,
  onda4Pool,
} from '../helpers/onda4-migrations';

/**
 * DoD 6.35 — backfill 0022 do estado da etiqueta (idempotente e determinístico).
 * Usa o pool dedicado de migrations (DATABASE_URL_*_onda4_migrations).
 */
describe('Onda 6 — migrations (D6.13 / 6.35)', () => {
  afterAll(async () => {
    await closeOnda4Pool();
  });

  it('0022 faz backfill determinístico e idempotente do estado da etiqueta', async () => {
    await migrarAteOnda4('0020_onda5_usuarios_representantes');
    await aplicarTagsOnda4(['0021_onda6_recebimento_balanca_expand']);

    const pool = await onda4Pool();
    // Fixture isolada do grafo de peças: o DoD 6.35 prova só o DML do backfill.
    await pool.query(
      'ALTER TABLE etiquetas_impressoes DROP CONSTRAINT IF EXISTS chk_etiq_um_alvo',
    );

    const { rows: users } = await pool.query<{ id: string }>(
      `INSERT INTO usuarios (nome, email, senha_hash)
       VALUES ('Op O6', 'o6-mig@test.local', 'x')
       RETURNING id`,
    );
    const operadorId = users[0]!.id;

    const insertEtiq = async (
      suffix: string,
      opts: { reimpressao: boolean; status: string; estado?: string; motivo?: string },
    ) => {
      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO etiquetas_impressoes
           (payload, status_impressao, reimpressao, operador_id, estado, motivo_cancelamento)
         VALUES ($1::jsonb, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          JSON.stringify({ qr: `O6-${suffix}` }),
          opts.status,
          opts.reimpressao,
          operadorId,
          opts.estado ?? 'emitida',
          opts.motivo ?? null,
        ],
      );
      return rows[0]!.id;
    };

    const idReimp = await insertEtiq('reimp', {
      reimpressao: true,
      status: 'pendente',
    });
    const idAtiva = await insertEtiq('ativa', {
      reimpressao: false,
      status: 'impressa',
    });
    const idEmitida = await insertEtiq('emitida', {
      reimpressao: false,
      status: 'falha_impressao',
    });
    const idCancelada = await insertEtiq('canc', {
      reimpressao: false,
      status: 'impressa',
      estado: 'cancelada',
      motivo: 'teste-gate',
    });

    await aplicarTagsOnda4(['0022_onda6_etiqueta_estado_backfill']);

    const estados = async () => {
      const { rows } = await pool.query<{ id: string; estado: string }>(
        `SELECT id, estado FROM etiquetas_impressoes
         WHERE id = ANY($1::uuid[])`,
        [[idReimp, idAtiva, idEmitida, idCancelada]],
      );
      return Object.fromEntries(rows.map((r) => [r.id, r.estado]));
    };

    let mapa = await estados();
    expect(mapa[idReimp]).toBe('reimpressa');
    expect(mapa[idAtiva]).toBe('ativa');
    expect(mapa[idEmitida]).toBe('emitida');
    expect(mapa[idCancelada]).toBe('cancelada');

    const { rows: countsBefore } = await pool.query<{ estado: string; n: string }>(
      `SELECT estado, count(*)::text AS n FROM etiquetas_impressoes GROUP BY estado ORDER BY estado`,
    );

    // Reaplicar — idempotente
    await aplicarTagsOnda4(['0022_onda6_etiqueta_estado_backfill']);
    mapa = await estados();
    expect(mapa[idReimp]).toBe('reimpressa');
    expect(mapa[idAtiva]).toBe('ativa');
    expect(mapa[idEmitida]).toBe('emitida');
    expect(mapa[idCancelada]).toBe('cancelada');

    const { rows: countsAfter } = await pool.query<{ estado: string; n: string }>(
      `SELECT estado, count(*)::text AS n FROM etiquetas_impressoes GROUP BY estado ORDER BY estado`,
    );
    expect(countsAfter).toEqual(countsBefore);
  });
});
