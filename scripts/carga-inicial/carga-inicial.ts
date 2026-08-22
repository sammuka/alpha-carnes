/**
 * Carga inicial — dados reais extraídos do ERP legado.
 *
 * Popula Clientes, Fornecedores, Frota (veículos e motoristas) e um catálogo/tabela
 * de preços curada a partir de `docs/alphacarnes_json_extracoes/`. É uma carga única
 * e OPCIONAL (não faz parte do `db:seed` padrão, que só cuida de RBAC/parâmetros/
 * catálogo provisório — ver app/backend/src/database/seed.ts).
 *
 * Registros com CNPJ/CPF inválido (dígito verificador) ou duplicado são pulados e
 * relatados em `docs/alphacarnes_json_extracoes/relatorio-carga-inicial.md` — não
 * inventamos documento fiscal (RA-05/06).
 *
 * Pré-requisito: rodar `npm run db:seed` antes (o catálogo canônico TZ/DT/PA/CB/
 * CBA/JAC/FC/BPORCO usado nas regras de transformação precisa já existir).
 *
 * Execução (raiz do repo):
 *   npx tsx scripts/carga-inicial/carga-inicial.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../app/backend/src/database/schema';
import { normalizarDocumento, validarDocumentoFiscal } from '../../app/backend/src/common/validators/documento-fiscal';
import { primeiroOuFalha } from '../../app/backend/src/common/crud/paginacao';

const {
  clientes, fornecedores, frotaCaminhoes, frotaMotoristas,
  itensComerciais, produtos, tabelasPreco, tabelasPrecoItens,
} = schema;

type Db = NodePgDatabase<typeof schema>;

const EXTRACOES_DIR = path.resolve(__dirname, '../../docs/alphacarnes_json_extracoes');
const RELATORIO_PATH = path.join(EXTRACOES_DIR, 'relatorio-carga-inicial.md');
const DATA_TABELA_PRECO = '2026-08-20'; // data da extração/lista de preços informada

function lerJson<T>(relativo: string): T {
  const conteudo = fs.readFileSync(path.join(EXTRACOES_DIR, relativo), 'utf8');
  return JSON.parse(conteudo) as T;
}

// ── Clientes ────────────────────────────────────────────────────────────────
interface LinhaCliente {
  Marca: string | null;
  Razao_Cliente: string;
  ID_Cliente: number;
  Ativo: boolean;
  'CNPJ/CPFF': string | null;
  Endereco_Cliente: string | null;
  Numero_Cliente: string | null;
  Bairro_Cliente: string | null;
  Cidade_Cliente: string | null;
  Estado_Cliente: string | null;
  CEP_Cliente: string | null;
  Email_NFE: string | null;
  Telefone_Cliente: string | null;
}

interface Excluido {
  entidade: 'cliente' | 'fornecedor';
  codigoLegado: string;
  nome: string;
  motivo: string;
}

async function importarClientes(db: Db, excluidos: Excluido[]): Promise<number> {
  const { rows } = lerJson<{ rows: LinhaCliente[] }>('Cadastro_Clientes/Consulta_Clientes.json');
  const documentosUsados = new Set<string>();
  let inseridos = 0;

  for (const r of rows) {
    const codigoLegado = String(r.ID_Cliente);
    const nome = r.Razao_Cliente?.trim() || `Cliente ${codigoLegado}`;
    const doc = normalizarDocumento(r['CNPJ/CPFF'] ?? '');

    if (!validarDocumentoFiscal(doc)) {
      excluidos.push({ entidade: 'cliente', codigoLegado, nome, motivo: `CNPJ/CPF inválido ou placeholder ("${r['CNPJ/CPFF'] ?? ''}")` });
      continue;
    }
    if (documentosUsados.has(doc)) {
      excluidos.push({ entidade: 'cliente', codigoLegado, nome, motivo: `CNPJ/CPF duplicado ("${r['CNPJ/CPFF']}")` });
      continue;
    }
    documentosUsados.add(doc);

    await db.insert(clientes).values({
      codigo: codigoLegado,
      razaoSocial: nome,
      nomeFantasia: r.Marca?.trim() || null,
      documentoFiscal: doc,
      status: r.Ativo ? 'ativo' : 'inativo',
      dadosFiscaisJson: {
        logradouro: r.Endereco_Cliente ?? undefined,
        numero: r.Numero_Cliente ?? undefined,
        bairro: r.Bairro_Cliente ?? undefined,
        cidade: r.Cidade_Cliente ?? undefined,
        uf: r.Estado_Cliente ?? undefined,
        cep: r.CEP_Cliente ?? undefined,
      },
      dadosContatoJson: {
        telefone: r.Telefone_Cliente ?? undefined,
        email: r.Email_NFE ?? undefined,
      },
    }).onConflictDoNothing({ target: clientes.codigo, where: isNull(clientes.deletedAt) });
    inseridos++;
  }
  return inseridos;
}

// ── Fornecedores ──────────────────────────────────────────────────────────────
interface LinhaFornecedor {
  ID_Fornecedor: number;
  Mini_Nome_Fornecedor: string | null;
  Razao_Fornecedor: string | null;
  CGC_Fornecedor: string | null;
  Endereco_Fornecedor: string | null;
  Bairro_Fornecedor: string | null;
  Cidade_Fornecedor: string | null;
  Estado_Fornecedor: string | null;
  Cep_Fornecedor: string | null;
  Telefone_Fornecedor: string | null;
  Site: string | null;
  Ativo_Fornecedor: boolean;
  Descricao_Tipo: string | null;
}

async function importarFornecedores(db: Db, excluidos: Excluido[]): Promise<number> {
  const { rows } = lerJson<{ rows: LinhaFornecedor[] }>('Cadastro_Fornecedores/Consulta_Fornecedores.json');
  const documentosUsados = new Set<string>();
  let inseridos = 0;

  for (const r of rows) {
    const codigoLegado = String(r.ID_Fornecedor);
    const nome = r.Razao_Fornecedor?.trim() || r.Mini_Nome_Fornecedor?.trim() || `Fornecedor ${codigoLegado}`;
    const doc = normalizarDocumento(r.CGC_Fornecedor ?? '');

    if (!validarDocumentoFiscal(doc)) {
      excluidos.push({ entidade: 'fornecedor', codigoLegado, nome, motivo: `CNPJ/CPF inválido ou placeholder ("${r.CGC_Fornecedor ?? ''}")` });
      continue;
    }
    if (documentosUsados.has(doc)) {
      excluidos.push({ entidade: 'fornecedor', codigoLegado, nome, motivo: `CNPJ/CPF duplicado ("${r.CGC_Fornecedor}")` });
      continue;
    }
    documentosUsados.add(doc);

    await db.insert(fornecedores).values({
      codigo: codigoLegado,
      razaoSocial: nome,
      documentoFiscal: doc,
      status: r.Ativo_Fornecedor ? 'ativo' : 'inativo',
      contatosJson: {
        telefone: r.Telefone_Fornecedor ?? undefined,
        site: r.Site ?? undefined,
        endereco: {
          logradouro: r.Endereco_Fornecedor ?? undefined,
          bairro: r.Bairro_Fornecedor ?? undefined,
          cidade: r.Cidade_Fornecedor ?? undefined,
          uf: r.Estado_Fornecedor ?? undefined,
          cep: r.Cep_Fornecedor ?? undefined,
        },
      },
      parametrosOperacionaisJson: {
        categoriaLegado: r.Descricao_Tipo ?? undefined,
      },
    }).onConflictDoNothing({ target: fornecedores.codigo, where: isNull(fornecedores.deletedAt) });
    inseridos++;
  }
  return inseridos;
}

// ── Frota (veículos) ─────────────────────────────────────────────────────────
interface LinhaFrota {
  ID_Frota: string;
  Nome_Proprietario: string | null;
  Placa_Veiculo_Frota: string;
  Marca_Veiculo: string | null;
  Modelo_Veiculo_Frota: string | null;
  Ano_Fab_Veiculo: number | null;
  Ano_Mod_Veiculo: number | null;
  Cor_Veiculo: string | null;
  Chassi_Veiculo: string | null;
  Certificado_Veiculo: string | null;
  Cidade_Certificado: string | null;
  Uf_Certificado: string | null;
  Data_Certificado: string | null;
  Capacidade_Veiculo: number | null;
  Numero_Seguro: string | null;
  Kilometragem_Veiculo: number | null;
  Veiculo_Proprio: boolean;
  Tara_Veiculo: number | null;
  Comprimento_Plataforma: number | null;
  Largura_Plataforma: number | null;
  Altura_Plataforma: number | null;
  Alcance_Max_Horizontal: number | null;
  Alcance_Max_Vertical: number | null;
  Status_Frota: boolean;
  Capacidade_M3: number | null;
}

async function importarFrota(db: Db): Promise<number> {
  const { rows } = lerJson<{ rows: LinhaFrota[] }>('Cadastro_Frota/Consulta_Frota.json');
  let inseridos = 0;

  for (const r of rows) {
    await db.insert(frotaCaminhoes).values({
      placa: r.Placa_Veiculo_Frota.trim().toUpperCase(),
      capacidadeKg: r.Capacidade_Veiculo ?? 0,
      status: r.Status_Frota ? 'ativo' : 'inativo',
      fabricante: r.Marca_Veiculo ?? null,
      modelo: r.Modelo_Veiculo_Frota ?? null,
      anoFabricacao: r.Ano_Fab_Veiculo ?? null,
      anoModelo: r.Ano_Mod_Veiculo ?? null,
      cor: r.Cor_Veiculo ?? null,
      chassi: r.Chassi_Veiculo ?? null,
      certificadoNumero: r.Certificado_Veiculo ?? null,
      certificadoCidade: r.Cidade_Certificado ?? null,
      certificadoUf: r.Uf_Certificado ?? null,
      certificadoData: r.Data_Certificado ?? null,
      numeroSeguro: r.Numero_Seguro ?? null,
      kilometragem: r.Kilometragem_Veiculo ?? null,
      taraKg: r.Tara_Veiculo ?? null,
      capacidadeM3: r.Capacidade_M3 ?? null,
      veiculoProprio: r.Veiculo_Proprio,
      nomeProprietario: r.Nome_Proprietario ?? null,
      dimensoesJson: {
        comprimentoPlataforma: r.Comprimento_Plataforma ?? undefined,
        larguraPlataforma: r.Largura_Plataforma ?? undefined,
        alturaPlataforma: r.Altura_Plataforma ?? undefined,
        alcanceMaxHorizontal: r.Alcance_Max_Horizontal ?? undefined,
        alcanceMaxVertical: r.Alcance_Max_Vertical ?? undefined,
      },
    }).onConflictDoNothing({ target: frotaCaminhoes.placa, where: isNull(frotaCaminhoes.deletedAt) });
    inseridos++;
  }
  return inseridos;
}

// ── Motoristas ────────────────────────────────────────────────────────────────
interface LinhaMotorista {
  ID_Fornecedor: number;
  Mini_Nome_Fornecedor: string | null;
  Razao_Fornecedor: string | null;
  CGC_Fornecedor: string | null;
  Descricao_Tipo: string | null;
  RG_Motorista: string | null;
  Carteira_Profissional: string | null;
  Nacionalidade_Motorista: string | null;
  Carteira_Habilitacao: string | null;
  Validade_Habilitacao: string | null;
  Emissao_Habilitacao: string | null;
  Data_1Habilita: string | null;
  Endereco_Fornecedor: string | null;
  Bairro_Fornecedor: string | null;
  Cidade_Fornecedor: string | null;
  Estado_Fornecedor: string | null;
  Cep_Fornecedor: string | null;
  Inicio_Fornecedor: string | null;
  Telefone_Fornecedor: string | null;
  Celular_Fornecedor: string | null;
  Contato_Fornecedor: string | null;
  EMail: string | null;
  Ativo_Fornecedor: boolean;
}

const TIPO_VINCULO_LEGADO: Record<string, string> = {
  AGREGADO: 'agregado',
  CHAPA: 'chapa',
  MOTORISTA: 'motorista',
};

async function importarMotoristas(db: Db): Promise<number> {
  const { rows } = lerJson<{ rows: LinhaMotorista[] }>('Cadastro_Motorista/Consulta_Motorista.json');
  const documentosUsados = new Set<string>();
  let inseridos = 0;

  for (const r of rows) {
    const documento = (r.CGC_Fornecedor ?? '').trim();
    if (!documento || documentosUsados.has(documento)) continue;
    documentosUsados.add(documento);

    const fornecedorLegado = await db.select({ id: fornecedores.id }).from(fornecedores)
      .where(and(eq(fornecedores.codigo, String(r.ID_Fornecedor)), isNull(fornecedores.deletedAt)))
      .then((rs) => rs[0]?.id ?? null);

    await db.insert(frotaMotoristas).values({
      nome: r.Razao_Fornecedor?.trim() || r.Mini_Nome_Fornecedor?.trim() || `Motorista ${r.ID_Fornecedor}`,
      documento,
      telefone: r.Telefone_Fornecedor ?? null,
      status: r.Ativo_Fornecedor ? 'ativo' : 'inativo',
      rg: r.RG_Motorista ?? null,
      carteiraProfissional: r.Carteira_Profissional ?? null,
      nacionalidade: r.Nacionalidade_Motorista ?? null,
      carteiraHabilitacao: r.Carteira_Habilitacao ?? null,
      validadeHabilitacao: r.Validade_Habilitacao ?? null,
      emissaoHabilitacao: r.Emissao_Habilitacao ?? null,
      dataPrimeiraHabilitacao: r.Data_1Habilita ?? null,
      celular: r.Celular_Fornecedor ?? null,
      contato: r.Contato_Fornecedor ?? null,
      email: r.EMail ?? null,
      tipoVinculo: r.Descricao_Tipo ? TIPO_VINCULO_LEGADO[r.Descricao_Tipo] ?? null : null,
      inicioVinculo: r.Inicio_Fornecedor ?? null,
      enderecoJson: {
        logradouro: r.Endereco_Fornecedor ?? undefined,
        bairro: r.Bairro_Fornecedor ?? undefined,
        cidade: r.Cidade_Fornecedor ?? undefined,
        uf: r.Estado_Fornecedor ?? undefined,
        cep: r.Cep_Fornecedor ?? undefined,
      },
      fornecedorLegadoId: fornecedorLegado,
    }).onConflictDoNothing({ target: frotaMotoristas.documento, where: isNull(frotaMotoristas.deletedAt) });
    inseridos++;
  }
  return inseridos;
}

// ── Catálogo curado + tabela de preços ───────────────────────────────────────
// "NT" = sem preço na lista informada (Bucho). Não inventamos valor: o produto
// é criado, mas não recebe linha na tabela de preços.
const CATALOGO_CURADO = [
  { codigo: 'TZ', nome: 'Traseiro Bovino', tipo: 'peca_inteira_pesavel', novo: false, preco: 28.40 },
  { codigo: 'DT', nome: 'Dianteiro Bovino', tipo: 'peca_inteira_pesavel', novo: false, preco: 23.90 },
  { codigo: 'PA', nome: 'Ponta de Agulha', tipo: 'peca_inteira_pesavel', novo: false, preco: 21.90 },
  { codigo: 'CASADO', nome: 'Casado', tipo: 'compra_base', novo: true, preco: 25.70 },
  { codigo: 'CB', nome: 'Coxão-bola', tipo: 'derivado_desossa', novo: false, preco: 26.20 },
  { codigo: 'CBA', nome: 'Coxão-bola c/ alcatra', tipo: 'derivado_desossa', novo: false, preco: 27.70 },
  { codigo: 'JAC', nome: 'Jacaré', tipo: 'derivado_desossa', novo: false, preco: 32.50 },
  { codigo: 'FC', nome: 'Filé curto', tipo: 'derivado_desossa', novo: false, preco: 32.50 },
  { codigo: 'FIGADO', nome: 'Fígado', tipo: 'entrada_unidade', novo: true, preco: 14.80 },
  { codigo: 'BUCHO', nome: 'Bucho', tipo: 'entrada_unidade', novo: true, preco: null },
  { codigo: 'RABO', nome: 'Rabo', tipo: 'entrada_unidade', novo: true, preco: 30.50 },
  { codigo: 'MOCOTOCX', nome: 'Mocotó Caixa', tipo: 'entrada_unidade', novo: true, preco: 11.90 },
  { codigo: 'MOCOTOSC', nome: 'Mocotó Saco', tipo: 'entrada_unidade', novo: true, preco: 10.50 },
  { codigo: 'CUPIMA', nome: 'Cupim A', tipo: 'entrada_unidade', novo: true, preco: 33.50 },
  { codigo: 'CUPIMB', nome: 'Cupim B', tipo: 'entrada_unidade', novo: true, preco: 30.90 },
  { codigo: 'CARNEIND', nome: 'Carne Industrial', tipo: 'entrada_unidade', novo: true, preco: 19.50 },
  { codigo: 'CORACAO', nome: 'Coração', tipo: 'entrada_unidade', novo: true, preco: 12.90 },
  { codigo: 'LINGUA', nome: 'Língua', tipo: 'entrada_unidade', novo: true, preco: 14.50 },
  { codigo: 'FMSUINO', nome: 'Filé Mignon Suíno', tipo: 'entrada_unidade', novo: true, preco: 19.50 },
  { codigo: 'COSTFRIELLA', nome: 'Costela (Friella)', tipo: 'entrada_unidade', novo: true, preco: 19.50 },
  { codigo: 'BARRFRIELLA', nome: 'Barriga (Friella)', tipo: 'entrada_unidade', novo: true, preco: 21.30 },
  { codigo: 'CARREFRIELLA', nome: 'Carré (Friella)', tipo: 'entrada_unidade', novo: true, preco: 12.20 },
  { codigo: 'TOUCINHO', nome: 'Toucinho', tipo: 'entrada_unidade', novo: true, preco: 16.00 },
  { codigo: 'BPORCO', nome: 'Banda de Porco', tipo: 'peca_inteira_pesavel', novo: false, preco: 11.00 },
] as const;

async function importarCatalogoEPrecos(db: Db): Promise<{ produtos: number; precos: number }> {
  const [tabela] = await db.insert(tabelasPreco)
    .values({
      data: DATA_TABELA_PRECO,
      status: 'rascunho',
      observacao: 'Carga inicial — lista de preços informada manualmente (docs/alphacarnes_json_extracoes).',
    })
    .onConflictDoNothing({ target: tabelasPreco.data, where: isNull(tabelasPreco.deletedAt) })
    .returning();
  const tabelaId = tabela?.id ?? primeiroOuFalha(
    await db.select({ id: tabelasPreco.id }).from(tabelasPreco)
      .where(and(eq(tabelasPreco.data, DATA_TABELA_PRECO), isNull(tabelasPreco.deletedAt))),
    'Tabela de preços da carga inicial não encontrada após o seed',
  ).id;

  let produtosNovos = 0;
  let precos = 0;

  for (const item of CATALOGO_CURADO) {
    let produtoId: string;
    if (item.novo) {
      const [comercial] = await db.insert(itensComerciais)
        .values({ codigo: item.codigo, descricao: item.nome, unidadeComercial: 'kg' })
        .onConflictDoNothing({ target: itensComerciais.codigo, where: isNull(itensComerciais.deletedAt) })
        .returning();
      const comercialId = comercial?.id ?? primeiroOuFalha(
        await db.select({ id: itensComerciais.id }).from(itensComerciais)
          .where(and(eq(itensComerciais.codigo, item.codigo), isNull(itensComerciais.deletedAt))),
        `item comercial ${item.codigo} não encontrado após o seed`,
      ).id;

      const [produto] = await db.insert(produtos)
        .values({
          codigo: item.codigo,
          nome: item.nome,
          tipoOperacional: item.tipo,
          unidadePedido: 'kg',
          unidadePreco: 'kg',
          exigePeso: true,
          legadoItemComercialId: comercialId,
          atributosJson: { origem: 'carga_inicial_legado' },
        })
        .onConflictDoNothing({ target: produtos.codigo, where: isNull(produtos.deletedAt) })
        .returning();
      produtoId = produto?.id ?? primeiroOuFalha(
        await db.select({ id: produtos.id }).from(produtos)
          .where(and(eq(produtos.codigo, item.codigo), isNull(produtos.deletedAt))),
        `produto ${item.codigo} não encontrado após o seed`,
      ).id;
      produtosNovos++;
    } else {
      const existente = await db.select({ id: produtos.id }).from(produtos)
        .where(and(eq(produtos.codigo, item.codigo), isNull(produtos.deletedAt)))
        .then((rs) => rs[0]);
      if (!existente) {
        console.warn(`⚠️  Produto canônico "${item.codigo}" não encontrado — rode "npm run db:seed" antes da carga inicial.`);
        continue;
      }
      produtoId = existente.id;
    }

    if (item.preco === null) continue; // "NT" — sem preço informado, não inventamos valor.

    await db.insert(tabelasPrecoItens)
      .values({ tabelaPrecoId: tabelaId, produtoId, precoA: item.preco.toFixed(2) })
      .onConflictDoNothing({ target: [tabelasPrecoItens.tabelaPrecoId, tabelasPrecoItens.produtoId] });
    precos++;
  }

  return { produtos: produtosNovos, precos };
}

// ── Relatório ─────────────────────────────────────────────────────────────────
function escreverRelatorio(excluidos: Excluido[], resumo: Record<string, number>): void {
  const porEntidade = (entidade: Excluido['entidade']) => excluidos.filter((e) => e.entidade === entidade);

  const linhas: string[] = [
    '# Relatório da carga inicial — dados legados',
    '',
    `Gerado por \`scripts/carga-inicial/carga-inicial.ts\`.`,
    '',
    '## Resumo',
    '',
    ...Object.entries(resumo).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `## Excluídos por CNPJ/CPF inválido ou duplicado (${excluidos.length})`,
    '',
    'Estes registros existem no legado, mas não foram importados porque o documento',
    'fiscal não passa na validação de dígito verificador (ou é um placeholder do ERP',
    'antigo, como `00000000000000`), ou porque colide com outro documento já importado.',
    'Reconciliação manual do documento real fica pendente para o gestor.',
    '',
  ];

  for (const entidade of ['cliente', 'fornecedor'] as const) {
    const lista = porEntidade(entidade);
    linhas.push(`### ${entidade === 'cliente' ? 'Clientes' : 'Fornecedores'} (${lista.length})`, '');
    linhas.push('| Código legado | Nome | Motivo |', '|---|---|---|');
    for (const e of lista) linhas.push(`| ${e.codigoLegado} | ${e.nome.replace(/\|/g, '/')} | ${e.motivo} |`);
    linhas.push('');
  }

  fs.writeFileSync(RELATORIO_PATH, linhas.join('\n'));
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL não definida');
    process.exit(1);
  }
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  const excluidos: Excluido[] = [];

  try {
    console.log('🌱 Carga inicial — dados legados...');

    const nClientes = await importarClientes(db, excluidos);
    console.log(`✅ Clientes: ${nClientes} importados`);

    const nFornecedores = await importarFornecedores(db, excluidos);
    console.log(`✅ Fornecedores: ${nFornecedores} importados`);

    const nFrota = await importarFrota(db);
    console.log(`✅ Frota (veículos): ${nFrota} importados`);

    const nMotoristas = await importarMotoristas(db);
    console.log(`✅ Motoristas: ${nMotoristas} importados`);

    const catalogo = await importarCatalogoEPrecos(db);
    console.log(`✅ Catálogo: ${catalogo.produtos} produtos novos, ${catalogo.precos} preços`);

    escreverRelatorio(excluidos, {
      'Clientes importados': nClientes,
      'Fornecedores importados': nFornecedores,
      'Veículos importados': nFrota,
      'Motoristas importados': nMotoristas,
      'Produtos novos no catálogo curado': catalogo.produtos,
      'Preços lançados': catalogo.precos,
      'Registros excluídos (documento inválido/duplicado)': excluidos.length,
    });
    console.log(`📄 Relatório: ${RELATORIO_PATH}`);
    console.log('🎉 Carga inicial concluída.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  void main();
}
