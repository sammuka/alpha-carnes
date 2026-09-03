import { fornecedoresConfig } from '../src/lib/cadastros-config';
import { montarPayload } from '../src/lib/cadastro-payload';

const { schema: _s, ...config } = fornecedoresConfig;
void _s;

describe('montarPayload — fornecedores (edição master-detail)', () => {
  it('omite parâmetros operacionais vazios e não envia string no lugar de número', () => {
    const payload = montarPayload(config, {
      codigo: 'FRIG-01',
      razaoSocial: 'Frigorífico Teste',
      documentoFiscal: '11222333000181',
      status: 'ativo',
      observacoes: '',
      'contatosJson.nome': '',
      'contatosJson.telefone': '',
      'contatosJson.email': '',
      'contatosJson.cargo': '',
      'parametrosOperacionaisJson.romaneioAntecipado': false,
      'parametrosOperacionaisJson.horarioLimiteRecebimento': '',
      'parametrosOperacionaisJson.capacidadeMaximaKg': '',
      'parametrosOperacionaisJson.toleranciaDivergenciaPercentual': '',
      'parametrosOperacionaisJson.notaQualidade': '',
    });

    expect(payload.parametrosOperacionaisJson).toEqual({ romaneioAntecipado: false });
    expect(payload.contatosJson).toEqual({});
  });

  it('converte capacidade e tolerância para número e preserva zero', () => {
    const payload = montarPayload(config, {
      codigo: 'FRIG-01',
      razaoSocial: 'Frigorífico Teste',
      documentoFiscal: '11222333000181',
      status: 'ativo',
      observacoes: '',
      'contatosJson.nome': '',
      'contatosJson.telefone': '',
      'contatosJson.email': '',
      'contatosJson.cargo': '',
      'parametrosOperacionaisJson.romaneioAntecipado': true,
      'parametrosOperacionaisJson.horarioLimiteRecebimento': '18:30',
      'parametrosOperacionaisJson.capacidadeMaximaKg': '0',
      'parametrosOperacionaisJson.toleranciaDivergenciaPercentual': '12.5',
      'parametrosOperacionaisJson.notaQualidade': 'B',
    });

    expect(payload.parametrosOperacionaisJson).toEqual({
      romaneioAntecipado: true,
      horarioLimiteRecebimento: '18:30',
      capacidadeMaximaKg: 0,
      toleranciaDivergenciaPercentual: 12.5,
      notaQualidade: 'B',
    });
  });
});
