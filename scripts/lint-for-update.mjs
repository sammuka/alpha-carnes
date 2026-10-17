/**
 * Achado recorrente de concorrência: transação que lê o pai e insere filha sem travar o pai
 * (`.for('update' | 'share')`) deixa o pai mudar de estado entre a leitura e o insert.
 * Supressão documentada: `// for-update: ok — <motivo>` dentro do callback da transação.
 */
import { ehTeste, executarSeDireto, linhaDe, metodo, parse, temPragma, ts, visitar } from './lint-lib.mjs';

export const regra = {
  ids: ['for-update-pai'],
  alvo: (rel) => /^app\/backend\/src\/.*\.service\.ts$/.test(rel) && !ehTeste(rel),
  verificar(rel, texto) {
    const sf = parse(rel, texto);
    const achados = [];
    visitar(sf, (node) => {
      if (metodo(node) !== 'transaction') return;
      const cb = node.arguments[0];
      if (!cb || !ts.isFunctionLike(cb)) return;
      const corpo = cb.getText(sf);
      if (temPragma(corpo, 'for-update') || /\bFOR\s+(NO\s+KEY\s+)?(UPDATE|SHARE)\b/i.test(corpo)) return;
      const inserts = [];
      const lidas = new Set();
      let trava = false;
      const tabela = (call) => call.arguments[0]?.getText(sf) ?? '';
      visitar(cb, (n) => {
        const m = metodo(n);
        if (m === 'insert') inserts.push(n);
        else if (m === 'from') lidas.add(tabela(n));
        else if (m === 'findFirst' || m === 'findMany') lidas.add(n.expression.expression.getText(sf).replace(/^.*\.query\./, ''));
        else if (m === 'for') trava = true;
      });
      // insert na MESMA tabela lida é checagem de unicidade (a constraint cobre); filha = tabela diferente da lida
      const filha = inserts.find((i) => !lidas.has(tabela(i)));
      if (filha && lidas.size && !trava) {
        achados.push({ arquivo: rel, linha: linhaDe(sf, filha), regra: 'for-update-pai', mensagem: "insert de filha em transação que lê o pai sem .for('update'|'share')" });
      }
    });
    return achados;
  },
};

executarSeDireto(import.meta.url, [regra]);
