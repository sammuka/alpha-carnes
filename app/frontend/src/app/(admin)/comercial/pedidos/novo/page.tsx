'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const pedidoSchema = z.object({
  compraProgramadaId: z.string().uuid('ID de compra inválido'),
  clienteId: z.string().uuid('ID de cliente inválido'),
  dataOperacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve ser YYYY-MM-DD'),
  itemComercialId: z.string().uuid('ID de item inválido'),
  quantidadePedida: z
    .string()
    .min(1, 'Quantidade obrigatória')
    .refine((v) => Number(v) > 0, 'Quantidade deve ser maior que zero'),
});

type PedidoForm = z.infer<typeof pedidoSchema>;

interface Resultado {
  id: string;
  status: string;
}

export default function NovoPedidoPage() {
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PedidoForm>({ resolver: zodResolver(pedidoSchema) });

  const onSubmit = async (data: PedidoForm) => {
    setErro(null);
    setResultado(null);
    const res = await fetch('/api/comercial/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compraProgramadaId: data.compraProgramadaId,
        clienteId: data.clienteId,
        dataOperacao: data.dataOperacao,
        itens: [{ itemComercialId: data.itemComercialId, quantidadePedida: Number(data.quantidadePedida) }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErro((body as { message?: string }).message ?? 'Erro ao criar pedido');
      return;
    }
    setResultado(body as Resultado);
  };

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Novo pedido</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <Label htmlFor="compraProgramadaId">Compra programada</Label>
          <Input id="compraProgramadaId" {...register('compraProgramadaId')} />
          {errors.compraProgramadaId && <p className="text-sm text-destructive">{errors.compraProgramadaId.message}</p>}
        </div>
        <div>
          <Label htmlFor="clienteId">Cliente</Label>
          <Input id="clienteId" {...register('clienteId')} />
          {errors.clienteId && <p className="text-sm text-destructive">{errors.clienteId.message}</p>}
        </div>
        <div>
          <Label htmlFor="dataOperacao">Data operacional</Label>
          <Input id="dataOperacao" type="date" {...register('dataOperacao')} />
          {errors.dataOperacao && <p className="text-sm text-destructive">{errors.dataOperacao.message}</p>}
        </div>
        <div>
          <Label htmlFor="itemComercialId">Item comercial</Label>
          <Input id="itemComercialId" {...register('itemComercialId')} />
          {errors.itemComercialId && <p className="text-sm text-destructive">{errors.itemComercialId.message}</p>}
        </div>
        <div>
          <Label htmlFor="quantidadePedida">Quantidade</Label>
          <Input id="quantidadePedida" type="number" step="0.001" {...register('quantidadePedida')} />
          {errors.quantidadePedida && <p className="text-sm text-destructive">{errors.quantidadePedida.message}</p>}
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Reservando…' : 'Criar pedido'}
        </Button>
      </form>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </div>
      )}

      {resultado && (
        <div role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Pedido criado: <strong>{resultado.id}</strong> — status <strong>{resultado.status}</strong>
          {resultado.status === 'parcialmente_reservado' && ' (atenção: reserva parcial, há itens sem cobertura)'}
        </div>
      )}
    </div>
  );
}
