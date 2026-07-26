'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { mensagemDeErro } from '@/lib/error-message';

interface Resultado {
  tzLivre: number;
  resultados: Array<{ produtoId: string; nome: string; disponivel: number; bloqueado: boolean }>;
  alternativasPossiveis: Array<{ id: string; nome: string }>;
}

export function SimuladorDesossa() {
  const [produtos, setProdutos] = useState<Array<{ id: string; nome: string }>>([]);
  /** Valores iniciais do protótipo — RegraDesdobramento.tsx:323 (`10`) e :325 (`3`). */
  const [tzLivre, setTzLivre] = useState('10');
  const [produtoId, setProdutoId] = useState('');
  const [quantidade, setQuantidade] = useState('3');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [calculando, setCalculando] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/cadastros/produtos?pageSize=100', { cache: 'no-store' });
      if (!res.ok) {
        setErro(await mensagemDeErro(res));
        return;
      }
      const corpo = (await res.json()) as { data: Array<{ id: string; nome: string }> };
      setProdutos(corpo.data);
    })();
  }, []);

  const simular = async () => {
    setCalculando(true);
    setErro(null);
    try {
      const res = await fetch('/api/desossa/regras-transformacao/simular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tzLivre: Number(tzLivre),
          produtoId: produtoId || undefined,
          quantidade: quantidade ? Number(quantidade) : undefined,
        }),
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
        <h3 className="font-bold">Simulador de Disponibilidade</h3>
      </div>

      <p className="text-sm text-muted-foreground">
        Informe o TZ livre e reserve um produto derivado para ver o impacto nas duas alternativas.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="tz-livre">Quantidade de TZ livre</Label>
          <Input
            id="tz-livre"
            type="number"
            min={0}
            className="w-40"
            value={tzLivre}
            onChange={(e) => setTzLivre(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="produto-reserva">Reservar produto</Label>
          <select
            id="produto-reserva"
            className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm"
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
          >
            <option value="">Nenhum</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qtd-reserva">Quantidade a reservar</Label>
          <Input
            id="qtd-reserva"
            type="number"
            min={1}
            className="w-32"
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
          {resultado.resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra de transformação ativa cadastrada.</p>
          ) : (
            resultado.resultados.map((item) => (
              <div key={item.produtoId} className="flex justify-between rounded-md border px-4 py-2 text-sm">
                <span>{item.nome}</span>
                <span className="font-mono">
                  {item.disponivel}
                  {item.bloqueado && (
                    <span className="ml-2 font-sans text-destructive">Bloqueado pela reserva</span>
                  )}
                </span>
              </div>
            ))
          )}
          <div>
            <p className="text-sm font-medium">Alternativas ainda possíveis</p>
            <ul className="text-sm text-muted-foreground">
              {resultado.alternativasPossiveis.map((a) => (
                <li key={a.id}>{a.nome}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
