import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_V2 } from '../src/lib/menu-v2';

const GRUPOS = [
  'COMERCIAL',
  'GESTÃO',
  'RECEBIMENTO & BALANÇA',
  'DESOSSA',
  'ESTOQUE',
  'CARGA',
  'FATURAMENTO',
  'CADASTROS & REGRAS',
  'ADMINISTRAÇÃO',
];

/** ALL_NAV_GROUPS de src/app/components/Layout.tsx do protótipo (feature/completude-v1.1). */
const ITENS_PROTOTIPO: [string, string, string][] = [
  ['COMERCIAL', 'Clientes', '/comercial/clientes'],
  ['COMERCIAL', 'Pedidos de Venda', '/comercial/pedidos'],
  ['COMERCIAL', 'Tabela de Preços', '/comercial/tabela-precos'],
  ['COMERCIAL', 'Disponibilidade', '/comercial/disponibilidade'],
  ['COMERCIAL', 'Espelho Comercial', '/comercial/espelho'],
  ['GESTÃO', 'Painel Geral da Operação', '/gestao/dashboard'],
  ['GESTÃO', 'Operações', '/gestao/operacoes'],
  ['GESTÃO', 'Compras', '/gestao/compras'],
  ['GESTÃO', 'Pendências de Overbooking', '/gestao/overbooking'],
  ['GESTÃO', 'Aprovações & Ocorrências', '/gestao/aprovacoes'],
  ['GESTÃO', 'Relatórios & SIF', '/gestao/relatorios'],
  ['RECEBIMENTO & BALANÇA', 'Recebimento de Carga', '/recebimento/recebimento-carga'],
  ['RECEBIMENTO & BALANÇA', 'Pesagem e Destinação', '/recebimento/pesagem-destinacao'],
  ['RECEBIMENTO & BALANÇA', 'Etiquetas', '/recebimento/etiquetas'],
  ['DESOSSA', 'Dashboard da Desossa', '/desossa/dashboard'],
  ['DESOSSA', 'Pesagem e Destinação', '/desossa/pesagem-destinacao'],
  ['DESOSSA', 'Etiquetas', '/desossa/etiquetas'],
  ['ESTOQUE', 'Consulta de Estoque', '/estoque/consulta'],
  ['ESTOQUE', 'Entrada de Itens', '/estoque/entrada-itens'],
  ['ESTOQUE', 'Ajustes', '/estoque/ajustes'],
  ['CARGA', 'Planejamento de Carga', '/carga/planejamento'],
  ['CARGA', 'Conferência', '/carga/conferencia'],
  ['CARGA', 'Enviar para Faturamento', '/carga/enviar-faturamento'],
  ['FATURAMENTO', 'Pré-Faturamento', '/faturamento/pre-faturamento'],
  ['FATURAMENTO', 'Notas / XML', '/faturamento/notas-xml'],
  ['FATURAMENTO', 'Seguro Manual', '/faturamento/seguro-manual'],
  ['FATURAMENTO', 'Liberação do Caminhão', '/faturamento/liberacao'],
  ['CADASTROS & REGRAS', 'Representantes', '/cadastros/representantes'],
  ['CADASTROS & REGRAS', 'Produtos', '/cadastros/produtos'],
  ['CADASTROS & REGRAS', 'Fornecedores / Frigoríficos', '/cadastros/fornecedores'],
  ['CADASTROS & REGRAS', 'Caminhões', '/cadastros/caminhoes'],
  ['CADASTROS & REGRAS', 'Motoristas', '/cadastros/motoristas'],
  ['CADASTROS & REGRAS', 'Rotas / Itinerários', '/cadastros/rotas'],
  ['CADASTROS & REGRAS', 'Regras de Transformação', '/cadastros/regras-transformacao'],
  ['CADASTROS & REGRAS', 'Modelos de Etiqueta', '/cadastros/modelos-etiqueta'],
  ['ADMINISTRAÇÃO', 'Usuários', '/admin/usuarios'],
  ['ADMINISTRAÇÃO', 'Perfis de Acesso', '/admin/perfis'],
  ['ADMINISTRAÇÃO', 'Parâmetros', '/admin/parametros'],
  ['ADMINISTRAÇÃO', 'Auditoria', '/admin/auditoria'],
];

describe('menu canônico v2', () => {
  it('MENU_V2 tem os 9 grupos na ordem do prototipo', () => {
    expect(MENU_V2.map((g) => g.title)).toEqual(GRUPOS);
  });

  it('MENU_V2 tem os 39 itens com rotulo e rota do prototipo', () => {
    const atual = MENU_V2.flatMap((g) => g.items.map((i) => [g.title, i.label, i.href]));
    expect(atual).toEqual(ITENS_PROTOTIPO);
    expect(atual).toHaveLength(39);
  });

  it('todo grupo declara ao menos uma permissao de grupo e todo item ao menos uma permissao', () => {
    for (const grupo of MENU_V2) {
      expect(grupo.permissoesGrupo.length).toBeGreaterThan(0);
      for (const item of grupo.items) {
        expect(item.permissoes.length).toBeGreaterThan(0);
      }
    }
  });

  it('toda rota do menu tem page.tsx correspondente', () => {
    const semRota = MENU_V2.flatMap((g) => g.items)
      .map((i) => i.href)
      .filter((href) => !existsSync(join('src', 'app', '(admin)', ...href.slice(1).split('/'), 'page.tsx')));
    expect(semRota).toEqual([]);
  });
});
