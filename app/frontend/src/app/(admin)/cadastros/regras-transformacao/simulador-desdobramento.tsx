'use client';

import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mensagemDeErro } from '@/lib/error-message';

interface Resultado {
  quantidade: number;
  itens: Array<{ itemComercialId: string; descricao: string; fator: string; total: number }>;
  somaFatores: number;
  totalPartes: number;
}

export function SimuladorDesdobramento({ itemCompraId }: { itemCompraId: string | null }) {
  /** Valor inicial do protótipo — RegraDesdobramento.tsx:65 (`useState(10)`). */
  const [quantidade, setQuantidade] = useState('10');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  const simular = async () => {
    if (!itemCompraId) {
      setErro('Selecione um item de compra para simular.');
      setResultado(null);
      return;
    }
    setCalculando(true);
    setErro(null);
    try {
      const res = await fetch('/api/cadastros/regras-desdobramento/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemCompraId, quantidade: Number(quantidade) }),
      });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        setResultado(null);
        return;
      }
      setResultado((await res.json()) as Resultado);
    } catch {
      setErro('Erro de conexão com o servidor.');
      setResultado(null);
    } finally {
      setCalculando(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-primary" />
        <h3 className="font-bold">Simulador</h3>
      </div>

      <div className="flex items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="qtd-simulacao">Se eu comprar (Boi Casado):</Label>
          <Input
            id="qtd-simulacao"
            type="number"
            min={1}
            className="w-40"
            value={quantidade}
            onChange={(e) => setQuantidade(e.target.value)}
          />
        </div>
        <Button onClick={() => void simular()} disabled={calculando}>
          {calculando ? 'Calculando…' : 'Simular'}
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-sm text-destructive">
          {erro}
        </p>
      )}

      {resultado && (
        <div className="space-y-2">
          {resultado.itens.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra de desdobramento ativa para este item.</p>
          )}
          {resultado.itens.map((item) => (
            <div key={item.itemComercialId} className="flex justify-between rounded-md border px-4 py-2 text-sm">
              <span>{item.descricao}</span>
              <span className="font-mono">
                {resultado.quantidade} × {item.fator} = <strong>{item.total}</strong>
              </span>
            </div>
          ))}
          <p className="text-sm font-medium">Total de partes geradas: {resultado.totalPartes}</p>
        </div>
      )}
    </Card>
  );
}
