import { FakeBalancaGateway } from '../../src/hardware/fakes/fake-balanca.gateway';
import { FakeLeitorGateway } from '../../src/hardware/fakes/fake-leitor.gateway';
import { FakeImpressoraGateway } from '../../src/hardware/fakes/fake-impressora.gateway';
import { SerialBalancaAdapter } from '../../src/hardware/adapters/serial-balanca.adapter';
import { SerialLeitorAdapter } from '../../src/hardware/adapters/serial-leitor.adapter';
import { FilaImpressoraAdapter } from '../../src/hardware/adapters/fila-impressora.adapter';

describe('Hardware FAKE (ADR-009 — fallback testável)', () => {
  it('balança: disponivel lê estável; instavel não estabiliza; indisponivel lança', async () => {
    const b = new FakeBalancaGateway();
    b.definirPeso('9.999');
    expect(b.status().status).toBe('disponivel');
    expect(await b.lerEstavel()).toMatchObject({ peso: '9.999', estavel: true });

    b.definirStatus('instavel');
    expect((await b.lerEstavel()).estavel).toBe(false);

    b.definirStatus('indisponivel');
    await expect(b.lerEstavel()).rejects.toThrow(/indispon/i);
  });

  it('leitor: disponivel devolve código; indisponivel lança', async () => {
    const l = new FakeLeitorGateway();
    l.definirCodigo('QR-abc');
    expect(await l.ler()).toBe('QR-abc');
    l.definirStatus('indisponivel');
    await expect(l.ler()).rejects.toThrow(/indispon/i);
  });

  it('impressora: best-effort — disponivel imprime, indisponivel devolve falha sem lançar', async () => {
    const p = new FakeImpressoraGateway();
    const ok = await p.imprimir({ a: 1 });
    expect(ok.impresso).toBe(true);
    p.definirStatus('indisponivel');
    const falha = await p.imprimir({ a: 2 });
    expect(falha.impresso).toBe(false);
    expect(falha.erro).toBeTruthy();
    expect(p.fila).toHaveLength(2); // fila consultável (auditoria de teste)
  });
});

describe('Hardware adapters reais (ADR-010 — stub indisponível)', () => {
  it('balança real: status indisponivel e leitura lança', async () => {
    const b = new SerialBalancaAdapter();
    expect(b.status().status).toBe('indisponivel');
    await expect(b.lerEstavel()).rejects.toThrow(/ADR-010|não instalado/i);
  });

  it('leitor real: status indisponivel e leitura lança', async () => {
    const l = new SerialLeitorAdapter();
    expect(l.status().status).toBe('indisponivel');
    await expect(l.ler()).rejects.toThrow(/ADR-010|não instalado/i);
  });

  it('impressora real: best-effort não lança, devolve impresso=false + erro', async () => {
    const p = new FilaImpressoraAdapter();
    expect(p.status().status).toBe('indisponivel');
    const r = await p.imprimir();
    expect(r.impresso).toBe(false);
    expect(r.erro).toBeTruthy();
    expect(r.jobId).toBeTruthy();
  });
});
