import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { regra as csv } from './lint-csv.mjs';
import { regra as dto } from './lint-dto-zod.mjs';
import { regra as paginacao } from './lint-paginacao.mjs';
import { regra as ilike } from './lint-ilike.mjs';
import { regra as envio } from './lint-envio-em-voo.mjs';
import { regra as forUpdate } from './lint-for-update.mjs';
import { aplicarAllowlist } from './lint-lib.mjs';

const ids = (achados) => achados.map((a) => `${a.regra}:${a.linha}`);

test('csv: join(";") manual reprova; o helper comum e specs ficam fora', () => {
  const ruim = "const s = linhas.map((l) => l.join(';')).join('\\n');\n";
  assert.deepEqual(ids(csv.verificar('app/backend/src/modules/x/x.service.ts', ruim)), ['csv-manual:1']);
  assert.equal(csv.alvo('app/backend/src/common/csv.ts'), false);
  assert.equal(csv.alvo('app/backend/test/unit/x.spec.ts'), false);
  assert.equal(csv.alvo('app/backend/src/modules/x/x.service.ts'), true);
});

test('dto: z.string() cru e data ISO sem piso reprovam; helpers e uuid passam', () => {
  const ruim = [
    "import { z } from 'zod';",
    'export const A = z.object({',
    '  nome: z.string().min(1),',
    '  data: z.iso.date(),',
    "  vencimento: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),",
    '  id: z.string().uuid(),',
    '  ok: textoSchema().max(10),',
    '  dia: dataIsoSchema(),',
    '});',
  ].join('\n');
  assert.deepEqual(ids(dto.verificar('app/backend/src/m/dto/a.dto.ts', ruim)), ['dto-texto:3', 'dto-data:4', 'dto-data:5']);
  assert.equal(dto.alvo('app/backend/src/m/dto/a.dto.ts'), true);
  assert.equal(dto.alvo('app/backend/src/m/a.service.ts'), false);
});

test('paginação: limit sem desempate ou com count fora da transação reprova', () => {
  const ruim = [
    'class S {',
    '  async listar() {',
    '    const itens = await this.db.select().from(t).orderBy(desc(t.criadoEm)).limit(20).offset(0);',
    '    const [{ total }] = await this.db.select({ total: count() }).from(t);',
    '    return { itens, total };',
    '  }',
    '  async semOrdem() { return this.db.select().from(t).limit(50); }',
    '  async umaLinha() { return this.db.select().from(t).where(eq(t.id, id)).limit(1); }',
    '}',
  ].join('\n');
  assert.deepEqual(ids(paginacao.verificar('a.service.ts', ruim)), [
    'paginacao-desempate:3',
    'paginacao-transacao:3',
    'paginacao-desempate:7',
  ]);
  const bom = [
    'class S {',
    '  async listar() {',
    '    return this.db.transaction(async (tx) => {',
    '      const itens = await tx.select().from(t).orderBy(desc(t.criadoEm), asc(t.id)).limit(20);',
    '      const [{ total }] = await tx.select({ total: count() }).from(t);',
    '      return { itens, total };',
    '    });',
    '  }',
    '}',
  ].join('\n');
  assert.deepEqual(paginacao.verificar('a.service.ts', bom), []);
});

test('ilike: %${termo} sem escape reprova; o helper comum fica fora', () => {
  assert.deepEqual(ids(ilike.verificar('a.service.ts', 'const termo = `%${dto.busca}%`;\n')), ['ilike-sem-escape:1']);
  assert.deepEqual(ilike.verificar('a.service.ts', 'filtros.push(ilikeSeguro(t.nome, dto.busca));\n'), []);
  assert.equal(ilike.alvo('app/backend/src/common/sql/ilike-seguro.ts'), false);
});

test('envio em voo: handler com fetch sem estado em disabled reprova; com estado ou comentário passa', () => {
  const ruim = [
    'export function F() {',
    '  async function salvar() { await fetch("/api/x", { method: "POST" }); }',
    '  return <form onSubmit={salvar}><button type="submit">Salvar</button></form>;',
    '}',
  ].join('\n');
  assert.deepEqual(ids(envio.verificar('a.tsx', ruim)), ['envio-em-voo:3']);
  const bom = ruim.replace('<button type="submit">', '<button type="submit" disabled={salvando}>');
  assert.deepEqual(envio.verificar('a.tsx', bom), []);
  const indireto = [
    'export function F() {',
    '  async function mutar() { await fetch("/api/x", { method: "POST" }); }',
    '  const confirmar = async () => { await mutar(); };',
    '  return <Button onClick={confirmar}>Confirmar</Button>;',
    '}',
  ].join('\n');
  assert.deepEqual(ids(envio.verificar('a.tsx', indireto)), ['envio-em-voo:4']);
  const comentado = indireto.replace('  return <Button', '  // envio-em-voo: ok — diálogo fecha antes do fetch\n  return <Button');
  assert.deepEqual(envio.verificar('a.tsx', comentado), []);
});

test('for update: insert de filha em transação sem .for( na leitura do pai reprova', () => {
  const ruim = [
    'class S {',
    '  async criarItem() {',
    '    return this.db.transaction(async (tx) => {',
    '      const [pai] = await tx.select().from(pedidos).where(eq(pedidos.id, id));',
    '      await tx.insert(itens).values({ pedidoId: pai.id });',
    '    });',
    '  }',
    '}',
  ].join('\n');
  assert.deepEqual(ids(forUpdate.verificar('a.service.ts', ruim)), ['for-update-pai:5']);
  const bom = ruim.replace('.where(eq(pedidos.id, id))', ".where(eq(pedidos.id, id)).for('update')");
  assert.deepEqual(forUpdate.verificar('a.service.ts', bom), []);
});

test('allowlist: arquivo listado vira aviso no --warn; arquivo novo continua erro; entrada obsoleta é apontada', () => {
  const achados = [
    { arquivo: 'a.ts', linha: 1, regra: 'r', mensagem: 'm' },
    { arquivo: 'b.ts', linha: 2, regra: 'r', mensagem: 'm' },
  ];
  const r = aplicarAllowlist(achados, { r: ['a.ts', 'c.ts'] }, { warn: true });
  assert.deepEqual(r.erros.map((a) => a.arquivo), ['b.ts']);
  assert.deepEqual(r.avisos.map((a) => a.arquivo), ['a.ts']);
  assert.deepEqual(r.obsoletas, ['r: c.ts']);
  assert.equal(aplicarAllowlist(achados, { r: ['a.ts'] }, { warn: false }).erros.length, 2);
});

test('verde no código atual: npm run lint:achados (modo --warn + allowlist) sai 0', () => {
  const r = spawnSync(process.execPath, [fileURLToPath(new URL('./lint-achados.mjs', import.meta.url)), '--warn'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
