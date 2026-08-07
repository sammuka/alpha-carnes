'use client';

import { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
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
    <Card>
      <CardHeader>
        <Calculator className="size-4 text-primary" />
        <CardTitle>Simulador de Disponibilidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Informe o TZ livre e reserve um produto derivado para ver o impacto nas duas alternativas.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Quantidade de TZ livre" htmlFor="tz-livre">
            <Input
              id="tz-livre"
              type="number"
              min={0}
              className="w-40"
              value={tzLivre}
              onChange={(e) => setTzLivre(e.target.value)}
            />
          </FormField>
          <FormField label="Reservar produto" htmlFor="produto-reserva">
            <SelectNative
              id="produto-reserva"
              className="w-56"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
            >
              <option value="">Nenhum</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </SelectNative>
          </FormField>
          <FormField label="Quantidade a reservar" htmlFor="qtd-reserva">
            <Input
              id="qtd-reserva"
              type="number"
              min={1}
              className="w-32"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
          </FormField>
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
                <div key={item.produtoId} className="flex justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{item.nome}</span>
                  <span className="font-data">
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
      </CardContent>
    </Card>
  );
}
