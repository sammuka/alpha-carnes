import { clientesConfig } from '@/lib/cadastros-config';

it('config de clientes nao expoe o campo legado de rota', () => {
  const campoLegado = 'rotaPadrao';
  const resultado = clientesConfig.schema.parse({
    codigo: 'CLI-001',
    razaoSocial: 'Cliente Contrato Ltda.',
    documentoFiscal: '12345678000190',
    [campoLegado]: 'Rota antiga',
  });

  expect(clientesConfig.campos.map((campo) => campo.nome)).not.toContain(campoLegado);
  expect(resultado).not.toHaveProperty(campoLegado);
});
