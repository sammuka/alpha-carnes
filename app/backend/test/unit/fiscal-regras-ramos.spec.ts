import { ConflictException, NotFoundException } from '@nestjs/common';
import { BeneficiosFiscaisService } from '../../src/modules/erp/fiscal/regras/beneficios-fiscais.service';
import { ClassificacoesIbsCbsService } from '../../src/modules/erp/fiscal/regras/classificacoes-ibs-cbs.service';
import { RegrasTributariasService } from '../../src/modules/erp/fiscal/regras/regras.service';
import type { CriarRegraDto, ListarRegrasQuery, NovaVersaoDto } from '../../src/modules/erp/fiscal/regras/dto/regra.dto';

const ENQ = '0199e1a0-0000-7000-8000-000000000001';
const OP = '0199e1a0-0000-7000-8000-000000000002';
const CFOP = '0199e1a0-0000-7000-8000-000000000003';
const BEN = '0199e1a0-0000-7000-8000-000000000004';
const CLS = '0199e1a0-0000-7000-8000-000000000005';
const USUARIO = '0199e1a0-0000-7000-8000-000000000006';
const OUTRO = '0199e1a0-0000-7000-8000-000000000008';
const REGRA = '0199e1a0-0000-7000-8000-000000000007';

type Passo = { valor: unknown } | { erro: unknown };

/** Encadeamento Drizzle então-ável: cada `await` consome o próximo passo. */
function banco(passos: Passo[]) {
  let i = 0;
  const builder: Record<string, unknown> = new Proxy({}, {
    get(_alvo, prop) {
      if (prop === 'then') {
        const passo = passos[i++];
        const p = passo === undefined
          ? Promise.reject(new Error(`consulta ${i} sem passo`))
          : 'erro' in passo
            ? Promise.reject(passo.erro)
            : Promise.resolve(passo.valor);
        return (ok?: (v: unknown) => unknown, falha?: (e: unknown) => unknown) => p.then(ok, falha);
      }
      if (prop === 'transaction') {
        return (fn: (tx: unknown) => Promise<unknown>) => fn(builder);
      }
      return () => builder;
    },
  });
  return builder;
}

function unica(constraint: string) {
  return Object.assign(new Error('duplicado'), { code: '23505', constraint });
}

function regras(passos: Passo[]) {
  return new RegrasTributariasService(
    { db: banco(passos) } as never,
    { registrar: jest.fn(async () => undefined) } as never,
    { emit: jest.fn() } as never,
  );
}

function catalogo<T>(Ctor: new (...args: never[]) => T, passos: Passo[]): T {
  return new Ctor(
    { db: banco(passos) } as never,
    { registrar: jest.fn(async () => undefined) } as never,
    { emit: jest.fn() } as never,
  );
}

const enquadramentoAtivo = { id: ENQ, situacao: 'ATIVA', operacaoId: OP, cfopId: CFOP };
const dto = {
  enquadramentoId: ENQ,
  operacaoId: OP,
  cfopId: CFOP,
  icmsCst: '20',
  pRedBc: '0.4167',
  pIcms: '0.1200',
  beneficioFiscalId: BEN,
  ipiCst: '53',
  pisCst: '06',
  ibsCst: '000',
  classificacaoIbsCbsId: CLS,
  vigenciaInicio: '2026-01-01',
  vigenciaFim: '2026-12-31',
  justificativa: 'Cobertura dos ramos da regra tributária.',
} as CriarRegraDto;

function linha(parcial: Record<string, unknown> = {}) {
  return {
    id: REGRA,
    codigo: '1',
    numeroVersao: 1,
    versao: 3,
    enquadramentoId: ENQ,
    icmsCst: '20',
    pRedBc: '0.4167',
    pIcms: '0.1200',
    beneficioFiscalId: BEN,
    ipiCst: '53',
    pisCst: '06',
    ibsCst: '000',
    classificacaoIbsCbsId: CLS,
    vigenciaInicio: '2026-01-01',
    vigenciaFim: '2026-12-31',
    situacao: 'RASCUNHO',
    submetidoPorId: OUTRO,
    origemVersaoId: null,
    ...parcial,
  };
}

const compara = {
  codigo: '1',
  numeroVersao: 1,
  icmsCst: '20',
  pRedBc: '0.4167',
  pIcms: '0.1200',
  ipiCst: '53',
  pisCst: '06',
  ibsCst: '000',
  vigenciaInicio: '2026-01-01',
  vigenciaFim: null,
  beneficio: 'Redução',
  classificacao: 'Integral',
};

const detalhe = {
  ...linha({ pRedBc: '12', vigenciaFim: null }),
  operacaoId: OP,
  cfopId: CFOP,
  empresaNome: 'Alpha Carnes',
  responsavel: 'Ana',
  criadoEm: new Date('2026-01-01T00:00:00Z'),
  atualizadoEm: new Date('2026-01-02T00:00:00Z'),
  autor: null,
  aprovador: null,
};

