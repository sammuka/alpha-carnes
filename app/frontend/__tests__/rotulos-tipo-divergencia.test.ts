import {
  ROTULOS_TIPO_DIVERGENCIA,
  rotuloTipoDivergencia,
  tipoDivergenciaEhSlugConhecido,
} from '../src/lib/rotulos-tipo-divergencia';

it('mapa traduz peso_divergente para Falta de Peso do prototipo', () => {
  expect(ROTULOS_TIPO_DIVERGENCIA.peso_divergente).toBe('Falta de Peso');
  expect(rotuloTipoDivergencia('peso_divergente')).toBe('Falta de Peso');
  expect(tipoDivergenciaEhSlugConhecido('peso_divergente')).toBe(true);
});

it('fallback devolve descricao livre sem inventar rotulo', () => {
  const descricao = 'Atraso na entrega acordada';
  expect(rotuloTipoDivergencia(descricao)).toBe(descricao);
  expect(tipoDivergenciaEhSlugConhecido(descricao)).toBe(false);
});
