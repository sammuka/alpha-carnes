import { INestApplication } from '@nestjs/common';
import { createTestApp, cleanupDb, createTestUser, loginCookies } from '../helpers/test-app';

const CNPJ_VALIDO = '11222333000181';

/** Gera um CNPJ com dígito verificador válido a partir de uma base de 12 dígitos. */
function gerarCnpjValido(base12: string): string {
  const calcularDigito = (digitos: number[], qtd: number): number => {
    let soma = 0;
    let peso = 2;
    for (let i = qtd - 1; i >= 0; i--) {
      soma += (digitos[i] ?? 0) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const digitos = base12.split('').map(Number);
  const d1 = calcularDigito(digitos, 12);
  const d2 = calcularDigito([...digitos, d1], 13);
  return `${base12}${d1}${d2}`;
}

describe('Clientes — Onda 4 (rota_id, prioridade, preferências)', () => {
  let app: INestApplication;
  let adminCookies: string;

  async function request() {
    return (await import('supertest')).default;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await createTestUser(app, { perfil: 'administrador' });
    adminCookies = await loginCookies(app, admin.adminEmail, admin.adminPassword);
  }, 60000);

  afterAll(async () => {
    await cleanupDb(app);
    await app.close();
  });

  const novoCliente = (over: Record<string, unknown> = {}) => ({
    codigo: `CLI-ONDA4-${Math.floor(performance.now() * 1000)}-${Math.round(performance.timeOrigin)}`,
    razaoSocial: 'Cliente Onda4 LTDA',
    documentoFiscal: CNPJ_VALIDO,
    ...over,
  });

  it('persiste dados fiscais e endereco no jsonb sem perder chaves', async () => {
    const req = await request();
    const dadosFiscaisJson = {
      logradouro: 'Rua das Carnes', numero: '100', complemento: 'Galpão 2', bairro: 'Centro',
      cidade: 'Osasco', uf: 'SP', cep: '06000-000', inscricaoEstadual: '123.456.789.000',
      inscricaoMunicipal: '9988', emailFiscal: 'fiscal@cliente.com', telefoneFiscal: '1140001000',
    };
    const res = await req(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ codigo: 'CLI-ONDA4-FISCAL', documentoFiscal: gerarCnpjValido('500000100001'), dadosFiscaisJson }));
    expect(res.status).toBe(201);
    expect(res.body.dadosFiscaisJson).toEqual(dadosFiscaisJson);

    const detalhe = await req(app.getHttpServer()).get(`/clientes/${res.body.id}`).set('Cookie', adminCookies);
    expect(detalhe.status).toBe(200);
    expect(detalhe.body.dadosFiscaisJson).toEqual(dadosFiscaisJson);
  });

  it('persiste lista de contatos no jsonb', async () => {
    const req = await request();
    const dadosContatoJson = { nome: 'Fulano', cargo: 'Comprador', telefone: '11988887777', whatsapp: '11988887777', email: 'fulano@cliente.com', tipo: 'compra', principal: true };
    const res = await req(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ codigo: 'CLI-ONDA4-CONTATO', documentoFiscal: gerarCnpjValido('500000110001'), dadosContatoJson }));
    expect(res.status).toBe(201);
    expect(res.body.dadosContatoJson).toEqual(dadosContatoJson);
  });

  it('aceita necessitaCorteAcerto nas preferencias operacionais', async () => {
    const req = await request();
    const res = await req(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({
        codigo: 'CLI-ONDA4-PREF', documentoFiscal: gerarCnpjValido('500000120001'),
        preferenciasJson: { necessitaCorteAcerto: true, perfilGordura: 'magra' },
      }));
    expect(res.status).toBe(201);
    expect(res.body.preferenciasJson.necessitaCorteAcerto).toBe(true);
  });

  it('grava rota_id via FK e prioridade restrita a normal|alta', async () => {
    const req = await request();
    const rota = await req(app.getHttpServer())
      .post('/rotas')
      .set('Cookie', adminCookies)
      .send({ codigo: 'ROT-ONDA4-1', nome: 'Rota Onda 4' });
    expect(rota.status).toBe(201);

    const criar = await req(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({
        codigo: 'CLI-ONDA4-ROTA', documentoFiscal: gerarCnpjValido('500000130001'),
        rotaId: rota.body.id, prioridade: 'alta',
      }));
    expect(criar.status).toBe(201);
    expect(criar.body.rotaId).toBe(rota.body.id);
    expect(criar.body.prioridade).toBe('alta');

    const invalida = await req(app.getHttpServer())
      .post('/clientes')
      .set('Cookie', adminCookies)
      .send(novoCliente({ codigo: 'CLI-ONDA4-PRIOINV', documentoFiscal: gerarCnpjValido('500000140001'), prioridade: 'baixa' }));
    expect(invalida.status).toBe(400);
  });
});
