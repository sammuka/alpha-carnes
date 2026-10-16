import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_V2, filtrarMenuPorMenusVisiveis } from '../src/lib/menu-v2';
import { CADASTROS } from '../src/lib/cadastros-config';

const GRUPOS = [
  'COMERCIAL',
  'GESTÃO',
  'RECEBIMENTO & BALANÇA',
  'DESOSSA',
  'ESTOQUE',
  'CARGA',
  'FATURAMENTO',
  'FISCAL',
  'CONTABILIDADE',
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

/** Itens do ERP integrado (AD-24 (1)): grupos FISCAL (8ª posição) e CONTABILIDADE (9ª), fora do protótipo v1.1. */
const ITENS_ERP: [string, string, string][] = [
  ['FISCAL', 'Empresas, estabelecimentos e regime', '/fiscal/empresas'],
  ['FISCAL', 'Operações fiscais e enquadramentos', '/fiscal/enquadramentos'],
  ['FISCAL', 'Editor de regras tributárias', '/fiscal/regras'],
  ['FISCAL', 'Simulador fiscal e memória de cálculo', '/fiscal/simulador'],
  ['FISCAL', 'Painel de alterações e homologação de regras', '/fiscal/homologacao'],
  ['CONTABILIDADE', 'Plano de contas e centros de custo', '/erp/contabilidade/plano-de-contas'],
];

describe('menu canônico v2', () => {
  it('MENU_V2 tem os 11 grupos, com FISCAL na 8ª e CONTABILIDADE na 9ª posição', () => {
    expect(MENU_V2.map((g) => g.title)).toEqual(GRUPOS);
    expect(MENU_V2[7]?.title).toBe('FISCAL');
    expect(MENU_V2[8]?.title).toBe('CONTABILIDADE');
    expect(MENU_V2).toHaveLength(11);
  });

  it('MENU_V2 mantém os 39 itens com rotulo e rota do prototipo (AD-15) e soma os itens do ERP', () => {
    const atual = MENU_V2.flatMap((g) => g.items.map((i) => [g.title, i.label, i.href]));
    const semFiscal = atual.filter(([grupo]) => grupo !== 'FISCAL' && grupo !== 'CONTABILIDADE');
    expect(semFiscal).toEqual(ITENS_PROTOTIPO);
    expect(semFiscal).toHaveLength(39);
    expect(atual.filter(([grupo]) => grupo === 'FISCAL')).toEqual(ITENS_ERP.slice(0, 5));
    expect(atual.filter(([grupo]) => grupo === 'FISCAL' || grupo === 'CONTABILIDADE')).toEqual(ITENS_ERP);
    expect(atual).toHaveLength(45);
    expect(atual).toContainEqual([
      'CONTABILIDADE',
      'Plano de contas e centros de custo',
      '/erp/contabilidade/plano-de-contas',
    ]);
    expect(atual.some(([, , href]) => /e\d{2}-t\d{2}/i.test(String(href)))).toBe(false);
  });

  it('o item FISCAL declara a permissão FISCAL_EMPRESAS_LER e o ícone Landmark', () => {
    const item = MENU_V2.find((g) => g.title === 'FISCAL')?.items[0];
    expect(item?.permissao).toBe('FISCAL_EMPRESAS_LER');
    expect(item?.iconKey).toBe('Landmark');
  });

  it('menu atribuído sem a permissão FISCAL_EMPRESAS_LER não devolve o item nem o grupo FISCAL', () => {
    const visiveis = ['/fiscal/empresas', '/comercial/clientes'];
    const semPermissao = filtrarMenuPorMenusVisiveis(visiveis, ['CLIENTES_LER']);
    expect(semPermissao.map((g) => g.title)).toEqual(['COMERCIAL']);
    expect(semPermissao.flatMap((g) => g.items.map((i) => i.href))).not.toContain('/fiscal/empresas');
    // Sem o segundo argumento o filtro também é fail-closed.
    expect(filtrarMenuPorMenusVisiveis(visiveis).map((g) => g.title)).toEqual(['COMERCIAL']);
    const comPermissao = filtrarMenuPorMenusVisiveis(visiveis, ['FISCAL_EMPRESAS_LER']);
    expect(comPermissao.map((g) => g.title)).toEqual(['COMERCIAL', 'FISCAL']);
  });

  it('menusVisiveis com as duas rotas fiscais e só FISCAL_EMPRESAS_LER esconde enquadramentos', () => {
    const visiveis = ['/fiscal/empresas', '/fiscal/enquadramentos'];
    const grupos = filtrarMenuPorMenusVisiveis(visiveis, ['FISCAL_EMPRESAS_LER']);
    const hrefs = grupos.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain('/fiscal/empresas');
    expect(hrefs).not.toContain('/fiscal/enquadramentos');
  });

  it('permissão só FISCAL_EMPRESAS_LER mostra empresas e esconde regras e enquadramentos', () => {
    const visiveis = ['/fiscal/empresas', '/fiscal/enquadramentos', '/fiscal/regras'];
    const grupos = filtrarMenuPorMenusVisiveis(visiveis, ['FISCAL_EMPRESAS_LER']);
    const hrefs = grupos.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain('/fiscal/empresas');
    expect(hrefs).not.toContain('/fiscal/regras');
    expect(hrefs).not.toContain('/fiscal/enquadramentos');
  });

  it('permissão só FISCAL_EMPRESAS_LER mostra empresas e esconde o painel', () => {
    const visiveis = [
      '/fiscal/empresas',
      '/fiscal/enquadramentos',
      '/fiscal/regras',
      '/fiscal/simulador',
      '/fiscal/homologacao',
    ];
    const grupos = filtrarMenuPorMenusVisiveis(visiveis, ['FISCAL_EMPRESAS_LER']);
    const hrefs = grupos.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain('/fiscal/empresas');
    expect(hrefs).not.toContain('/fiscal/homologacao');
  });

  it('permissão só FISCAL_EMPRESAS_LER mostra empresas e esconde o simulador', () => {
    const visiveis = ['/fiscal/empresas', '/fiscal/enquadramentos', '/fiscal/regras', '/fiscal/simulador'];
    const grupos = filtrarMenuPorMenusVisiveis(visiveis, ['FISCAL_EMPRESAS_LER']);
    const hrefs = grupos.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain('/fiscal/empresas');
    expect(hrefs).not.toContain('/fiscal/simulador');
    expect(hrefs).not.toContain('/fiscal/regras');
    expect(hrefs).not.toContain('/fiscal/enquadramentos');
  });

  it('MENU_V2 nao tem rota duplicada e todo item declara icone', () => {
    const hrefs = MENU_V2.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const grupo of MENU_V2) {
      for (const item of grupo.items) {
        expect(item.iconKey.length).toBeGreaterThan(0);
      }
    }
  });

  it('toda rota do menu tem page.tsx correspondente (dedicada ou via [recurso] genérico)', () => {
    const recursoGenerico = existsSync(join('src', 'app', '(admin)', 'cadastros', '[recurso]', 'page.tsx'));
    const semRota = MENU_V2.flatMap((g) => g.items)
      .map((i) => i.href)
      .filter((href) => {
        if (existsSync(join('src', 'app', '(admin)', ...href.slice(1).split('/'), 'page.tsx'))) return false;
        const recurso = href.startsWith('/cadastros/') ? href.slice('/cadastros/'.length) : null;
        return !(recurso && recursoGenerico && recurso in CADASTROS);
      });
    expect(semRota).toEqual([]);
  });

  it('a rota nova /fiscal/empresas tem page.tsx dedicada', () => {
    expect(existsSync(join('src', 'app', '(admin)', 'fiscal', 'empresas', 'page.tsx'))).toBe(true);
  });
});
