import { render, screen, fireEvent } from '@testing-library/react';
import { DatePickerField } from '../date-picker-field';

describe('DatePickerField', () => {
  it('exibe a data ISO em dd/MM/yyyy', () => {
    render(<DatePickerField value="2026-08-05" onChange={() => {}} aria-label="Data operacional" />);
    expect(screen.getByText('05/08/2026')).toBeInTheDocument();
  });

  it('exibe placeholder quando vazio', () => {
    render(<DatePickerField value="" onChange={() => {}} aria-label="Data" />);
    expect(screen.getByText('dd/mm/aaaa')).toBeInTheDocument();
  });

  it('atalho Hoje devolve ISO de hoje', () => {
    const onChange = jest.fn();
    render(<DatePickerField value="" onChange={onChange} aria-label="Data" />);
    fireEvent.click(screen.getByRole('button', { name: 'Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
  });
});
