import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { celulaCsv, montarCsv } from '../../src/common/csv';
import { ilikeSeguro, padraoContem } from '../../src/common/sql/ilike-seguro';
import { dataIsoSchema, textoSchema } from '../../src/common/validation/campos';

describe('helpers dos achados recorrentes (AD-41)', () => {
  describe('textoSchema', () => {
    it('recusa byte NUL e aceita texto comum, combinando com min/max', () => {
      const schema = textoSchema().min(1).max(10);
      expect(schema.safeParse('ok').success).toBe(true);
      expect(schema.safeParse('a\u0000b').success).toBe(false);
      expect(schema.safeParse('').success).toBe(false);
      expect(schema.safeParse('12345678901').success).toBe(false);
    });
  });

  describe('dataIsoSchema', () => {
    it('aceita AAAA-MM-DD válida a partir de 1900 e recusa ano anterior ou data inválida', () => {
      const schema = dataIsoSchema();
      expect(schema.safeParse('1900-01-01').success).toBe(true);
      expect(schema.safeParse('2026-10-17').success).toBe(true);
      expect(schema.safeParse('1899-12-31').success).toBe(false);
      expect(schema.safeParse('0001-01-01').success).toBe(false);
      expect(schema.safeParse('2026-02-30').success).toBe(false);
      expect(schema.safeParse('17/10/2026').success).toBe(false);
    });
  });

  describe('CSV', () => {
    it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tx', '\rx'])('neutraliza fórmula em %j', (valor) => {
      expect(celulaCsv(valor).replace(/^"/, '').startsWith("'")).toBe(true);
    });

    it('escapa separador, aspas e quebra de linha; texto comum passa intacto', () => {
      expect(celulaCsv('a;b')).toBe('"a;b"');
      expect(celulaCsv('diz "oi"')).toBe('"diz ""oi"""');
      expect(celulaCsv('linha\n2')).toBe('"linha\n2"');
      expect(celulaCsv('Picanha')).toBe('Picanha');
      expect(celulaCsv(null)).toBe('');
      expect(celulaCsv(12.5)).toBe('12.5');
    });

    it('arquivo começa com BOM, usa ; e CRLF e escapa cabeçalho e corpo', () => {
      const csv = montarCsv(['Nome', 'Valor'], [['=cmd', 'a;b']]);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
      expect(csv.slice(1)).toBe("Nome;Valor\r\n'=cmd;\"a;b\"");
    });
  });

  describe('ilike', () => {
    it('escapa curingas e a barra invertida do LIKE', () => {
      expect(padraoContem('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
    });

    it('monta ILIKE parametrizado com o padrão escapado', () => {
      const t = pgTable('t', { nome: text('nome') });
      const q = new PgDialect().sqlToQuery(ilikeSeguro(t.nome, '10%'));
      expect(q.sql).toBe('"t"."nome" ilike $1');
      expect(q.params).toEqual(['%10\\%%']);
    });
  });
});
