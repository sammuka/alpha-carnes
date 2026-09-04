import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MENU_V2,
  ROTAS_CANONICAS,
  ROTA_ENTRADA_POR_PERFIL,
  filtrarMenuPorMenusVisiveis,
  rotaDeEntrada,
} from '../src/lib/menu-v2';

const RBAC = join(__dirname, '..', '..', 'backend', 'src', 'common', 'rbac');
const MENUS_POR_PERFIL = JSON.parse(
  readFileSync(join(RBAC, 'perfil-menus.snapshot.json'), 'utf8'),
) as Record<string, string[]>;
const PERMISSOES_POR_PERFIL = JSON.parse(
  readFileSync(join(RBAC, 'perfil-permissoes.snapshot.json'), 'utf8'),
) as Record<string, string[]>;

/**
 * Coluna "Perfis RBAC" da matriz de rastreabilidade v1.1 (linhas 3–41), transcrita rota a rota.
 * É a fonte contra a qual `menus_visiveis` é conferido: são as mesmas 126 atribuições.
 */
const MATRIZ_RASTREABILIDADE: Record<string, string[]> = {
  '/comercial/clientes': ['comercial', 'gestor', 'administrador', 'faturamento'],
  '/comercial/pedidos': ['comercial', 'gestor', 'administrador', 'faturamento', 'expedicao'],
  '/comercial/tabela-precos': ['gestor', 'administrador', 'comercial'],
  '/comercial/disponibilidade': ['comercial', 'gestor', 'diretoria', 'administrador'],
  '/comercial/espelho': ['comercial', 'gestor', 'expedicao', 'administrador'],
  '/gestao/dashboard': ['gestor', 'diretoria', 'administrador'],
  '/gestao/operacoes': ['gestor', 'compras', 'administrador'],
  '/gestao/compras': ['compras', 'gestor', 'administrador', 'comercial'],
  '/gestao/overbooking': ['gestor', 'administrador', 'comercial', 'compras'],
  '/gestao/aprovacoes': ['gestor', 'administrador', 'recebimento_pesagem', 'diretoria'],
  '/gestao/relatorios': ['gestor', 'faturamento', 'administrador', 'diretoria'],
  '/recebimento/recebimento-carga': ['recebimento_pesagem', 'gestor', 'administrador', 'compras', 'faturamento'],
  '/recebimento/pesagem-destinacao': ['recebimento_pesagem', 'gestor', 'administrador'],
  '/recebimento/etiquetas': ['recebimento_pesagem', 'gestor', 'administrador'],
  '/desossa/dashboard': ['corte', 'gestor', 'administrador', 'comercial'],
  '/desossa/pesagem-destinacao': ['corte', 'gestor', 'administrador'],
  '/desossa/etiquetas': ['corte', 'gestor', 'administrador'],
  '/estoque/consulta': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/estoque/entrada-itens': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/estoque/ajustes': ['expedicao', 'recebimento_pesagem', 'gestor', 'administrador'],
  '/carga/planejamento': ['expedicao', 'gestor', 'administrador'],
  '/carga/conferencia': ['conferente', 'expedicao', 'gestor', 'administrador'],
  '/carga/enviar-faturamento': ['expedicao', 'gestor', 'administrador'],
  '/faturamento/pre-faturamento': ['faturamento', 'gestor', 'administrador'],
  '/faturamento/notas-xml': ['faturamento', 'gestor', 'administrador', 'logistica', 'diretoria'],
  '/faturamento/seguro-manual': ['faturamento', 'logistica', 'gestor', 'administrador'],
  '/faturamento/liberacao': ['logistica', 'faturamento', 'gestor', 'administrador'],
  '/cadastros/representantes': ['administrador', 'gestor'],
  '/cadastros/produtos': ['administrador', 'gestor'],
  '/cadastros/fornecedores': ['administrador', 'gestor', 'compras'],
  '/cadastros/caminhoes': ['administrador', 'gestor', 'expedicao'],
  '/cadastros/motoristas': ['administrador', 'gestor', 'expedicao'],
  '/cadastros/rotas': ['administrador', 'gestor'],
  '/cadastros/regras-transformacao': ['administrador', 'gestor'],
  '/cadastros/modelos-etiqueta': ['administrador', 'gestor'],
  '/admin/usuarios': ['administrador'],
  '/admin/perfis': ['administrador'],
  '/admin/parametros': ['administrador'],
  '/admin/auditoria': ['administrador', 'diretoria', 'gestor'],
};

