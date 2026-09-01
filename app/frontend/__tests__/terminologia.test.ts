import ts from 'typescript';
import { readFileSync, readdirSync, globSync } from 'node:fs';
import { join } from 'node:path';

function fontes(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return fontes(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function hitsTermoBanido(files: string[]): string[] {
  const hits: string[] = [];
  for (const file of files) {
    const sf = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
        const valor = ts.isStringLiteralLike(node) ? node.text : node.getText(sf);
        if (/\bmarcas?\b/i.test(valor) && valor !== 'Nome Fantasia/Marca') {
          hits.push(`${file}:${sf.getLineAndCharacterOfPosition(node.pos).line + 1}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return hits;
}

const ALVOS_GESTAO = globSync('src/{app/(admin)/gestao,components/gestao}/**/*.{ts,tsx}', {
  cwd: process.cwd(),
  windowsPathsNoEscape: true,
});

describe('terminologia', () => {
  it('strings de UI não contêm o rótulo banido', () => {
    expect(hitsTermoBanido(fontes('src'))).toEqual([]);
  });

  it('telas de gestão (Onda 5) não contêm o rótulo banido', () => {
    expect(hitsTermoBanido(ALVOS_GESTAO)).toEqual([]);
  });

  it('rotas de recebimento sem termo banido', () => {
    const alvos = globSync('src/app/(admin)/recebimento/**/*.{ts,tsx}', {
      cwd: process.cwd(),
      windowsPathsNoEscape: true,
    });
    expect(hitsTermoBanido(alvos)).toEqual([]);
  });

  it('telas de gestão com busca ou rótulo de nome usam terminologia v1.1', () => {
    const infratores: string[] = [];
    for (const arquivo of ALVOS_GESTAO) {
      const conteudo = readFileSync(join(process.cwd(), arquivo), 'utf8');
      if (/buscar\s+(marca|marcas)\b/i.test(conteudo)) {
        infratores.push(`${arquivo}: busca de cliente com rótulo banido`);
      }
      if (/placeholder=[^>]*(marca|marcas)/i.test(conteudo)) {
        infratores.push(`${arquivo}: placeholder com rótulo banido`);
      }
      if (/getByLabel\([^)]*(marca|marcas)/i.test(conteudo)) {
        infratores.push(`${arquivo}: label de formulário com rótulo banido`);
      }
      if (/label:\s*['"][^'"]*(marca|marcas)/i.test(conteudo)) {
        infratores.push(`${arquivo}: label de formulário com rótulo banido`);
      }
      if (/Buscar cliente/i.test(conteudo) && /Buscar marca/i.test(conteudo)) {
        infratores.push(`${arquivo}: mistura terminologia correta e banida`);
      }
      if (/Nome Fantasia/i.test(conteudo) && /\b(marca|marcas)\b/i.test(conteudo)
        && !/Nome Fantasia\/Marca/.test(conteudo)) {
        infratores.push(`${arquivo}: mistura Nome Fantasia com rótulo banido`);
      }
    }
    expect(infratores).toEqual([]);
  });
});
