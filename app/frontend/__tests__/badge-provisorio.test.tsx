import { render, screen } from '@testing-library/react';
import { BadgeProvisorio, PENDENCIAS_ABERTAS } from '../src/components/ui/badge-provisorio';

describe('BadgeProvisorio', () => {
  it('title cita a pendencia e a referencia do plano mestre', () => {
    render(<BadgeProvisorio pendencia="P1" />);
    const badge = screen.getByText('Provisório');
    expect(badge).toHaveAttribute(
      'title',
      'Provisório — pendência P1 (v1.1 §16.2): separação obrigatória do estoque por operação seg/qua/sex (cadência). Valor parametrizável até decisão registrada em DECISOES.md.',
    );
  });

  it('aceita rotulo especifico sem perder o title da pendencia', () => {
    render(<BadgeProvisorio pendencia="P12" texto="Regra provisória" />);
    const badge = screen.getByText('Regra provisória');
    expect(badge.getAttribute('title')).toContain('pendência P12 (v1.1 §16.15)');
  });

  it('catalogo contem so as pendencias abertas P1..P15 sem P2/P4/P13/P14', () => {
    expect(Object.keys(PENDENCIAS_ABERTAS)).toEqual([
      'P1', 'P3', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12', 'P15',
    ]);
  });

  it('usa os tokens ambar do DS', () => {
    render(<BadgeProvisorio pendencia="P3" />);
    const badge = screen.getByText('Provisório');
    expect(badge.className).toContain('bg-provisorio-bg');
    expect(badge.className).toContain('text-provisorio-text');
    expect(badge.className).toContain('border-provisorio-border');
  });
});