function prefixoCriar(): Passo[] {
  return [
    { valor: [enquadramentoAtivo] },
    { valor: [{ id: BEN }] },
    { valor: [{ id: CLS }] },
    { valor: { rows: [] } },
  ];
}

/** SAVEPOINT, próximo código, insert e o execute seguinte (RELEASE ou ROLLBACK). */
function tentativa(insert: Passo, extra: Passo[] = []): Passo[] {
  return [
    { valor: { rows: [] } },
    { valor: { rows: [{ proximo: '9' }] } },
    insert,
    ...extra,
  ];
}

async function codigo(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    const http = err as { getResponse?: () => unknown };
    return typeof http.getResponse === 'function' ? http.getResponse() : err;
  }
  throw new Error('a chamada deveria falhar');
}

describe('ramos dos services de regras tributárias', () => {
  it('lista benefício com busca e recusa gravação sem linha', async () => {
    const lista = catalogo(BeneficiosFiscaisService, [
      { valor: [{ total: 1 }] },
      { valor: [{ id: BEN, codigo: 'SP020450', descricao: 'Redução' }] },
    ]);
    const pagina = await lista.listar({ search: 'SP_020%', page: 1, pageSize: 20 });
    expect(pagina.data[0]?.codigo).toBe('SP020450');

    const criar = catalogo(BeneficiosFiscaisService, [{ valor: [] }]);
    await expect(criar.criar(
      { codigo: 'SP020450', descricao: 'Redução', justificativa: 'Motivo suficiente.' },
      USUARIO,
    )).rejects.toThrow('Falha ao gravar benefício fiscal');
  });

  it('lista classificação com e sem busca e recusa gravação sem linha', async () => {
    const semBusca = catalogo(ClassificacoesIbsCbsService, [
      { valor: [{ total: 0 }] },
      { valor: [] },
    ]);
    const vazia = await semBusca.listar({ page: 1, pageSize: 10 });
    expect(vazia.total).toBe(0);

    const comBusca = catalogo(ClassificacoesIbsCbsService, [
      { valor: [{ total: 1 }] },
      { valor: [{ id: CLS, codigo: '000001', descricao: 'Integral' }] },
    ]);
    const pagina = await comBusca.listar({ search: '000', page: 1, pageSize: 10 });
    expect(pagina.data).toHaveLength(1);

    const criar = catalogo(ClassificacoesIbsCbsService, [{ valor: [] }]);
    await expect(criar.criar(
      { codigo: '000001', descricao: 'Integral', justificativa: 'Motivo suficiente.' },
      USUARIO,
    )).rejects.toThrow('Falha ao gravar classificação IBS/CBS');
  });

  it('lista regras com CFOP e trata contagem ausente', async () => {
    const service = regras([
      { valor: [{ total: 1 }] },
      { valor: [{
        id: REGRA,
        enquadramentoFiscal: 'EQ-1',
        operacaoFiscal: '5102',
        beneficioFiscal: 'Redução',
        classificacaoIbsCbs: 'Integral',
        operacao: 'Venda',
        icmsCst: '20',
      }] },
    ]);
    const pagina = await service.listar({ page: 1, pageSize: 20, sort: 'enquadramento', dir: 'asc', cfopId: CFOP } as ListarRegrasQuery);
    expect(pagina.total).toBe(1);
    expect(pagina.data[0]?.tratamentoIcms).toBe('Redução de base');

    const vazio = regras([{ valor: [] }, { valor: [] }]);
    const semTotal = await vazio.listar({ page: 1, pageSize: 20, sort: 'enquadramento', dir: 'asc' } as ListarRegrasQuery);
    expect(semTotal.total).toBe(0);
  });

  it('contagens zeradas quando a consulta não devolve linha', async () => {
    const service = regras([{ valor: [] }]);
    await expect(service.contagens({ page: 1, pageSize: 20, sort: 'enquadramento', dir: 'asc' } as ListarRegrasQuery)).resolves.toEqual({
      total: 0,
      rascunhos: 0,
      submetidas: 0,
      aprovadas: 0,
      aposentadas: 0,
    });
  });

  it('detalha percentual inteiro e 404 quando a regra não existe', async () => {
    const service = regras([{ valor: [detalhe] }]);
    const corpo = await service.detalhar(REGRA);
    expect(corpo.pRedBc).toBe('12.0000');

    const ausente = regras([{ valor: [] }]);
    await expect(ausente.detalhar(REGRA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('compara vigência sem fim e 404 da versão ausente', async () => {
    const service = regras([{ valor: [compara] }, { valor: [{ ...compara, numeroVersao: 2 }] }]);
    const diff = await service.comparar(REGRA, OUTRO);
    expect(diff.diferencas.map((item) => item.campo)).not.toContain('Fim de vigência');

    const ausente = regras([{ valor: [] }]);
    await expect(ausente.comparar(REGRA, OUTRO)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('histórico aceita auditoria sem dados novos nem anteriores', async () => {
    const service = regras([
      { valor: [linha()] },
      { valor: [{
        operacao: 'INSERT',
        usuarioNome: null,
        criadoEm: new Date('2026-01-01T00:00:00Z'),
        justificativa: null,
        dadosNovos: null,
        dadosAnteriores: null,
      }] },
    ]);
    const itens = await service.historico(REGRA);
    expect(itens[0]).toMatchObject({
      situacaoAnterior: null,
      situacaoNova: null,
      resumo: null,
      versao: null,
      numeroVersao: null,
    });
  });

  it('criação recusa enquadramento ausente, inativo, divergente ou classificação inativa', async () => {
    await expect(regras([{ valor: [] }]).criarRascunho(dto, USUARIO))
      .rejects.toThrow('Enquadramento fiscal não encontrado');

    await expect(regras([{ valor: [{ ...enquadramentoAtivo, situacao: 'RASCUNHO' }] }]).criarRascunho(dto, USUARIO))
      .rejects.toMatchObject({ response: { codigo: 'ENQUADRAMENTO_INDISPONIVEL' } });

    await expect(regras([{ valor: [{ ...enquadramentoAtivo, operacaoId: OUTRO }] }]).criarRascunho(dto, USUARIO))
      .rejects.toMatchObject({ response: { codigo: 'ENQUADRAMENTO_DIVERGENTE' } });

    await expect(regras([
      { valor: [enquadramentoAtivo] },
      { valor: [{ id: BEN }] },
      { valor: [] },
    ]).criarRascunho(dto, USUARIO)).rejects.toMatchObject({ response: { codigo: 'CLASSIFICACAO_NAO_ATIVA' } });
  });

  it('atualização sem fim de vigência e sem linha gravada responde 404', async () => {
    const service = regras([
      { valor: [enquadramentoAtivo] },
      { valor: [linha()] },
      { valor: [{ id: BEN }] },
      { valor: [{ id: CLS }] },
      { valor: [] },
    ]);
    await expect(service.atualizarRascunho(
      REGRA,
      { ...dto, vigenciaFim: undefined, versao: 3 },
      USUARIO,
    )).rejects.toBeInstanceOf(NotFoundException);
  });

  it('versão nova recusa outro enquadramento e versão já aberta', async () => {
    const origem = linha({ situacao: 'APROVADA' });
    const pedido = { ...dto, versao: 3, enquadramentoId: OUTRO } as NovaVersaoDto;
    await expect(regras([{ valor: [origem] }, { valor: [enquadramentoAtivo] }, { valor: [origem] }, { valor: [] }])
      .adicionarVersao(REGRA, pedido, USUARIO))
      .rejects.toMatchObject({ response: { codigo: 'LINHAGEM_ENQUADRAMENTO_FIXO' } });

    const aberta = regras([
      { valor: [origem] },
      { valor: [enquadramentoAtivo] },
      { valor: [origem] },
      { valor: [{ id: OUTRO }] },
    ]);
    await expect(aberta.adicionarVersao(REGRA, { ...dto, versao: 3 } as NovaVersaoDto, USUARIO))
      .rejects.toMatchObject({ response: { codigo: 'VERSAO_ABERTA' } });
  });

  it('versão nova distingue violação única, insert vazio e erro genérico', async () => {
    const origem = linha({ situacao: 'APROVADA' });
    const pedido = { ...dto, versao: 3 } as NovaVersaoDto;
    const ateCatalogo = (): Passo[] => [
      { valor: [origem] },
      { valor: [enquadramentoAtivo] },
      { valor: [origem] },
      { valor: [] },
      { valor: [{ id: BEN }] },
      { valor: [{ id: CLS }] },
    ];

    expect(await codigo(regras([
      ...ateCatalogo(),
      { erro: unica('uq_regras_abertas_codigo') },
      { valor: { rows: [] } },
    ]).adicionarVersao(REGRA, pedido, USUARIO))).toMatchObject({ codigo: 'VERSAO_ABERTA' });

    expect(await codigo(regras([
      ...ateCatalogo(),
      { erro: unica('uq_regras_codigo_versao') },
      { valor: { rows: [] } },
    ]).adicionarVersao(REGRA, pedido, USUARIO))).toMatchObject({ codigo: 'VERSAO_ABERTA' });

    await expect(regras([
      ...ateCatalogo(),
      { valor: [] },
      { valor: { rows: [] } },
    ]).adicionarVersao(REGRA, pedido, USUARIO)).rejects.toThrow('Falha ao gravar versão');

    await expect(regras([
      ...ateCatalogo(),
      { erro: new Error('falha de disco') },
      { valor: { rows: [] } },
    ]).adicionarVersao(REGRA, pedido, USUARIO)).rejects.toThrow('falha de disco');
  });

  it('submeter, aprovar e aposentar sem linha gravada respondem 404', async () => {
    const acao = { versao: 3, justificativa: dto.justificativa };
    await expect(regras([
      { valor: [linha()] },
      { valor: [enquadramentoAtivo] },
      { valor: [linha()] },
      { valor: [] },
    ]).submeter(REGRA, acao, USUARIO)).rejects.toBeInstanceOf(NotFoundException);

    // Ordem única (AD-33): enquadramento travado antes da regra; vínculo trocado no meio-tempo vira 409.
    await expect(regras([
      { valor: [linha()] },
      { valor: [enquadramentoAtivo] },
      { valor: [linha({ enquadramentoId: OUTRO })] },
    ]).submeter(REGRA, acao, USUARIO)).rejects.toMatchObject({ response: { codigo: 'CONFLITO_CONCORRENTE' } });

    await expect(regras([
      { valor: [linha()] },
      { valor: [{ ...enquadramentoAtivo, deletedAt: new Date() }] },
      { valor: [linha()] },
    ]).submeter(REGRA, acao, USUARIO)).rejects.toMatchObject({ response: { codigo: 'ENQUADRAMENTO_INDISPONIVEL' } });

    await expect(regras([
      { valor: [linha({ situacao: 'RASCUNHO' })] },
      { valor: [enquadramentoAtivo] },
      { valor: [linha({ situacao: 'RASCUNHO' })] },
    ]).aprovar(REGRA, acao, USUARIO)).rejects.toMatchObject({ response: { codigo: 'TRANSICAO_INVALIDA' } });

    await expect(regras([
      { valor: [linha({ situacao: 'SUBMETIDA' })] },
      { valor: [enquadramentoAtivo] },
      { valor: [linha({ situacao: 'SUBMETIDA' })] },
      { valor: [] },
      { valor: [] },
    ]).aprovar(REGRA, acao, USUARIO)).rejects.toBeInstanceOf(NotFoundException);

    await expect(regras([
      { valor: [linha({ situacao: 'APROVADA' })] },
      { valor: [] },
    ]).aposentar(REGRA, acao, USUARIO)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('código gerado retenta a violação única e relança o restante', async () => {
    const sucesso = regras([
      ...prefixoCriar(),
      ...tentativa({ erro: unica('uq_regras_codigo_versao') }, [{ valor: { rows: [] } }]),
      ...tentativa({ valor: [linha({ codigo: '9' })] }, [{ valor: { rows: [] } }]),
      { valor: [detalhe] },
    ]);
    await expect(sucesso.criarRascunho(dto, USUARIO)).resolves.toMatchObject({ id: REGRA, pRedBc: '12.0000' });

    const esgotou = regras([
      ...prefixoCriar(),
      ...tentativa({ erro: unica('uq_regras_codigo_versao') }, [{ valor: { rows: [] } }]),
      ...tentativa({ erro: unica('uq_regras_codigo_versao') }, [{ valor: { rows: [] } }]),
    ]);
    expect(await codigo(esgotou.criarRascunho(dto, USUARIO))).toMatchObject({ codigo: 'VERSAO_ABERTA' });

    const aberta = regras([
      ...prefixoCriar(),
      ...tentativa({ erro: unica('uq_regras_abertas_codigo') }, [{ valor: { rows: [] } }]),
    ]);
    expect(await codigo(aberta.criarRascunho(dto, USUARIO))).toMatchObject({ codigo: 'VERSAO_ABERTA' });

    const vazia = regras([
      ...prefixoCriar(),
      ...tentativa({ valor: [] }, [{ valor: { rows: [] } }, { valor: { rows: [] } }]),
    ]);
    await expect(vazia.criarRascunho(dto, USUARIO)).rejects.toThrow('Falha ao gravar regra tributária');

    const generica = regras([
      ...prefixoCriar(),
      ...tentativa({ erro: new Error('falha de disco') }, [{ valor: { rows: [] } }]),
    ]);
    await expect(generica.criarRascunho(dto, USUARIO)).rejects.toThrow('falha de disco');
  });

  it('leitura e bloqueio ausentes respondem 404', async () => {
    await expect(regras([{ valor: [] }]).historico(REGRA)).rejects.toBeInstanceOf(NotFoundException);
    await expect(regras([{ valor: [enquadramentoAtivo] }, { valor: [] }]).atualizarRascunho(REGRA, { ...dto, versao: 3 }, USUARIO))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