/** Decisão 25 da Onda 2 — as 26 rotas que o gate de grupo retirava do menu. Devem estar visíveis. */
const PERDAS_HERDADAS: Record<string, string[]> = {
  compras: ['/recebimento/recebimento-carga'],
  comercial: ['/gestao/compras', '/gestao/overbooking', '/desossa/dashboard'],
  recebimento_pesagem: ['/gestao/aprovacoes', '/estoque/consulta', '/estoque/entrada-itens', '/estoque/ajustes'],
  expedicao: [
    '/comercial/pedidos', '/comercial/espelho', '/estoque/consulta', '/estoque/entrada-itens',
    '/estoque/ajustes', '/cadastros/caminhoes', '/cadastros/motoristas',
  ],
  conferente: ['/carga/conferencia'],
  faturamento: ['/comercial/clientes', '/comercial/pedidos', '/recebimento/recebimento-carga'],
  logistica: ['/faturamento/notas-xml', '/faturamento/seguro-manual', '/faturamento/liberacao'],
  diretoria: ['/gestao/dashboard', '/gestao/aprovacoes', '/gestao/relatorios', '/faturamento/notas-xml'],
};

/** Decisão 31 da Onda 2 — os 14 itens visíveis sem atribuição na matriz. Devem sumir. */
const EXTRAS_HERDADOS: Record<string, string[]> = {
  compras: [
    '/comercial/clientes', '/comercial/pedidos', '/comercial/disponibilidade', '/comercial/espelho',
    '/gestao/dashboard', '/gestao/aprovacoes', '/gestao/relatorios', '/cadastros/representantes',
    '/cadastros/produtos', '/cadastros/rotas', '/cadastros/regras-transformacao',
  ],
  diretoria: ['/comercial/clientes', '/comercial/pedidos', '/comercial/espelho'],
};

/**
 * Grupos visíveis por perfil — consequência direta de `menus_visiveis` (decisão 9).
 * Todas as listas estão na **ordem canônica do MENU_V2** (a mesma de `TODOS`), porque é essa a ordem
 * que `filtrarMenuPorMenusVisiveis` devolve. Ordem alfabética aqui quebraria DoD-10 em 8 dos 11 perfis.
 */
const TODOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
  'CARGA', 'FATURAMENTO', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];
const GRUPOS_ESPERADOS: Record<string, string[]> = {
  administrador: TODOS,
  gestor: TODOS,
  compras: ['GESTÃO', 'RECEBIMENTO & BALANÇA', 'CADASTROS & REGRAS'],
  comercial: ['COMERCIAL', 'GESTÃO', 'DESOSSA'],
  recebimento_pesagem: ['GESTÃO', 'RECEBIMENTO & BALANÇA', 'ESTOQUE'],
  corte: ['DESOSSA'],
  expedicao: ['COMERCIAL', 'ESTOQUE', 'CARGA', 'CADASTROS & REGRAS'],
  conferente: ['CARGA'],
  faturamento: ['COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'FATURAMENTO'],
  logistica: ['FATURAMENTO'],
  diretoria: ['COMERCIAL', 'GESTÃO', 'FATURAMENTO', 'ADMINISTRAÇÃO'],
};

const ROTAS_ENTRADA_ESPERADAS: Record<string, string> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  diretoria: '/gestao/dashboard',
  compras: '/gestao/compras',
  comercial: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  conferente: '/carga/conferencia',
  faturamento: '/faturamento/pre-faturamento',
  logistica: '/faturamento/liberacao',
};

const PERFIS = Object.keys(MENUS_POR_PERFIL).sort();

/** Acessos explícitos: sob `noUncheckedIndexedAccess`, indexar Record devolve `| undefined`. */
function menusDe(perfil: string): string[] {
  const menus = MENUS_POR_PERFIL[perfil];
  if (!menus) throw new Error(`perfil ausente no snapshot de menus: ${perfil}`);
  return menus;
}

/**
 * Não ordena de propósito: `GRUPOS_ESPERADOS` está na ordem canônica do MENU_V2 e DoD-10 compara
 * com `toEqual`, que é sensível à ordem. `PERDAS_HERDADAS`/`EXTRAS_HERDADOS` são consumidas com
 * `toContain`, então a ordem lá é irrelevante.
 */
