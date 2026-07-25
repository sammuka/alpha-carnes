import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MENU_V2, filtrarMenuPorPermissoes, rotaDeEntrada } from '../src/lib/menu-v2';

const SNAPSHOT = join(
  __dirname, '..', '..', 'backend', 'src', 'common', 'rbac', 'perfil-permissoes.snapshot.json',
);
const PERMISSOES_POR_PERFIL = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as Record<string, string[]>;

const TODOS = [
  'COMERCIAL', 'GESTÃO', 'RECEBIMENTO & BALANÇA', 'DESOSSA', 'ESTOQUE',
  'CARGA', 'FATURAMENTO', 'CADASTROS & REGRAS', 'ADMINISTRAÇÃO',
];

/**
 * Tabela fixada no plano da Onda 2 (decisões 10–13, 25 e 30).
 * Personas do protótipo cobertas: administrador, gestor, comercial,
 * recebimento_pesagem, corte (Desossa), expedicao (Carga).
 * `faturamento` também vê GESTÃO, restrita a Relatórios & SIF (decisões 11 e 30).
 * conferente/logistica ficam sem grupo até a matriz AD-04 da Onda 3.
 */
const GRUPOS_ESPERADOS: Record<string, string[]> = {
  administrador: TODOS,
  gestor: TODOS,
  compras: ['COMERCIAL', 'GESTÃO', 'CADASTROS & REGRAS'],
  comercial: ['COMERCIAL'],
  recebimento_pesagem: ['RECEBIMENTO & BALANÇA'],
  corte: ['DESOSSA'],
  expedicao: ['CARGA'],
  faturamento: ['GESTÃO', 'FATURAMENTO'],
  diretoria: ['COMERCIAL', 'ADMINISTRAÇÃO'],
  conferente: [],
  logistica: [],
};

/**
 * Coluna "Perfis RBAC" da matriz de rastreabilidade v1.1 (linhas 3–41), transcrita rota a
 * rota — inclui os papéis secundários ("consulta", "registro"). É a referência contra a qual
 * as decisões 25, 30 e 31 são aferidas.
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

/** Decisão 25 — as 26 rotas que a matriz atribui e o gate de grupo retira do menu. */
const PERDAS_DECLARADAS: Record<string, string[]> = {
  administrador: [],
  gestor: [],
  compras: ['/recebimento/recebimento-carga'],
  comercial: ['/gestao/compras', '/gestao/overbooking', '/desossa/dashboard'],
  recebimento_pesagem: [
    '/gestao/aprovacoes',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
  ],
  corte: [],
  expedicao: [
    '/comercial/pedidos',
    '/comercial/espelho',
    '/estoque/consulta',
    '/estoque/entrada-itens',
    '/estoque/ajustes',
    '/cadastros/caminhoes',
    '/cadastros/motoristas',
  ],
  conferente: ['/carga/conferencia'],
  faturamento: ['/comercial/clientes', '/comercial/pedidos', '/recebimento/recebimento-carga'],
  logistica: ['/faturamento/notas-xml', '/faturamento/seguro-manual', '/faturamento/liberacao'],
  diretoria: [
    '/gestao/dashboard',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/faturamento/notas-xml',
  ],
};

/** Decisão 31 — itens visíveis cujo perfil a matriz não nomeia (perfis sem persona no protótipo). */
const EXTRAS_DECLARADOS: Record<string, string[]> = {
  administrador: [],
  gestor: [],
  compras: [
    '/comercial/clientes',
    '/comercial/pedidos',
    '/comercial/disponibilidade',
    '/comercial/espelho',
    '/gestao/dashboard',
    '/gestao/aprovacoes',
    '/gestao/relatorios',
    '/cadastros/representantes',
    '/cadastros/produtos',
    '/cadastros/rotas',
    '/cadastros/regras-transformacao',
  ],
  comercial: [],
  recebimento_pesagem: [],
  corte: [],
  expedicao: [],
  conferente: [],
  faturamento: [],
  logistica: [],
  diretoria: ['/comercial/clientes', '/comercial/pedidos', '/comercial/espelho'],
};

