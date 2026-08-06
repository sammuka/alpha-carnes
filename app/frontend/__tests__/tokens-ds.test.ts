import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GLOBALS = join('src', 'app', 'globals.css');
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/;

/**
 * Hex dentro de seletor de atributo CSS (ex.: `[stroke='#ccc']`) não é cor aplicada:
 * é o valor que a biblioteca de terceiro escreve no atributo e que o seletor precisa
 * casar literalmente. Critério global e sintático — decisão 23, sem exceção por path.
 */
const SELETOR_ATRIBUTO = /\[[a-zA-Z-]+=['"]#[0-9a-fA-F]{3,8}['"]\]/g;

function semSeletoresDeAtributo(texto: string): string {
  return texto.replace(SELETOR_ATRIBUTO, '');
}

function caminhoPosix(file: string): string {
  return file.split('\\').join('/');
}

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fontes(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function folhas(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return folhas(path);
    return entry.name.endsWith('.css') && path !== GLOBALS ? [path] : [];
  });
}

function literaisDeCor(file: string, padrao: RegExp): string[] {
  const sf = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: string[] = [];
  const visit = (node: ts.Node): void => {
    const ehTexto =
      ts.isStringLiteralLike(node) ||
      ts.isJsxText(node) ||
      ts.isTemplateExpression(node) ||
      ts.isNoSubstitutionTemplateLiteral(node);
    if (ehTexto && padrao.test(semSeletoresDeAtributo(node.getText(sf)))) {
      hits.push(`${caminhoPosix(file)}:${sf.getLineAndCharacterOfPosition(node.pos).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

describe('tokens do DS', () => {
  const globals = readFileSync(GLOBALS, 'utf8');

  it('globals.css declara as 14 cores canônicas da paleta do prototipo', () => {
    const paleta: [string, string][] = [
      ['--color-brand-navy', '#24589E'],
      ['--color-brand-navy-hover', '#1D4880'],
      ['--color-brand-blue-mid', '#2D6BBE'],
      ['--color-brand-navy-10', '#E8F0FA'],
      ['--color-background', '#F4F6F9'],
      ['--color-foreground', '#18202C'],
      ['--color-text-secondary', '#4A5A6E'],
      ['--color-text-muted', '#93A1B3'],
      ['--color-status-expedido', '#177A43'],
      ['--color-status-divergencia', '#91620B'],
      ['--color-status-bloqueado', '#B3362A'],
      ['--color-status-recebido', '#1D5FAE'],
      ['--color-status-pesado', '#6636B8'],
      ['--color-border', '#DDE4EC'],
    ];
    const ausentes = paleta.filter(([token, hex]) => !globals.includes(`${token}: ${hex};`));
    expect(ausentes).toEqual([]);
  });

  it('globals.css declara os tokens de acao, superficie, login, pipeline e provisorio', () => {
    const inicio = globals.indexOf('@theme {');
    const fim = globals.indexOf('\n}', inicio);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fim).toBeGreaterThan(inicio);
    const theme = globals.slice(inicio, fim + 2);
    const tokens = [
      '--color-action-blue', '--color-action-blue-hover', '--color-action-blue-strong',
      '--color-action-blue-bg', '--color-action-blue-border', '--color-action-blue-text',
      '--color-surface-subtle', '--color-surface-chip', '--color-border-chip',
      '--color-text-strong', '--color-text-slate', '--color-text-graphite',
      '--color-login-panel', '--color-login-panel-caption', '--color-login-panel-text',
      '--color-login-heading', '--color-login-text',
      '--color-pipeline-done', '--color-pipeline-future',
      '--color-provisorio-bg', '--color-provisorio-text', '--color-provisorio-border',
      '--color-success-strong', '--color-success-surface',
      '--color-danger-strong', '--color-danger-surface',
      '--color-violet-accent', '--color-violet-surface',
      '--color-sidebar-popover',
      '--color-avatar-blue-bg', '--color-avatar-violet-bg',
      '--color-avatar-green-bg', '--color-avatar-amber-bg',
      '--color-table-zebra', '--color-table-row-hover', '--color-status-dot-ativo',
      '--color-danger-rose', '--color-info-surface', '--color-info-border',
      '--color-info-icon', '--color-info-ink', '--color-placeholder',
      '--color-brand-navy-deep', '--color-text-ink', '--color-warning-surface',
      '--color-warning-ink', '--color-action-blue-ring', '--color-code-surface',
    ];
    expect(tokens.filter((token) => !theme.includes(`${token}:`))).toEqual([]);
  });

  it('nenhum literal hexadecimal de cor em src fora de globals.css', () => {
    const hits = fontes('src').flatMap((file) => literaisDeCor(file, HEX));
    expect(hits).toEqual([]);
  });

  it('nenhum literal rgba em src fora de globals.css', () => {
    const hits = fontes('src').flatMap((file) => literaisDeCor(file, /rgba?\(/));
    expect(hits).toEqual([]);
  });

  it('hex em seletor de atributo CSS esta restrito ao inventario pinado', () => {
    const inventario: Record<string, string[]> = {};
    for (const file of fontes('src')) {
      const seletores = readFileSync(file, 'utf8').match(SELETOR_ATRIBUTO);
      if (seletores) inventario[caminhoPosix(file)] = seletores;
    }
    expect(inventario).toEqual({
      'src/components/ui/chart.tsx': [
        "[stroke='#ccc']",
        "[stroke='#ccc']",
        "[stroke='#ccc']",
        "[stroke='#fff']",
        "[stroke='#fff']",
      ],
    });
  });

  it('globals.css e a unica folha de estilo do frontend', () => {
    expect(folhas('src')).toEqual([]);
  });

  it('nenhum residuo do simulador de perfil do prototipo em src', () => {
    const hits = fontes('src').filter((file) =>
      /SIMULAR PERFIL|PROFILE_ORDER|activeProfile/.test(readFileSync(file, 'utf8')),
    );
    expect(hits).toEqual([]);
  });
});
