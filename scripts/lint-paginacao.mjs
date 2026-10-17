/**
 * Achado recorrente de paginação: `.limit(n)` sem `orderBy` com desempate (≥ 2 chaves) devolve
 * páginas instáveis; lista e `count` fora da mesma `transaction(` divergem sob escrita concorrente.
 * `.limit(1)` (busca de uma linha) fica fora da regra.
 */
import { ehTeste, executarSeDireto, linhaDe, metodo, parse, transacaoDe, ts, visitar } from './lint-lib.mjs';

/** Chamada `orderBy(...)` na cadeia que antecede o `.limit(`. */
function orderByDaCadeia(limitCall) {
  for (let n = limitCall.expression.expression; ts.isCallExpression(n) || ts.isPropertyAccessExpression(n); n = n.expression) {
    if (metodo(n) === 'orderBy') return n;
  }
  return undefined;
}

function funcaoDe(node) {
  let alvo;
  for (let p = node.parent; p; p = p.parent) {
    if (ts.isMethodDeclaration(p) || ts.isFunctionDeclaration(p)) return p;
    if (ts.isFunctionLike(p)) alvo ??= p;
  }
  return alvo;
}

const ehCount = (n, sf) =>
  (ts.isCallExpression(n) && ((ts.isIdentifier(n.expression) && n.expression.text === 'count') || metodo(n) === '$count')) ||
  (ts.isTaggedTemplateExpression(n) && /\bcount\s*\(/i.test(n.template.getText(sf)));

export const regra = {
  ids: ['paginacao-desempate', 'paginacao-transacao'],
  alvo: (rel) => /^app\/backend\/src\/.*\.service\.ts$/.test(rel) && !ehTeste(rel),
  verificar(rel, texto) {
    const sf = parse(rel, texto);
    const achados = [];
    const add = (node, id, mensagem) => achados.push({ arquivo: rel, linha: linhaDe(sf, node), regra: id, mensagem });
    visitar(sf, (node) => {
      if (metodo(node) !== 'limit') return;
      const [arg] = node.arguments;
      if (arg && ts.isNumericLiteral(arg) && arg.text === '1') return;
      const orderBy = orderByDaCadeia(node);
      const args = orderBy?.arguments ?? [];
      const chaves = args.some((a) => ts.isSpreadElement(a) || ts.isArrayLiteralExpression(a)) ? 2 : args.length;
      if (chaves < 2) add(node, 'paginacao-desempate', orderBy ? 'orderBy com 1 chave antes de .limit(): inclua desempate (ex.: id)' : '.limit() sem orderBy na mesma cadeia');
      const fn = funcaoDe(node);
      if (!fn) return;
      const counts = [];
      visitar(fn, (n) => ehCount(n, sf) && counts.push(n));
      const tx = transacaoDe(node);
      if (counts.length && (!tx || counts.some((c) => transacaoDe(c) !== tx))) {
        add(node, 'paginacao-transacao', 'lista paginada e count fora da mesma transaction(')
      }
    });
    return achados;
  },
};

executarSeDireto(import.meta.url, [regra]);
