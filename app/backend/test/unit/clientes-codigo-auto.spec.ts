import { ConflictException } from '@nestjs/common';
import { ClientesService, ehConflitoDeCodigo } from '../../src/modules/cadastros/clientes/clientes.service';
import type { CreateClienteDto } from '../../src/modules/cadastros/clientes/dto/cliente.dto';

const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };

const dtoBase = {
  razaoSocial: 'Cliente Auto LTDA',
  documentoFiscal: '11222333000181',
  preferenciasJson: {},
  dadosFiscaisJson: {},
  dadosContatoJson: {},
} as CreateClienteDto;

function servicoComTransacao(transaction: jest.Mock): ClientesService {
  return new ClientesService({ db: { transaction } } as never, auditoria as never);
}

describe('ehConflitoDeCodigo', () => {
  it('reconhece ConflictException de código', () => {
    expect(ehConflitoDeCodigo(new ConflictException('Já existe cliente com este código'))).toBe(true);
  });

  it('não trata conflito de documento como código', () => {
    expect(ehConflitoDeCodigo(new ConflictException('Já existe cliente com este documento fiscal'))).toBe(false);
  });

  it('reconhece unique violation 23505 no erro e na cause', () => {
    expect(ehConflitoDeCodigo({ code: '23505', constraint: 'uq_clientes_codigo' })).toBe(true);
    expect(ehConflitoDeCodigo({ cause: { code: '23505', constraint: 'uq_clientes_codigo' } })).toBe(true);
  });

  it('ignora 23505 de outra constraint', () => {
    expect(ehConflitoDeCodigo({ code: '23505', constraint: 'uq_clientes_documento_fiscal' })).toBe(false);
  });
});

describe('ClientesService.criar — retry de código automático', () => {
  const criado = { id: 'c1', codigo: '2', razaoSocial: dtoBase.razaoSocial };

  it('retenta quando o código gerado colide e persiste na segunda tentativa', async () => {
    const transaction = jest.fn()
      .mockRejectedValueOnce(new ConflictException('Já existe cliente com este código'))
      .mockResolvedValueOnce(criado);
    const svc = servicoComTransacao(transaction);
    await expect(svc.criar(dtoBase, 'u1')).resolves.toEqual(criado);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('não retenta quando o cliente enviou código explícito', async () => {
    const transaction = jest.fn()
      .mockRejectedValue(new ConflictException('Já existe cliente com este código'));
    const svc = servicoComTransacao(transaction);
    await expect(svc.criar({ ...dtoBase, codigo: 'CLI-X' }, 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('não retenta conflito de documento fiscal', async () => {
    const transaction = jest.fn()
      .mockRejectedValue(new ConflictException('Já existe cliente com este documento fiscal'));
    const svc = servicoComTransacao(transaction);
    await expect(svc.criar(dtoBase, 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('esgota tentativas e relança o último Error', async () => {
    const falha = new ConflictException('Já existe cliente com este código');
    const transaction = jest.fn().mockRejectedValue(falha);
    const svc = servicoComTransacao(transaction);
    await expect(svc.criar(dtoBase, 'u1')).rejects.toBe(falha);
    expect(transaction).toHaveBeenCalledTimes(5);
  });

  it('esgota tentativas com objeto 23505 e lança ConflictException', async () => {
    const transaction = jest.fn().mockRejectedValue({ code: '23505', constraint: 'uq_clientes_codigo' });
    const svc = servicoComTransacao(transaction);
    await expect(svc.criar(dtoBase, 'u1')).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).toHaveBeenCalledTimes(5);
  });
});