/** Tabela fixada da decisão 26 — rota de entrada por perfil. */
const ROTAS_ENTRADA_ESPERADAS: Record<string, string | null> = {
  administrador: '/gestao/dashboard',
  gestor: '/gestao/dashboard',
  compras: '/gestao/dashboard',
  comercial: '/comercial/clientes',
  diretoria: '/comercial/clientes',
  recebimento_pesagem: '/recebimento/recebimento-carga',
  corte: '/desossa/dashboard',
  expedicao: '/carga/planejamento',
  faturamento: '/faturamento/pre-faturamento',
  conferente: null,
  logistica: null,
};

/** Acessos explícitos: sob `noUncheckedIndexedAccess`, indexar Record devolve `| undefined`. */
function permissoesDe(perfil: string): string[] {
  const permissoes = PERMISSOES_POR_PERFIL[perfil];
  if (!permissoes) throw new Error(`perfil ausente no snapshot RBAC do backend: ${perfil}`);
  return permissoes;
}

function gruposEsperadosDe(perfil: string): string[] {
  const grupos = GRUPOS_ESPERADOS[perfil];
  if (!grupos) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return grupos;
}

function rotaEsperadaDe(perfil: string): string | null {
  if (!(perfil in ROTAS_ENTRADA_ESPERADAS)) {
    throw new Error(`perfil fora da tabela de rota de entrada do plano: ${perfil}`);
  }
  return ROTAS_ENTRADA_ESPERADAS[perfil] ?? null;
}

function rotasVisiveis(perfil: string): string[] {
  return filtrarMenuPorPermissoes(permissoesDe(perfil)).flatMap((grupo) =>
    grupo.items.map((item) => item.href),
  );
}

function listaDeclarada(tabela: Record<string, string[]>, perfil: string): string[] {
  const lista = tabela[perfil];
  if (!lista) throw new Error(`perfil fora da tabela fixada do plano: ${perfil}`);
  return [...lista].sort();
}

/** Rotas que a matriz atribui ao perfil e o menu não mostra. */
function perdasCalculadas(perfil: string): string[] {
  const visiveis = new Set(rotasVisiveis(perfil));
  return Object.entries(MATRIZ_RASTREABILIDADE)
    .filter(([href, perfis]) => perfis.includes(perfil) && !visiveis.has(href))
    .map(([href]) => href)
    .sort();
}

/** Rotas que o menu mostra e a matriz não atribui ao perfil. */
function extrasCalculados(perfil: string): string[] {
  return rotasVisiveis(perfil)
    .filter((href) => !(MATRIZ_RASTREABILIDADE[href] ?? []).includes(perfil))
    .sort();
}

function grupoDaRota(href: string) {
  const grupo = MENU_V2.find((g) => g.items.some((item) => item.href === href));
  if (!grupo) throw new Error(`rota fora do MENU_V2: ${href}`);
  return grupo;
}

