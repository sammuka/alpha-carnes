/**
 * Achados recorrentes em DTO: texto livre aceitando `\u0000` (PostgreSQL devolve 500) e data ISO
 * aceitando ano < 1900. Em `dto/`, use textoSchema()/dataIsoSchema() de src/common/validation/campos.ts.
 */
import { ehTeste, executarSeDireto, linhaDe, metodo, parse, ts, visitar } from './lint-lib.mjs';

const SEGUROS = new Set(['uuid', 'email', 'url']);
const DATA = new Set(['date', 'datetime']);

/** `z.a.b(...)` → 'a.b' quando a raiz é o identificador `z`. */
function caminhoZ(expr) {
  const partes = [];
  while (ts.isPropertyAccessExpression(expr)) {
    partes.unshift(expr.name.text);
    expr = expr.expression;
  }
  return ts.isIdentifier(expr) && expr.text === 'z' ? partes.join('.') : undefined;
}

/** Métodos encadeados após `call` (`z.string().min(1).regex(...)` → [[min,args],[regex,args]]). */
function cadeia(call) {
  const out = [];
  let n = call;
  while (ts.isPropertyAccessExpression(n.parent) && ts.isCallExpression(n.parent.parent)) {
    out.push([n.parent.name.text, n.parent.parent.arguments]);
    n = n.parent.parent;
  }
  return out;
}

export const regra = {
  ids: ['dto-texto', 'dto-data'],
  alvo: (rel) => /^app\/backend\/src\/.*\/dto\/[^/]+\.ts$/.test(rel) && !ehTeste(rel),
  verificar(rel, texto) {
    const sf = parse(rel, texto);
    const achados = [];
    const add = (node, id, mensagem) => achados.push({ arquivo: rel, linha: linhaDe(sf, node), regra: id, mensagem });
    visitar(sf, (node) => {
      if (!ts.isCallExpression(node)) return;
      const caminho = caminhoZ(node.expression);
      if (['iso.date', 'iso.datetime', 'coerce.date', 'date'].includes(caminho)) {
        add(node, 'dto-data', `z.${caminho}() aceita ano < 1900: use dataIsoSchema()`);
      } else if (caminho === 'string') {
        const metodos = cadeia(node);
        if (metodos.some(([m]) => SEGUROS.has(m))) return;
        const regexData = metodos.some(([m, args]) => m === 'regex' && args.some((a) => /\\d\{4\}|data|iso/i.test(a.getText(sf))));
        if (regexData || metodos.some(([m]) => DATA.has(m))) add(node, 'dto-data', 'data via z.string() aceita ano < 1900: use dataIsoSchema()');
        else add(node, 'dto-texto', 'z.string() cru aceita o byte NUL: use textoSchema()');
      }
    });
    return achados;
  },
};

executarSeDireto(import.meta.url, [regra]);
