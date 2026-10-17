/** Célula do CSV: neutraliza o que o Excel ou o Calc leria como fórmula (prefixo ') e cita o que precisa de aspas. */
export function celulaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return /[",;\r\n\t]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}
