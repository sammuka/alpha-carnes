/**
 * Achado recorrente de UI: handler de envio (onSubmit/onClick) que faz fetch mutante sem estado
 * "em voo" no `disabled` permite duplo envio. Heurística: o componente precisa referenciar
 * enviando|salvando|processando (ou isSubmitting/isPending) em algum `disabled=`.
 * Falso positivo documentado: `// envio-em-voo: ok — <motivo>` na linha do atributo, na anterior
 * ou dentro do handler.
 */
import { ehTeste, executarSeDireto, linhaDe, parse, temPragma, ts, visitar } from './lint-lib.mjs';

const ESTADO = /enviando|salvando|processando|submitting|pending|pendente/i;
const MUTANTE = /['"`](POST|PUT|PATCH|DELETE)['"`]/i;

function declaracoes(sf) {
  const mapa = new Map();
  visitar(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) mapa.set(n.name.text, n);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      let init = n.initializer;
      if (ts.isCallExpression(init) && init.arguments[0] && ts.isFunctionLike(init.arguments[0])) init = init.arguments[0]; // useCallback
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) mapa.set(n.name.text, init);
    }
  });
  return mapa;
}

/** Texto do handler + das funções do mesmo arquivo que ele chama (2 níveis). */
function textoAlcancado(fn, decl, sf, nivel = 0, vistos = new Set()) {
  if (!fn || vistos.has(fn)) return '';
  vistos.add(fn);
  let texto = fn.getText(sf);
  if (nivel >= 2) return texto;
  visitar(fn, (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) texto += textoAlcancado(decl.get(n.expression.text), decl, sf, nivel + 1, vistos);
  });
  return texto;
}

export const regra = {
  ids: ['envio-em-voo'],
  alvo: (rel) => /^app\/frontend\/src\/.*\.tsx$/.test(rel) && !ehTeste(rel),
  verificar(rel, texto) {
    const sf = parse(rel, texto);
    const linhas = texto.split(/\r?\n/);
    const decl = declaracoes(sf);
    let guardado = false;
    const candidatos = [];
    visitar(sf, (n) => {
      if (!ts.isJsxAttribute(n) || !n.initializer || !ts.isJsxExpression(n.initializer) || !n.initializer.expression) return;
      const nome = n.name.getText(sf);
      const expr = n.initializer.expression;
      if (nome === 'disabled' && ESTADO.test(expr.getText(sf))) guardado = true;
      if (nome !== 'onSubmit' && nome !== 'onClick') return;
      const fn = ts.isIdentifier(expr) ? decl.get(expr.text) : ts.isFunctionLike(expr) ? expr : undefined;
      const alcancado = textoAlcancado(fn, decl, sf);
      if (!alcancado.includes('fetch(') || !MUTANTE.test(alcancado)) return;
      const linha = linhaDe(sf, n);
      const pragma = temPragma(`${linhas[linha - 2] ?? ''}\n${linhas[linha - 1]}`, 'envio-em-voo') || temPragma(fn?.getText(sf) ?? '', 'envio-em-voo');
      if (!pragma) candidatos.push(linha);
    });
    if (guardado) return [];
    return candidatos.map((linha) => ({ arquivo: rel, linha, regra: 'envio-em-voo', mensagem: 'envio com fetch mutante sem estado enviando|salvando|processando em disabled' }));
  },
};

executarSeDireto(import.meta.url, [regra]);
