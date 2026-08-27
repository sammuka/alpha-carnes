import { useState } from 'react';

/**
 * Estado padrão do mapa campo→mensagem devolvido pelo backend (issues do Zod).
 * Uso: `setErros(porCampo)` no catch do submit; `limparCampo(chave)` no onChange
 * de cada campo (o erro some assim que o usuário corrige); `limparTudo()` ao
 * abrir formulário novo ou trocar de registro.
 */
export function useErrosPorCampo() {
  const [erros, setErros] = useState<Record<string, string>>({});

  function limparCampo(chave: string) {
    setErros((atual) => {
      if (!(chave in atual)) return atual;
      const resto = { ...atual };
      delete resto[chave];
      return resto;
    });
  }

  return { erros, setErros, limparCampo, limparTudo: () => setErros({}) };
}
