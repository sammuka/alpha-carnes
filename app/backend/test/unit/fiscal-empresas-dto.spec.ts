import {
  acaoDecisaoSchema,
  justificativaSchema,
  removerSchema,
  versaoSchema,
} from '../../src/modules/erp/fiscal/empresas/dto/comum.dto';
import {
  createEmpresaSchema,
  listarEmpresasQuerySchema,
  updateEmpresaSchema,
} from '../../src/modules/erp/fiscal/empresas/dto/empresa.dto';
import {
  createEstabelecimentoSchema,
  listarEstabelecimentosQuerySchema,
  substituirCnaesSchema,
  updateEstabelecimentoSchema,
} from '../../src/modules/erp/fiscal/empresas/dto/estabelecimento.dto';
import { cnaeItemSchema, listaCnaesSchema } from '../../src/modules/erp/fiscal/empresas/dto/cnae.dto';
import {
  createAlteracaoSchema,
  updateAlteracaoSchema,
} from '../../src/modules/erp/fiscal/empresas/dto/alteracao.dto';
import {
  createRegimeSchema,
  submeterRegimeSchema,
  updateRegimeSchema,
} from '../../src/modules/erp/fiscal/empresas/dto/regime.dto';

const EMPRESA_ID = '0190a000-0000-7000-8000-000000000001';
const JUST = 'Cadastro inicial';

const estabelecimentoValido = {
  empresaId: EMPRESA_ID,
  nome: 'Matriz Osasco',
  cnpj: '12.ABC.345/01DE-35',
  inscricaoEstadual: '123.456.789.110',
  inscricaoMunicipal: '9988-77',
  uf: 'SP',
  justificativa: JUST,
};