describe('visibilidade do menu por RBAC real', () => {
  it('a tabela fixada cobre os 11 perfis do catalogo', () => {
    const perfis = Object.keys(PERMISSOES_POR_PERFIL).sort();
    expect(Object.keys(GRUPOS_ESPERADOS).sort()).toEqual(perfis);
    expect(Object.keys(ROTAS_ENTRADA_ESPERADAS).sort()).toEqual(perfis);
    expect(Object.keys(PERDAS_DECLARADAS).sort()).toEqual(perfis);
    expect(Object.keys(EXTRAS_DECLARADOS).sort()).toEqual(perfis);
  });

  it('a matriz transcrita cobre exatamente as 39 rotas do menu', () => {
    const rotasMenu = MENU_V2.flatMap((grupo) => grupo.items.map((item) => item.href)).sort();
    expect(Object.keys(MATRIZ_RASTREABILIDADE).sort()).toEqual(rotasMenu);
    expect(rotasMenu).toHaveLength(39);
  });

  it.each(Object.keys(GRUPOS_ESPERADOS))(
    'visibilidade de grupo por perfil canonico bate com a tabela fixada: %s',
    (perfil) => {
      const grupos = filtrarMenuPorPermissoes(permissoesDe(perfil)).map((g) => g.title);
      expect(grupos).toEqual(gruposEsperadosDe(perfil));
    },
  );

  it.each(Object.keys(ROTAS_ENTRADA_ESPERADAS))(
    'rota de entrada por perfil canonico bate com a tabela fixada: %s',
    (perfil) => {
      expect(rotaDeEntrada(permissoesDe(perfil))).toBe(rotaEsperadaDe(perfil));
    },
  );

  it('rota de entrada esta sempre dentro do menu visivel do proprio perfil', () => {
    for (const perfil of Object.keys(ROTAS_ENTRADA_ESPERADAS)) {
      const rota = rotaDeEntrada(permissoesDe(perfil));
      if (rota) expect(rotasVisiveis(perfil)).toContain(rota);
      else expect(rotasVisiveis(perfil)).toEqual([]);
    }
  });

  it('perfil sem permissao de grupo resulta em zero grupos', () => {
    expect(filtrarMenuPorPermissoes([])).toEqual([]);
    expect(rotaDeEntrada([])).toBeNull();
    expect(filtrarMenuPorPermissoes(permissoesDe('conferente'))).toEqual([]);
  });

  it('gestor ve ADMINISTRAÇÃO apenas com Auditoria (matriz linha 41)', () => {
    const admin = filtrarMenuPorPermissoes(permissoesDe('gestor')).find(
      (g) => g.title === 'ADMINISTRAÇÃO',
    );
    expect(admin?.items.map((i) => i.href)).toEqual(['/admin/auditoria']);
  });

  it('auditoria fica visivel para administrador, gestor e diretoria (matriz linha 41)', () => {
    for (const perfil of ['administrador', 'gestor', 'diretoria']) {
      expect(rotasVisiveis(perfil)).toContain('/admin/auditoria');
    }
    for (const perfil of ['compras', 'comercial', 'recebimento_pesagem', 'corte', 'expedicao', 'faturamento', 'conferente', 'logistica']) {
      expect(rotasVisiveis(perfil)).not.toContain('/admin/auditoria');
    }
  });

  it.each(Object.keys(PERDAS_DECLARADAS))(
    'perdas declaradas conferem com o catalogo e a matriz: %s',
    (perfil) => {
      expect(perdasCalculadas(perfil)).toEqual(listaDeclarada(PERDAS_DECLARADAS, perfil));
    },
  );

  it('a decisao 25 declara exatamente 26 perdas', () => {
    const total = Object.keys(PERDAS_DECLARADAS).reduce(
      (soma, perfil) => soma + perdasCalculadas(perfil).length,
      0,
    );
    expect(total).toBe(26);
  });

  it('toda perda declarada e efeito do gate de grupo, nunca do filtro de item', () => {
    for (const perfil of Object.keys(PERDAS_DECLARADAS)) {
      const concedidas = new Set(permissoesDe(perfil));
      for (const href of listaDeclarada(PERDAS_DECLARADAS, perfil)) {
        const grupo = grupoDaRota(href);
        expect(grupo.permissoesGrupo.some((p) => concedidas.has(p))).toBe(false);
      }
    }
  });

  it.each(Object.keys(EXTRAS_DECLARADOS))(
    'itens visiveis sem atribuicao na matriz conferem com a lista declarada: %s',
    (perfil) => {
      expect(extrasCalculados(perfil)).toEqual(listaDeclarada(EXTRAS_DECLARADOS, perfil));
    },
  );

  it('faturamento ve Relatorios & SIF e nada mais em GESTÃO (matriz linha 13)', () => {
    const gestao = filtrarMenuPorPermissoes(permissoesDe('faturamento')).find(
      (grupo) => grupo.title === 'GESTÃO',
    );
    expect(gestao?.items.map((item) => item.href)).toEqual(['/gestao/relatorios']);
  });

  it('compras ve Pendencias de Overbooking (matriz linha 11)', () => {
    expect(rotasVisiveis('compras')).toContain('/gestao/overbooking');
  });

  it('comercial nao ve tabela de precos sem PEDIDOS_GERENCIAR', () => {
    const permissoes = permissoesDe('comercial').filter((p) => p !== 'PEDIDOS_GERENCIAR');
    const comercial = filtrarMenuPorPermissoes(permissoes).find((g) => g.title === 'COMERCIAL');
    expect(comercial?.items.map((i) => i.href)).not.toContain('/comercial/tabela-precos');
  });
});