function esperadoDe(tabela: Record<string, string[]>, perfil: string): string[] {
  const lista = tabela[perfil];
  if (!lista) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return lista;
}

/** Matriz invertida: rota→perfis vira perfil→rotas. */
function menusDaMatriz(perfil: string): string[] {
  return Object.entries(MATRIZ_RASTREABILIDADE)
    .filter(([, perfis]) => perfis.includes(perfil))
    .map(([href]) => href)
    .sort();
}

function rotasVisiveis(perfil: string): string[] {
  return filtrarMenuPorMenusVisiveis(menusDe(perfil)).flatMap((grupo) =>
    grupo.items.map((item) => item.href),
  );
}

describe('menu por menus_visiveis — reconciliação com a matriz', () => {
  it('o snapshot de menus cobre os 11 perfis canonicos do snapshot de permissoes', () => {
    expect(PERFIS).toEqual(Object.keys(PERMISSOES_POR_PERFIL).sort());
    expect(PERFIS).toHaveLength(11);
  });

  it('a matriz transcrita cobre exatamente as 39 rotas do menu (AD-15)', () => {
    expect(Object.keys(MATRIZ_RASTREABILIDADE).sort()).toEqual([...ROTAS_CANONICAS].sort());
    expect(ROTAS_CANONICAS).toHaveLength(39);
  });

  it.each(PERFIS)('menus_visiveis do perfil sao exatamente os da matriz: %s', (perfil) => {
    expect([...menusDe(perfil)].sort()).toEqual(menusDaMatriz(perfil));
  });

  it('a matriz soma 126 atribuicoes perfil x rota (AD-15 revogou 2 rotas da AD-11)', () => {
    const total = PERFIS.reduce((soma, perfil) => soma + menusDe(perfil).length, 0);
    expect(total).toBe(126);
    expect(Object.values(MATRIZ_RASTREABILIDADE).reduce((s, p) => s + p.length, 0)).toBe(126);
  });

  it('zero perdas: nenhuma rota da matriz fica fora do menu do perfil', () => {
    const perdas = PERFIS.flatMap((perfil) => {
      const visiveis = new Set(rotasVisiveis(perfil));
      return menusDaMatriz(perfil).filter((href) => !visiveis.has(href)).map((href) => `${perfil}:${href}`);
    });
    expect(perdas).toEqual([]);
  });

  it('zero extras: nenhum item visivel sem atribuicao na matriz', () => {
    const extras = PERFIS.flatMap((perfil) =>
      rotasVisiveis(perfil)
        .filter((href) => !(MATRIZ_RASTREABILIDADE[href] ?? []).includes(perfil))
        .map((href) => `${perfil}:${href}`),
    );
    expect(extras).toEqual([]);
  });

  it('as 26 perdas herdadas da Onda 2 estao visiveis', () => {
    const total = Object.values(PERDAS_HERDADAS).reduce((s, l) => s + l.length, 0);
    expect(total).toBe(26);
    for (const perfil of Object.keys(PERDAS_HERDADAS)) {
      const visiveis = rotasVisiveis(perfil);
      for (const href of esperadoDe(PERDAS_HERDADAS, perfil)) {
        expect(visiveis).toContain(href);
      }
    }
  });

  it('os 14 extras herdados da Onda 2 sumiram do menu', () => {
    const total = Object.values(EXTRAS_HERDADOS).reduce((s, l) => s + l.length, 0);
    expect(total).toBe(14);
    for (const perfil of Object.keys(EXTRAS_HERDADOS)) {
      const visiveis = rotasVisiveis(perfil);
      for (const href of esperadoDe(EXTRAS_HERDADOS, perfil)) {
        expect(visiveis).not.toContain(href);
      }
    }
  });

  it.each(PERFIS)('grupos visiveis batem com a tabela fixada: %s', (perfil) => {
    const esperado = esperadoDe(GRUPOS_ESPERADOS, perfil);
    // A tabela do plano precisa estar na ordem canônica; senão o toEqual abaixo vira loteria.
    expect(esperado).toEqual(TODOS.filter((titulo) => esperado.includes(titulo)));
    expect(filtrarMenuPorMenusVisiveis(menusDe(perfil)).map((g) => g.title)).toEqual(esperado);
  });

  it.each(PERFIS)('rota de entrada bate com a funcao primaria do perfil: %s', (perfil) => {
    const esperada = ROTAS_ENTRADA_ESPERADAS[perfil];
    if (!esperada) throw new Error(`perfil fora da tabela de rota de entrada: ${perfil}`);
    expect(rotaDeEntrada(menusDe(perfil), [perfil])).toBe(esperada);
    expect(rotasVisiveis(perfil)).toContain(esperada);
    expect(ROTA_ENTRADA_POR_PERFIL[perfil]).toBe(esperada);
  });

  it('usuario sem menu nao tem grupo nem rota de entrada', () => {
    expect(filtrarMenuPorMenusVisiveis([])).toEqual([]);
    expect(rotaDeEntrada([], ['administrador'])).toBeNull();
  });

  it('perfil sem rota primaria cai no primeiro menu visivel da ordem canonica', () => {
    expect(rotaDeEntrada(['/cadastros/produtos', '/comercial/clientes'], ['perfil_customizado']))
      .toBe('/comercial/clientes');
  });

  it('rota primaria nao visivel nao e usada', () => {
    expect(rotaDeEntrada(['/carga/conferencia'], ['gestor'])).toBe('/carga/conferencia');
  });

  it('href fora do catalogo nao vira item de menu', () => {
    expect(filtrarMenuPorMenusVisiveis(['/rota/inexistente'])).toEqual([]);
    expect(rotaDeEntrada(['/rota/inexistente'], ['gestor'])).toBeNull();
  });

  it('auditoria visivel para administrador, gestor e diretoria (matriz linha 41)', () => {
    for (const perfil of ['administrador', 'gestor', 'diretoria']) {
      expect(rotasVisiveis(perfil)).toContain('/admin/auditoria');
    }
    for (const perfil of ['compras', 'comercial', 'recebimento_pesagem', 'corte', 'expedicao', 'faturamento', 'conferente', 'logistica']) {
      expect(rotasVisiveis(perfil)).not.toContain('/admin/auditoria');
    }
  });

  it('gestor ve ADMINISTRAÇÃO apenas com Auditoria', () => {
    const admin = filtrarMenuPorMenusVisiveis(menusDe('gestor')).find((g) => g.title === 'ADMINISTRAÇÃO');
    expect(admin?.items.map((i) => i.href)).toEqual(['/admin/auditoria']);
  });

  it('todo grupo do MENU_V2 aparece para ao menos um perfil', () => {
    const titulos = new Set(PERFIS.flatMap((p) => filtrarMenuPorMenusVisiveis(menusDe(p)).map((g) => g.title)));
    expect([...titulos].sort()).toEqual(MENU_V2.map((g) => g.title).sort());
  });

  it('menus visiveis por perfil batem com a matriz apos as permissoes da onda 4', () => {
    // As 4 permissões da Onda 4 são de API, não de menu: o menu por perfil não pode se mexer.
    for (const perfil of PERFIS) {
      expect(rotasVisiveis(perfil).sort()).toEqual(menusDaMatriz(perfil));
    }
    expect(ROTAS_CANONICAS).toHaveLength(39);
    expect(PERFIS.reduce((soma, p) => soma + menusDe(p).length, 0)).toBe(126);

    // E as permissões novas chegaram ao snapshot, nos perfis de D21.
    const novas = [
      'TABELA_PRECO_LER', 'TABELA_PRECO_GERENCIAR',
      'ESPELHO_COMERCIAL_LER', 'PEDIDO_RESERVA_LIBERAR',
    ];
    expect(PERMISSOES_POR_PERFIL.administrador).toEqual(expect.arrayContaining(novas));
    expect(PERMISSOES_POR_PERFIL.gestor).toEqual(expect.arrayContaining(novas));
    expect(PERMISSOES_POR_PERFIL.comercial)
      .toEqual(expect.arrayContaining(['TABELA_PRECO_LER', 'ESPELHO_COMERCIAL_LER']));
    expect(PERMISSOES_POR_PERFIL.comercial).not.toContain('PEDIDO_RESERVA_LIBERAR');
    expect(PERMISSOES_POR_PERFIL.expedicao).toContain('ESPELHO_COMERCIAL_LER');
  });
});