describe('DTOs Zod do cadastro fiscal (E01-T01)', () => {
  describe('comum', () => {
    it('justificativa vazia → inválida; trim 3–500', () => {
      expect(justificativaSchema.safeParse('').success).toBe(false);
      expect(justificativaSchema.safeParse('   ').success).toBe(false);
      expect(justificativaSchema.safeParse(' ab ').success).toBe(false);
      expect(justificativaSchema.safeParse('x'.repeat(501)).success).toBe(false);
      expect(justificativaSchema.parse('  Motivo ok  ')).toBe('Motivo ok');
    });

    it('versao inteira ≥ 1', () => {
      expect(versaoSchema.safeParse(0).success).toBe(false);
      expect(versaoSchema.safeParse(1.5).success).toBe(false);
      expect(versaoSchema.parse(3)).toBe(3);
    });

    it('ação de decisão exige versao e justificativa; remover exige justificativa', () => {
      expect(acaoDecisaoSchema.safeParse({ justificativa: JUST }).success).toBe(false);
      expect(acaoDecisaoSchema.safeParse({ versao: 1 }).success).toBe(false);
      expect(acaoDecisaoSchema.parse({ versao: 1, justificativa: JUST })).toEqual({ versao: 1, justificativa: JUST });
      expect(removerSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('empresa', () => {
    it('sem CNPJ/razão social → inválida', () => {
      expect(createEmpresaSchema.safeParse({ cnpjRaiz: '11222333', justificativa: JUST }).success).toBe(false);
      expect(createEmpresaSchema.safeParse({ razaoSocial: 'Alpha', justificativa: JUST }).success).toBe(false);
      expect(createEmpresaSchema.safeParse({ razaoSocial: '  ', cnpjRaiz: '11222333', justificativa: JUST }).success)
        .toBe(false);
    });

    it('cnpjRaiz normalizado (máscara e minúsculas) e no formato [0-9A-Z]{8}', () => {
      const r = createEmpresaSchema.parse({ razaoSocial: ' Alpha Carnes ', cnpjRaiz: '12.abc.345', justificativa: JUST });
      expect(r).toEqual({ razaoSocial: 'Alpha Carnes', cnpjRaiz: '12ABC345', justificativa: JUST });
      expect(createEmpresaSchema.safeParse({ razaoSocial: 'A', cnpjRaiz: '1122233', justificativa: JUST }).success)
        .toBe(false);
      expect(createEmpresaSchema.safeParse({ razaoSocial: 'A', cnpjRaiz: '1122-33*3', justificativa: JUST }).success)
        .toBe(false);
      expect(createEmpresaSchema.safeParse({ razaoSocial: 'x'.repeat(151), cnpjRaiz: '11222333', justificativa: JUST })
        .success).toBe(false);
    });

    it('PATCH strict rejeita cnpjRaiz e id', () => {
      const base = { razaoSocial: 'Nova', versao: 1, justificativa: JUST };
      expect(updateEmpresaSchema.safeParse(base).success).toBe(true);
      expect(updateEmpresaSchema.safeParse({ ...base, cnpjRaiz: '11222333' }).success).toBe(false);
      expect(updateEmpresaSchema.safeParse({ ...base, id: EMPRESA_ID }).success).toBe(false);
    });

    it('listagem: pageSize ≤ 100', () => {
      expect(listarEmpresasQuerySchema.parse({})).toMatchObject({ page: 1 });
      expect(listarEmpresasQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false);
    });
  });

  describe('estabelecimento', () => {
    it('CNPJ normalizado e DV conferido', () => {
      const r = createEstabelecimentoSchema.parse(estabelecimentoValido);
      expect(r.cnpj).toBe('12ABC34501DE35');
      const ruim = createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, cnpj: '12ABC34501DE36' });
      expect(ruim.success).toBe(false);
      expect(ruim.error?.issues[0]?.message).toBe('CNPJ inválido: confira os dígitos verificadores.');
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, cnpj: '12abc34501de35' }).data?.cnpj)
        .toBe('12ABC34501DE35');
    });

    it('IE/IM normalizados', () => {
      const r = createEstabelecimentoSchema.parse({
        ...estabelecimentoValido, inscricaoEstadual: '123.456.789.110', inscricaoMunicipal: 'ab-12/3',
      });
      expect(r.inscricaoEstadual).toBe('123456789110');
      expect(r.inscricaoMunicipal).toBe('AB123');
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, inscricaoEstadual: '' }).success)
        .toBe(false);
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, inscricaoEstadual: '12*3' }).success)
        .toBe(false);
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, inscricaoMunicipal: '1'.repeat(21) })
        .success).toBe(false);
    });

    it('UF inválida', () => {
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, uf: 'XX' }).success).toBe(false);
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, uf: 'sp' }).success).toBe(false);
    });

    it('sem CNPJ/nome → inválido', () => {
      const { cnpj: _cnpj, ...semCnpj } = estabelecimentoValido;
      const { nome: _nome, ...semNome } = estabelecimentoValido;
      expect(createEstabelecimentoSchema.safeParse(semCnpj).success).toBe(false);
      expect(createEstabelecimentoSchema.safeParse(semNome).success).toBe(false);
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, nome: 'x'.repeat(121) }).success)
        .toBe(false);
    });

    it('strict rejeita municipioIbgeCodigo no POST; cnaes opcional', () => {
      expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, municipioIbgeCodigo: '3534401' }).success)
        .toBe(false);
      const comCnaes = createEstabelecimentoSchema.parse({
        ...estabelecimentoValido,
        cnaes: [{ codigo: '6201-5/01', descricao: 'Desenvolvimento de software', tipo: 'PRINCIPAL' }],
      });
      expect(comCnaes.cnaes).toEqual([{ codigo: '6201501', descricao: 'Desenvolvimento de software', tipo: 'PRINCIPAL' }]);
    });

    it('strict rejeita empresaId/cnpj/municipioIbgeCodigo no PATCH', () => {
      const base = { nome: 'Filial', versao: 1, justificativa: JUST };
      expect(updateEstabelecimentoSchema.safeParse(base).success).toBe(true);
      expect(updateEstabelecimentoSchema.safeParse({ ...base, empresaId: EMPRESA_ID }).success).toBe(false);
      expect(updateEstabelecimentoSchema.safeParse({ ...base, cnpj: '12ABC34501DE35' }).success).toBe(false);
      expect(updateEstabelecimentoSchema.safeParse({ ...base, municipioIbgeCodigo: '3534401' }).success).toBe(false);
      expect(updateEstabelecimentoSchema.safeParse({ ...base, id: EMPRESA_ID }).success).toBe(false);
      expect(updateEstabelecimentoSchema.safeParse({ nome: 'Filial', justificativa: JUST }).success).toBe(false);
    });

    it('PUT cnaes: 0..50, strict, versao e justificativa', () => {
      const item = { codigo: '6201501', descricao: 'Atividade', tipo: 'SECUNDARIA' };
      expect(substituirCnaesSchema.safeParse({ cnaes: [], versao: 1, justificativa: JUST }).success).toBe(true);
      expect(substituirCnaesSchema.safeParse({ cnaes: Array(51).fill(item), versao: 1, justificativa: JUST }).success)
        .toBe(false);
      expect(substituirCnaesSchema.safeParse({ cnaes: [item], versao: 1, justificativa: JUST, extra: 1 }).success)
        .toBe(false);
    });

    it('listagem: sort e filtros válidos; pageSize padrão 20', () => {
      const q = listarEstabelecimentosQuerySchema.parse({});
      expect(q).toMatchObject({ page: 1, pageSize: 20, sort: 'estabelecimento', dir: 'asc' });
      expect(listarEstabelecimentosQuerySchema.safeParse({ sort: 'id' }).success).toBe(false);
      expect(listarEstabelecimentosQuerySchema.safeParse({ situacao: 'ATIVO' }).success).toBe(false);
      expect(listarEstabelecimentosQuerySchema.safeParse({ empresaId: 'abc' }).success).toBe(false);
      expect(listarEstabelecimentosQuerySchema.parse({ sort: 'regime', dir: 'desc', situacao: 'REVIEW' }))
        .toMatchObject({ sort: 'regime', dir: 'desc', situacao: 'REVIEW' });
    });
  });

  describe('CNAE', () => {
    it('código fora do formato → inválido (400)', () => {
      for (const codigo of ['620150', '62015011', '6201-5/0A', 'abcdefg', '']) {
        const r = cnaeItemSchema.safeParse({ codigo, descricao: 'Atividade', tipo: 'PRINCIPAL' });
        expect(r.success).toBe(false);
      }
      const r = cnaeItemSchema.safeParse({ codigo: '620150', descricao: 'Atividade', tipo: 'PRINCIPAL' });
      expect(r.error?.issues[0]?.message).toBe('CNAE deve ter 7 dígitos (0000-0/00).');
    });

    it('normaliza código, trim da descrição, tipo válido', () => {
      expect(cnaeItemSchema.parse({ codigo: ' 6201-5/01 ', descricao: '  Software  ', tipo: 'SECUNDARIA' }))
        .toEqual({ codigo: '6201501', descricao: 'Software', tipo: 'SECUNDARIA' });
      expect(cnaeItemSchema.safeParse({ codigo: '6201501', descricao: ' ', tipo: 'PRINCIPAL' }).success).toBe(false);
      expect(cnaeItemSchema.safeParse({ codigo: '6201501', descricao: 'x'.repeat(256), tipo: 'PRINCIPAL' }).success)
        .toBe(false);
      expect(cnaeItemSchema.safeParse({ codigo: '6201501', descricao: 'Ok', tipo: 'OUTRA' }).success).toBe(false);
      expect(listaCnaesSchema.safeParse([]).success).toBe(true);
    });
  });

  describe('alteração', () => {
    const alteracao = {
      nome: 'Matriz', inscricaoEstadual: '123', inscricaoMunicipal: '456', uf: 'RJ',
      cnaes: [{ codigo: '6201501', descricao: 'Software', tipo: 'PRINCIPAL' }], versao: 2, justificativa: JUST,
    };

    it('criar exige valores completos e é strict', () => {
      expect(createAlteracaoSchema.safeParse(alteracao).success).toBe(true);
      const { cnaes: _c, ...semCnaes } = alteracao;
      expect(createAlteracaoSchema.safeParse(semCnaes).success).toBe(false);
      expect(createAlteracaoSchema.safeParse({ ...alteracao, cnpj: '12ABC34501DE35' }).success).toBe(false);
      expect(createAlteracaoSchema.safeParse({ ...alteracao, empresaId: EMPRESA_ID }).success).toBe(false);
    });

    it('editar: campos opcionais, versao e justificativa obrigatórios, strict', () => {
      expect(updateAlteracaoSchema.safeParse({ versao: 1, justificativa: JUST }).success).toBe(true);
      expect(updateAlteracaoSchema.safeParse({ uf: 'XX', versao: 1, justificativa: JUST }).success).toBe(false);
      expect(updateAlteracaoSchema.safeParse({ versao: 1, justificativa: JUST, municipioIbgeCodigo: '1' }).success)
        .toBe(false);
    });
  });

  describe('regime', () => {
    const regime = { crt: '3', vigenciaInicio: '2026-01-01', justificativa: JUST };

    it('CRT 5 → inválido; 1..4 válidos', () => {
      expect(createRegimeSchema.safeParse({ ...regime, crt: '5' }).success).toBe(false);
      for (const crt of ['1', '2', '3', '4']) {
        expect(createRegimeSchema.safeParse({ ...regime, crt }).success).toBe(true);
      }
    });

    it('fim < início → inválido; fim = início válido; data fora de ISO inválida', () => {
      expect(createRegimeSchema.safeParse({ ...regime, vigenciaFim: '2025-12-31' }).success).toBe(false);
      expect(createRegimeSchema.safeParse({ ...regime, vigenciaFim: '2026-01-01' }).success).toBe(true);
      expect(createRegimeSchema.safeParse({ ...regime, vigenciaInicio: '01/01/2026' }).success).toBe(false);
      expect(updateRegimeSchema.safeParse({
        vigenciaInicio: '2026-03-01', vigenciaFim: '2026-02-28', versao: 1, justificativa: JUST,
      }).success).toBe(false);
    });

    it('strict rejeita estabelecimentoId/empresaId', () => {
      expect(createRegimeSchema.safeParse({ ...regime, empresaId: EMPRESA_ID }).success).toBe(false);
      expect(updateRegimeSchema.safeParse({ versao: 1, justificativa: JUST, estabelecimentoId: EMPRESA_ID }).success)
        .toBe(false);
    });

    it('submeter aceita confirmarTroca opcional', () => {
      expect(submeterRegimeSchema.parse({ versao: 1, justificativa: JUST })).toEqual({ versao: 1, justificativa: JUST });
      expect(submeterRegimeSchema.parse({ versao: 1, justificativa: JUST, confirmarTroca: true }))
        .toEqual({ versao: 1, justificativa: JUST, confirmarTroca: true });
    });
  });
});

describe('Portão A r1: entradas que o PostgreSQL não aceita e CNPJ não ASCII', () => {
  const nulo = String.fromCharCode(0);

  it('recusa U+0000 em razão social, nome, justificativa, descrição de CNAE e busca', () => {
    expect(createEmpresaSchema.safeParse({ razaoSocial: `A${nulo}`, cnpjRaiz: '12ABC345', justificativa: JUST }).success).toBe(false);
    expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, nome: `A${nulo}` }).success).toBe(false);
    expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, justificativa: `abc${nulo}` }).success).toBe(false);
    expect(cnaeItemSchema.safeParse({ codigo: '6201501', descricao: `a${nulo}`, tipo: 'PRINCIPAL' }).success).toBe(false);
    expect(listarEstabelecimentosQuerySchema.safeParse({ search: `a${nulo}` }).success).toBe(false);
    expect(listarEmpresasQuerySchema.safeParse({ search: `a${nulo}` }).success).toBe(false);
  });

  it('recusa data com ano abaixo de 1900 e aceita 1900-01-01', () => {
    const base = { crt: '3', justificativa: JUST };
    expect(createRegimeSchema.safeParse({ ...base, vigenciaInicio: '0000-01-01' }).success).toBe(false);
    expect(createRegimeSchema.safeParse({ ...base, vigenciaInicio: '1899-12-31' }).success).toBe(false);
    expect(createRegimeSchema.safeParse({ ...base, vigenciaInicio: '1900-01-01' }).success).toBe(true);
    expect(updateRegimeSchema.safeParse({ vigenciaFim: '0000-12-31', versao: 1, justificativa: JUST }).success).toBe(false);
  });

  it('recusa CNPJ e raiz com caracteres não ASCII que toUpperCase transformaria', () => {
    expect(createEstabelecimentoSchema.safeParse({ ...estabelecimentoValido, cnpj: 'ı2.ABC.345/01DE-35' }).success).toBe(false);
    expect(createEmpresaSchema.safeParse({ razaoSocial: 'A', cnpjRaiz: 'ßABC3450', justificativa: JUST }).success).toBe(false);
    expect(createEstabelecimentoSchema.safeParse(estabelecimentoValido).success).toBe(true);
  });
});
